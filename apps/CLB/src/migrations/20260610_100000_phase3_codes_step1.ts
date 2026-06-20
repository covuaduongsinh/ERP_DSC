import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Phase 3 — BƯỚC 1/2 (nullable + dữ liệu). 🔒 ĐỤNG DỮ LIỆU KHÁCH HÀNG — thuần
 * ADDITIVE, KHÔNG drop, KHÔNG `SET NOT NULL` (bước 2 mới làm).
 *
 * Triển khai 3 BƯỚC (xem feedback_migration_notnull_deploy_order):
 *   1. Migration NÀY (step1): ADD COLUMN nullable + seed `Locations.code` +
 *      backfill classes/events/book_issues + seed counters + unique index.
 *   2. Deploy CODE (field `code` + makeCodeHook trên 4 collection) → bản ghi mới
 *      tự có code.
 *   3. Migration step2 (`20260610_110000_phase3_codes_step2`): SET NOT NULL.
 *
 * Phụ thuộc: chạy SAU `20260609_200000_add_code_counters` (cần bảng
 * `code_counters`). Áp bằng `payload migrate` sau review (KHÔNG push).
 *
 * Quy ước mã (xem `apps/web/src/lib/codes/`):
 *  - classes      `LOP-{CS}-NNN`     LIÊN TỤC theo cơ sở (KHÔNG reset kỳ), pad 3.
 *  - events       `GIAI-YYYY-NN`     reset/năm theo `date` (in NĂM ĐẦY ĐỦ), pad 2.
 *  - book_issues  `XS-YYYYMM-NNNN`   reset/tháng theo `ngay_dung`, pad 4.
 *
 * Cột đã xác minh từ Payload snapshot (`20260529_154027_*.json`) + migration tạo
 * bảng (`20260602_190000_add_books_book_issues`):
 *  - classes: `location_id`, `created_at` (CÓ created_at). Backfill ORDER BY id
 *    (mã liên tục theo cơ sở, không phụ thuộc thời gian).
 *  - events: `date` (NOT NULL theo field-config), `created_at`. ORDER BY date,id.
 *    COALESCE(date, created_at, now()) phòng dòng cũ date null.
 *  - book_issues: `ngay_dung` (NULLABLE), `co_so`, `created_at`. PARTITION theo
 *    tháng của COALESCE(ngay_dung, created_at, now()); ORDER ngay_dung,created_at,id.
 *
 * Scope key KHỚP byte-for-byte makeCodeHook: `LOP:KL`, `GIAI:2026`, `XS:202606`.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ── 1) Locations.code: ADD COLUMN (nullable) + seed KL/VP + unique index ──
  await db.execute(sql`
    ALTER TABLE "locations" ADD COLUMN IF NOT EXISTS "code" varchar;

    UPDATE "locations"
    SET "code" = 'KL'
    WHERE "name" ILIKE '%Kim Liên%' AND "code" IS NULL;

    UPDATE "locations"
    SET "code" = 'VP'
    WHERE "name" ILIKE '%Vĩnh Phúc%' AND "code" IS NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS "locations_code_idx" ON "locations" USING btree ("code");
  `)

  // Cảnh báo nếu còn cơ sở chưa có mã (cần nhập tay trước khi tạo lớp ở đó).
  await db.execute(sql`
    DO $$
    DECLARE missing_cnt int;
    BEGIN
      SELECT count(*) INTO missing_cnt FROM "locations" WHERE "code" IS NULL;
      IF missing_cnt > 0 THEN
        RAISE NOTICE 'locations: % cơ sở chưa có mã (code). Nhập tay KL/VP/... trước khi sinh mã lớp.', missing_cnt;
      END IF;
    END $$;
  `)

  // ── 2) ADD COLUMN code (nullable) cho 3 collection ───────────────────────
  await db.execute(sql`
    ALTER TABLE "classes"     ADD COLUMN IF NOT EXISTS "code" varchar;
    ALTER TABLE "events"      ADD COLUMN IF NOT EXISTS "code" varchar;
    ALTER TABLE "book_issues" ADD COLUMN IF NOT EXISTS "code" varchar;
  `)

  // ── 3a) BACKFILL classes: LOP-{CS}-NNN, LIÊN TỤC theo cơ sở ───────────────
  // Cơ sở từ locations.code (JOIN location_id). Thiếu/null → fallback 'KL' + log.
  await db.execute(sql`
    DO $$
    DECLARE missing_cnt int;
    BEGIN
      SELECT count(*) INTO missing_cnt
      FROM "classes" c
      LEFT JOIN "locations" loc ON loc.id = c.location_id
      WHERE c.code IS NULL AND (loc.code IS NULL);
      IF missing_cnt > 0 THEN
        RAISE NOTICE 'classes: % lớp không suy được mã cơ sở từ location (fallback KL). Soát tay.', missing_cnt;
      END IF;
    END $$;

    WITH branched AS (
      SELECT
        c.id,
        COALESCE(loc.code, 'KL') AS cs
      FROM "classes" c
      LEFT JOIN "locations" loc ON loc.id = c.location_id
      WHERE c.code IS NULL
    ),
    ranked AS (
      SELECT
        id, cs,
        row_number() OVER (
          PARTITION BY cs
          ORDER BY id
        ) AS seq
      FROM branched
    )
    UPDATE "classes" t
    SET "code" = 'LOP-' || r.cs || '-' || lpad(r.seq::text, 3, '0')
    FROM ranked r
    WHERE t.id = r.id;
  `)

  // Seed counter LOP:<CS> = max(seq) mỗi cơ sở (liên tục, không kỳ).
  await db.execute(sql`
    INSERT INTO "code_counters" ("scope", "value")
    SELECT 'LOP:' || split_part(code, '-', 2) AS scope,
           max((split_part(code, '-', 3))::int) AS value
    FROM "classes"
    WHERE code IS NOT NULL AND code ~ '^LOP-[A-Z]{2,3}-\\d+$'
    GROUP BY split_part(code, '-', 2)
    ON CONFLICT ("scope") DO UPDATE
      SET "value" = GREATEST("code_counters"."value", EXCLUDED."value"),
          "updated_at" = now();
  `)

  // ── 3b) BACKFILL events: GIAI-YYYY-NN, reset/năm theo `date` (NĂM ĐẦY ĐỦ) ─
  // COALESCE(date, created_at, now()) phòng dòng cũ date null.
  await db.execute(sql`
    WITH dated AS (
      SELECT
        id,
        COALESCE(date, created_at, now()) AS biz_date
      FROM "events"
      WHERE "code" IS NULL
    ),
    ranked AS (
      SELECT
        id,
        to_char(biz_date, 'YYYY') AS yyyy,
        row_number() OVER (
          PARTITION BY date_part('year', biz_date)
          ORDER BY biz_date, id
        ) AS seq
      FROM dated
    )
    UPDATE "events" t
    SET "code" = 'GIAI-' || r.yyyy || '-' || lpad(r.seq::text, 2, '0')
    FROM ranked r
    WHERE t.id = r.id;
  `)

  // Seed counter GIAI:<YYYY> = max(seq) mỗi năm (scope dùng năm đầy đủ).
  await db.execute(sql`
    INSERT INTO "code_counters" ("scope", "value")
    SELECT 'GIAI:' || split_part(code, '-', 2) AS scope,
           max((split_part(code, '-', 3))::int) AS value
    FROM "events"
    WHERE code IS NOT NULL AND code ~ '^GIAI-\\d{4}-\\d+$'
    GROUP BY split_part(code, '-', 2)
    ON CONFLICT ("scope") DO UPDATE
      SET "value" = GREATEST("code_counters"."value", EXCLUDED."value"),
          "updated_at" = now();
  `)

  // ── 3c) BACKFILL book_issues: XS-YYYYMM-NNNN, reset/tháng theo ngay_dung ──
  // ngay_dung NULLABLE → COALESCE(ngay_dung, created_at, now()) cho cả PARTITION
  // lẫn ORDER (ổn định; dòng thiếu ngày rơi vào tháng created_at).
  await db.execute(sql`
    WITH dated AS (
      SELECT
        id,
        COALESCE(ngay_dung, created_at, now()) AS biz_date,
        ngay_dung,
        created_at
      FROM "book_issues"
      WHERE "code" IS NULL
    ),
    ranked AS (
      SELECT
        id,
        to_char(biz_date, 'YYYYMM') AS yyyymm,
        row_number() OVER (
          PARTITION BY to_char(biz_date, 'YYYYMM')
          ORDER BY biz_date, created_at, id
        ) AS seq
      FROM dated
    )
    UPDATE "book_issues" t
    SET "code" = 'XS-' || r.yyyymm || '-' || lpad(r.seq::text, 4, '0')
    FROM ranked r
    WHERE t.id = r.id;
  `)

  // Seed counter XS:<YYYYMM> = max(seq) mỗi tháng.
  await db.execute(sql`
    INSERT INTO "code_counters" ("scope", "value")
    SELECT 'XS:' || split_part(code, '-', 2) AS scope,
           max((split_part(code, '-', 3))::int) AS value
    FROM "book_issues"
    WHERE code IS NOT NULL AND code ~ '^XS-\\d{6}-\\d+$'
    GROUP BY split_part(code, '-', 2)
    ON CONFLICT ("scope") DO UPDATE
      SET "value" = GREATEST("code_counters"."value", EXCLUDED."value"),
          "updated_at" = now();
  `)

  // ── 4) Unique index (quy ước Payload <table>_code_idx). NO SET NOT NULL. ──
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "classes_code_idx"     ON "classes"     USING btree ("code");
    CREATE UNIQUE INDEX IF NOT EXISTS "events_code_idx"      ON "events"      USING btree ("code");
    CREATE UNIQUE INDEX IF NOT EXISTS "book_issues_code_idx" ON "book_issues" USING btree ("code");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "classes_code_idx";
    DROP INDEX IF EXISTS "events_code_idx";
    DROP INDEX IF EXISTS "book_issues_code_idx";
    ALTER TABLE "classes"     DROP COLUMN IF EXISTS "code";
    ALTER TABLE "events"      DROP COLUMN IF EXISTS "code";
    ALTER TABLE "book_issues" DROP COLUMN IF EXISTS "code";
    DELETE FROM "code_counters" WHERE "scope" ~ '^(LOP|GIAI|XS):';
    DROP INDEX IF EXISTS "locations_code_idx";
    ALTER TABLE "locations" DROP COLUMN IF EXISTS "code";
  `)
}
