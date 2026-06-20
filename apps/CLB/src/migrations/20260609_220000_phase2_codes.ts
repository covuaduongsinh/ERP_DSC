import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Phase 2: thêm cột `code` (mã định danh nghiệp vụ) + BACKFILL cho enrollments /
 * tuition_cycles / renewal_requests / progress_reports. 🔒 ĐỤNG DỮ LIỆU KHÁCH
 * HÀNG — thuần ADDITIVE, không drop. Tất cả BRANCHLESS (không {CS}).
 *
 * Phụ thuộc: chạy SAU `20260609_200000_add_code_counters` (cần bảng
 * `code_counters` để seed). Áp bằng `payload migrate` sau review (KHÔNG push).
 *
 * ⚠️ THỨ TỰ DEPLOY: code (collection hooks + field) phải DEPLOY TRƯỚC/CÙNG khi
 * áp migration này. NOT NULL được set CUỐI cùng sau backfill; nếu áp NOT NULL mà
 * code mới chưa sống thì bản ghi tạo giữa chừng sẽ thiếu code → vi phạm NOT NULL.
 *
 * Quy ước mã (xem `apps/web/src/lib/codes/`):
 *  - enrollments      `GD-YY-NNNNN`      reset/năm theo created_at,            pad 5.
 *  - tuition_cycles   `CK-YY-NNNNN`      reset/năm theo COALESCE(start_date,created_at), pad 5.
 *  - renewal_requests `GH-YYYYMM-NNNN`   reset/tháng theo created_at,          pad 4.
 *  - progress_reports `BC-YY-NNNNN`      reset/năm theo created_at,            pad 5.
 *
 * Thứ tự cho mỗi bảng (mirror Phase 1):
 *  1. ADD COLUMN "code" varchar (nullable tạm) — additive, IF NOT EXISTS.
 *  2. Backfill bằng window function row_number() — ổn định, không trùng, không
 *     sót. PARTITION theo cột scope (năm / tháng), ORDER theo ngày nghiệp vụ →
 *     created_at → id (tiebreak xác định khi trùng ngày).
 *  3. Seed `code_counters` = max(seq) mỗi scope (GREATEST — không lùi). KHÓA scope
 *     dùng NĂM ĐẦY ĐỦ (`GD:2026`, `CK:2026`, `BC:2026`) / `GH:202606` — KHỚP
 *     byte-for-byte với chuỗi makeCodeHook sinh (mã in dùng YY, scope dùng YYYY).
 *  4. CREATE UNIQUE INDEX (quy ước Payload `<table>_code_idx`).
 *  5. SET NOT NULL (sau backfill).
 *
 * Cột đã xác minh theo schema thật (information_schema/snapshot Payload):
 *  - enrollments.created_at, tuition_cycles.start_date + created_at,
 *    renewal_requests.created_at, progress_reports.created_at. ✓
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ── 1) ADD COLUMN (nullable) ────────────────────────────────────────────
  await db.execute(sql`
    ALTER TABLE "enrollments"      ADD COLUMN IF NOT EXISTS "code" varchar;
    ALTER TABLE "tuition_cycles"   ADD COLUMN IF NOT EXISTS "code" varchar;
    ALTER TABLE "renewal_requests" ADD COLUMN IF NOT EXISTS "code" varchar;
    ALTER TABLE "progress_reports" ADD COLUMN IF NOT EXISTS "code" varchar;
  `)

  // ── 2a) BACKFILL enrollments: GD-YY-NNNNN, reset/năm theo created_at ─────
  await db.execute(sql`
    WITH ranked AS (
      SELECT
        id,
        to_char(created_at, 'YY') AS yy,
        row_number() OVER (
          PARTITION BY date_part('year', created_at)
          ORDER BY created_at, id
        ) AS seq
      FROM "enrollments"
      WHERE "code" IS NULL
    )
    UPDATE "enrollments" t
    SET "code" = 'GD-' || r.yy || '-' || lpad(r.seq::text, 5, '0')
    FROM ranked r
    WHERE t.id = r.id;
  `)

  // Seed counter GD:<yyyy> = max(seq) mỗi năm.
  await db.execute(sql`
    INSERT INTO "code_counters" ("scope", "value")
    SELECT 'GD:' || to_char(created_at, 'YYYY') AS scope,
           max((regexp_replace(code, '^GD-\\d{2}-', ''))::int) AS value
    FROM "enrollments"
    WHERE code IS NOT NULL AND code ~ '^GD-\\d{2}-\\d+$'
    GROUP BY to_char(created_at, 'YYYY')
    ON CONFLICT ("scope") DO UPDATE
      SET "value" = GREATEST("code_counters"."value", EXCLUDED."value"),
          "updated_at" = now();
  `)

  // ── 2b) BACKFILL tuition_cycles: CK-YY-NNNNN ────────────────────────────
  // Ngày nghiệp vụ = COALESCE(start_date, created_at); reset/năm theo ngày này.
  // YY/YYYY phải lấy từ CÙNG biz_date để mã in (YY) khớp scope counter (YYYY).
  await db.execute(sql`
    WITH dated AS (
      SELECT
        id,
        COALESCE(start_date, created_at) AS biz_date,
        created_at
      FROM "tuition_cycles"
      WHERE "code" IS NULL
    ),
    ranked AS (
      SELECT
        id,
        to_char(biz_date, 'YY') AS yy,
        row_number() OVER (
          PARTITION BY date_part('year', biz_date)
          ORDER BY biz_date, created_at, id
        ) AS seq
      FROM dated
    )
    UPDATE "tuition_cycles" t
    SET "code" = 'CK-' || r.yy || '-' || lpad(r.seq::text, 5, '0')
    FROM ranked r
    WHERE t.id = r.id;
  `)

  // Seed counter CK:<yyyy> = max(seq) mỗi năm — nhóm theo NĂM ĐẦY ĐỦ của biz_date.
  await db.execute(sql`
    INSERT INTO "code_counters" ("scope", "value")
    SELECT 'CK:' || to_char(COALESCE(start_date, created_at), 'YYYY') AS scope,
           max((regexp_replace(code, '^CK-\\d{2}-', ''))::int) AS value
    FROM "tuition_cycles"
    WHERE code IS NOT NULL AND code ~ '^CK-\\d{2}-\\d+$'
    GROUP BY to_char(COALESCE(start_date, created_at), 'YYYY')
    ON CONFLICT ("scope") DO UPDATE
      SET "value" = GREATEST("code_counters"."value", EXCLUDED."value"),
          "updated_at" = now();
  `)

  // ── 2c) BACKFILL renewal_requests: GH-YYYYMM-NNNN, reset/tháng theo created_at ─
  await db.execute(sql`
    WITH ranked AS (
      SELECT
        id,
        to_char(created_at, 'YYYYMM') AS yyyymm,
        row_number() OVER (
          PARTITION BY to_char(created_at, 'YYYYMM')
          ORDER BY created_at, id
        ) AS seq
      FROM "renewal_requests"
      WHERE "code" IS NULL
    )
    UPDATE "renewal_requests" t
    SET "code" = 'GH-' || r.yyyymm || '-' || lpad(r.seq::text, 4, '0')
    FROM ranked r
    WHERE t.id = r.id;
  `)

  // Seed counter GH:<YYYYMM> = max(seq) mỗi tháng.
  await db.execute(sql`
    INSERT INTO "code_counters" ("scope", "value")
    SELECT 'GH:' || split_part(code, '-', 2) AS scope,
           max((split_part(code, '-', 3))::int) AS value
    FROM "renewal_requests"
    WHERE code IS NOT NULL AND code ~ '^GH-\\d{6}-\\d+$'
    GROUP BY split_part(code, '-', 2)
    ON CONFLICT ("scope") DO UPDATE
      SET "value" = GREATEST("code_counters"."value", EXCLUDED."value"),
          "updated_at" = now();
  `)

  // ── 2d) BACKFILL progress_reports: BC-YY-NNNNN, reset/năm theo created_at ─
  // CỐ Ý created_at (KHÔNG published_at: NULL lúc tạo nháp).
  await db.execute(sql`
    WITH ranked AS (
      SELECT
        id,
        to_char(created_at, 'YY') AS yy,
        row_number() OVER (
          PARTITION BY date_part('year', created_at)
          ORDER BY created_at, id
        ) AS seq
      FROM "progress_reports"
      WHERE "code" IS NULL
    )
    UPDATE "progress_reports" t
    SET "code" = 'BC-' || r.yy || '-' || lpad(r.seq::text, 5, '0')
    FROM ranked r
    WHERE t.id = r.id;
  `)

  // Seed counter BC:<yyyy> = max(seq) mỗi năm.
  await db.execute(sql`
    INSERT INTO "code_counters" ("scope", "value")
    SELECT 'BC:' || to_char(created_at, 'YYYY') AS scope,
           max((regexp_replace(code, '^BC-\\d{2}-', ''))::int) AS value
    FROM "progress_reports"
    WHERE code IS NOT NULL AND code ~ '^BC-\\d{2}-\\d+$'
    GROUP BY to_char(created_at, 'YYYY')
    ON CONFLICT ("scope") DO UPDATE
      SET "value" = GREATEST("code_counters"."value", EXCLUDED."value"),
          "updated_at" = now();
  `)

  // ── 4) Unique index (quy ước Payload <table>_code_idx) ──────────────────
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "enrollments_code_idx"      ON "enrollments"      USING btree ("code");
    CREATE UNIQUE INDEX IF NOT EXISTS "tuition_cycles_code_idx"   ON "tuition_cycles"   USING btree ("code");
    CREATE UNIQUE INDEX IF NOT EXISTS "renewal_requests_code_idx" ON "renewal_requests" USING btree ("code");
    CREATE UNIQUE INDEX IF NOT EXISTS "progress_reports_code_idx" ON "progress_reports" USING btree ("code");
  `)

  // ── 5) SET NOT NULL (sau backfill) ───────────────────────────────────────
  await db.execute(sql`
    ALTER TABLE "enrollments"      ALTER COLUMN "code" SET NOT NULL;
    ALTER TABLE "tuition_cycles"   ALTER COLUMN "code" SET NOT NULL;
    ALTER TABLE "renewal_requests" ALTER COLUMN "code" SET NOT NULL;
    ALTER TABLE "progress_reports" ALTER COLUMN "code" SET NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "enrollments_code_idx";
    DROP INDEX IF EXISTS "tuition_cycles_code_idx";
    DROP INDEX IF EXISTS "renewal_requests_code_idx";
    DROP INDEX IF EXISTS "progress_reports_code_idx";
    ALTER TABLE "enrollments"      DROP COLUMN IF EXISTS "code";
    ALTER TABLE "tuition_cycles"   DROP COLUMN IF EXISTS "code";
    ALTER TABLE "renewal_requests" DROP COLUMN IF EXISTS "code";
    ALTER TABLE "progress_reports" DROP COLUMN IF EXISTS "code";
    DELETE FROM "code_counters" WHERE "scope" ~ '^(GD|CK|GH|BC):';
  `)
}
