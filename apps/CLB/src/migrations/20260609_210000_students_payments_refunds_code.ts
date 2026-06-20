import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Thêm cột `code` (mã định danh nghiệp vụ) + BACKFILL cho students / payments /
 * refunds (Phase 1). 🔒 ĐỤNG DỮ LIỆU KHÁCH HÀNG — thuần ADDITIVE, không drop.
 *
 * Phụ thuộc: chạy SAU `20260609_200000_add_code_counters` (cần bảng
 * `code_counters` để seed). Áp bằng `payload migrate` sau review (KHÔNG push).
 *
 * Quy ước mã (xem `apps/web/src/lib/codes/`):
 *  - students  `HV-YY-NNNN`           reset/năm theo created_at.
 *  - payments  `PT-{CS}-YYYYMM-NNNN`  reset/tháng+cơ sở theo ngay_nop.
 *  - refunds   `PH-{CS}-YYYYMM-NNNN`  reset/tháng+cơ sở theo ngay_hoan.
 *
 * Thứ tự cho mỗi bảng:
 *  1. ADD COLUMN "code" varchar (nullable tạm) — additive.
 *  2. Backfill bằng window function row_number() — ổn định, không trùng, không
 *     sót. PARTITION theo cột scope (năm / cơ sở+tháng), ORDER theo ngày nghiệp
 *     vụ → created_at → id (tiebreak xác định khi trùng ngày).
 *  3. Seed `code_counters` = max(seq) mỗi scope (GREATEST — không lùi).
 *  4. Tạo unique index + index thường (khớp quy ước Payload `<table>_code_idx`).
 *  5. SET NOT NULL.
 *
 * {CS} bản ghi cũ thiếu cơ sở (`co_so` null): suy từ student → location →
 * locations.name (chứa "Kim Liên"→KL, "Vĩnh Phúc"→VP); vẫn null → mặc định `KL`
 * (HQ) + RAISE NOTICE để soát tay. Thiếu ngày nghiệp vụ → fallback created_at.
 *
 * Scope key dùng NĂM ĐẦY ĐỦ (`HV:2026`, `PT:KL:202606`); mã in dùng YY.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ── 1) ADD COLUMN (nullable) ────────────────────────────────────────────
  await db.execute(sql`
    ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "code" varchar;
    ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "code" varchar;
    ALTER TABLE "refunds"  ADD COLUMN IF NOT EXISTS "code" varchar;
  `)

  // ── 2) BACKFILL students: HV-YY-NNNN, reset/năm theo created_at ──────────
  await db.execute(sql`
    WITH ranked AS (
      SELECT
        id,
        to_char(created_at, 'YYYY') AS yyyy,
        to_char(created_at, 'YY')   AS yy,
        row_number() OVER (
          PARTITION BY date_part('year', created_at)
          ORDER BY created_at, id
        ) AS seq
      FROM "students"
      WHERE "code" IS NULL
    )
    UPDATE "students" t
    SET "code" = 'HV-' || r.yy || '-' || lpad(r.seq::text, 4, '0')
    FROM ranked r
    WHERE t.id = r.id;
  `)

  // Seed counter HV:<yyyy> = max(seq) mỗi năm.
  await db.execute(sql`
    INSERT INTO "code_counters" ("scope", "value")
    SELECT 'HV:' || to_char(created_at, 'YYYY') AS scope,
           max(
             (regexp_replace(code, '^HV-\\d{2}-', ''))::int
           ) AS value
    FROM "students"
    WHERE code IS NOT NULL AND code ~ '^HV-\\d{2}-\\d+$'
    GROUP BY to_char(created_at, 'YYYY')
    ON CONFLICT ("scope") DO UPDATE
      SET "value" = GREATEST("code_counters"."value", EXCLUDED."value"),
          "updated_at" = now();
  `)

  // ── 2b) BACKFILL payments: PT-{CS}-YYYYMM-NNNN ───────────────────────────
  // Suy {CS}: co_so → KL/VP; null → student.location → locations.name; vẫn null → KL.
  await db.execute(sql`
    DO $$
    DECLARE
      missing_cnt int;
    BEGIN
      SELECT count(*) INTO missing_cnt
      FROM "payments" p
      WHERE p.co_so IS NULL;
      IF missing_cnt > 0 THEN
        RAISE NOTICE 'payments: % bản ghi thiếu co_so — suy theo student.location (fallback KL). Soát tay.', missing_cnt;
      END IF;
    END $$;

    WITH branched AS (
      SELECT
        p.id,
        COALESCE(p.ngay_nop, p.created_at) AS biz_date,
        p.created_at,
        CASE
          WHEN p.co_so = 'kim_lien' THEN 'KL'
          WHEN p.co_so = 'vinh_phuc' THEN 'VP'
          WHEN loc.name ILIKE '%Kim Liên%' THEN 'KL'
          WHEN loc.name ILIKE '%Vĩnh Phúc%' THEN 'VP'
          ELSE 'KL'
        END AS cs
      FROM "payments" p
      LEFT JOIN "students" s ON s.id = p.student_id
      LEFT JOIN "locations" loc ON loc.id = s.location_id
      WHERE p.code IS NULL
    ),
    ranked AS (
      SELECT
        id, cs,
        to_char(biz_date, 'YYYYMM') AS yyyymm,
        row_number() OVER (
          PARTITION BY cs, to_char(biz_date, 'YYYYMM')
          ORDER BY biz_date, created_at, id
        ) AS seq
      FROM branched
    )
    UPDATE "payments" t
    SET "code" = 'PT-' || r.cs || '-' || r.yyyymm || '-' || lpad(r.seq::text, 4, '0')
    FROM ranked r
    WHERE t.id = r.id;
  `)

  // Seed counter PT:<CS>:<YYYYMM> = max(seq).
  await db.execute(sql`
    INSERT INTO "code_counters" ("scope", "value")
    SELECT
      'PT:' || split_part(code, '-', 2) || ':' || split_part(code, '-', 3) AS scope,
      max((split_part(code, '-', 4))::int) AS value
    FROM "payments"
    WHERE code IS NOT NULL AND code ~ '^PT-[A-Z]{2}-\\d{6}-\\d+$'
    GROUP BY split_part(code, '-', 2), split_part(code, '-', 3)
    ON CONFLICT ("scope") DO UPDATE
      SET "value" = GREATEST("code_counters"."value", EXCLUDED."value"),
          "updated_at" = now();
  `)

  // ── 2c) BACKFILL refunds: PH-{CS}-YYYYMM-NNNN ────────────────────────────
  await db.execute(sql`
    WITH branched AS (
      SELECT
        r.id,
        COALESCE(r.ngay_hoan, r.created_at) AS biz_date,
        r.created_at,
        CASE
          WHEN r.co_so = 'kim_lien' THEN 'KL'
          WHEN r.co_so = 'vinh_phuc' THEN 'VP'
          WHEN loc.name ILIKE '%Kim Liên%' THEN 'KL'
          WHEN loc.name ILIKE '%Vĩnh Phúc%' THEN 'VP'
          ELSE 'KL'
        END AS cs
      FROM "refunds" r
      LEFT JOIN "students" s ON s.id = r.student_id
      LEFT JOIN "locations" loc ON loc.id = s.location_id
      WHERE r.code IS NULL
    ),
    ranked AS (
      SELECT
        id, cs,
        to_char(biz_date, 'YYYYMM') AS yyyymm,
        row_number() OVER (
          PARTITION BY cs, to_char(biz_date, 'YYYYMM')
          ORDER BY biz_date, created_at, id
        ) AS seq
      FROM branched
    )
    UPDATE "refunds" t
    SET "code" = 'PH-' || r.cs || '-' || r.yyyymm || '-' || lpad(r.seq::text, 4, '0')
    FROM ranked r
    WHERE t.id = r.id;
  `)

  // Seed counter PH:<CS>:<YYYYMM> = max(seq).
  await db.execute(sql`
    INSERT INTO "code_counters" ("scope", "value")
    SELECT
      'PH:' || split_part(code, '-', 2) || ':' || split_part(code, '-', 3) AS scope,
      max((split_part(code, '-', 4))::int) AS value
    FROM "refunds"
    WHERE code IS NOT NULL AND code ~ '^PH-[A-Z]{2}-\\d{6}-\\d+$'
    GROUP BY split_part(code, '-', 2), split_part(code, '-', 3)
    ON CONFLICT ("scope") DO UPDATE
      SET "value" = GREATEST("code_counters"."value", EXCLUDED."value"),
          "updated_at" = now();
  `)

  // ── 4) Unique + index (quy ước Payload <table>_code_idx) ─────────────────
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "students_code_idx" ON "students" USING btree ("code");
    CREATE UNIQUE INDEX IF NOT EXISTS "payments_code_idx" ON "payments" USING btree ("code");
    CREATE UNIQUE INDEX IF NOT EXISTS "refunds_code_idx"  ON "refunds"  USING btree ("code");
  `)

  // ── 5) SET NOT NULL (sau backfill) ───────────────────────────────────────
  await db.execute(sql`
    ALTER TABLE "students" ALTER COLUMN "code" SET NOT NULL;
    ALTER TABLE "payments" ALTER COLUMN "code" SET NOT NULL;
    ALTER TABLE "refunds"  ALTER COLUMN "code" SET NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "students_code_idx";
    DROP INDEX IF EXISTS "payments_code_idx";
    DROP INDEX IF EXISTS "refunds_code_idx";
    ALTER TABLE "students" DROP COLUMN IF EXISTS "code";
    ALTER TABLE "payments" DROP COLUMN IF EXISTS "code";
    ALTER TABLE "refunds"  DROP COLUMN IF EXISTS "code";
    DELETE FROM "code_counters" WHERE "scope" ~ '^(HV|PT|PH):';
  `)
}
