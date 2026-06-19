import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * ProgressReports → schema đánh giá định kỳ thật (DanhGiaDinhKy_long.csv).
 *
 * - `period`: varchar → enum `enum_progress_reports_period`
 *   ('Cuối năm 2024' | '6 tháng đầu 2025' | '6 tháng cuối 2025').
 *   USING CASE: giá trị cũ không thuộc enum (vd dữ liệu test "Tháng 5/2026")
 *   được dồn về '6 tháng cuối 2025' để ALTER không vỡ — KHÔNG có dữ liệu thật
 *   (chỉ 1 dòng placeholder thời dựng GĐ4).
 * - THÊM (nullable, additive): nhan_xet_chung (jsonb richText), y_thuc (numeric),
 *   btvn / tham_gia_giai_dau / cac_sach_da_hoc / ke_hoach (varchar).
 * - BỎ strengths, areas_to_improve (dữ liệu thật gộp vào nhan_xet_chung).
 *
 * DDL idempotent (IF NOT EXISTS / DO $$ duplicate_object) — chạy lại an toàn.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ── period: varchar → enum ──────────────────────────────────────────────
    DO $$ BEGIN
      CREATE TYPE "public"."enum_progress_reports_period" AS ENUM(
        'Cuối năm 2024', '6 tháng đầu 2025', '6 tháng cuối 2025'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE "progress_reports"
      ALTER COLUMN "period" TYPE "public"."enum_progress_reports_period"
      USING (
        CASE
          WHEN "period" IN ('Cuối năm 2024', '6 tháng đầu 2025', '6 tháng cuối 2025')
            THEN "period"::"public"."enum_progress_reports_period"
          ELSE '6 tháng cuối 2025'::"public"."enum_progress_reports_period"
        END
      );

    -- ── field đánh giá mới (nullable) ─────────────────────────────────────────
    ALTER TABLE "progress_reports" ADD COLUMN IF NOT EXISTS "y_thuc" numeric;
    ALTER TABLE "progress_reports" ADD COLUMN IF NOT EXISTS "btvn" varchar;
    ALTER TABLE "progress_reports" ADD COLUMN IF NOT EXISTS "tham_gia_giai_dau" varchar;
    ALTER TABLE "progress_reports" ADD COLUMN IF NOT EXISTS "cac_sach_da_hoc" varchar;
    ALTER TABLE "progress_reports" ADD COLUMN IF NOT EXISTS "nhan_xet_chung" jsonb;
    ALTER TABLE "progress_reports" ADD COLUMN IF NOT EXISTS "ke_hoach" varchar;

    -- ── bỏ cặp field cũ (gộp vào nhan_xet_chung) ──────────────────────────────
    ALTER TABLE "progress_reports" DROP COLUMN IF EXISTS "strengths";
    ALTER TABLE "progress_reports" DROP COLUMN IF EXISTS "areas_to_improve";
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "progress_reports" ADD COLUMN IF NOT EXISTS "strengths" varchar;
    ALTER TABLE "progress_reports" ADD COLUMN IF NOT EXISTS "areas_to_improve" varchar;

    ALTER TABLE "progress_reports" DROP COLUMN IF EXISTS "ke_hoach";
    ALTER TABLE "progress_reports" DROP COLUMN IF EXISTS "nhan_xet_chung";
    ALTER TABLE "progress_reports" DROP COLUMN IF EXISTS "cac_sach_da_hoc";
    ALTER TABLE "progress_reports" DROP COLUMN IF EXISTS "tham_gia_giai_dau";
    ALTER TABLE "progress_reports" DROP COLUMN IF EXISTS "btvn";
    ALTER TABLE "progress_reports" DROP COLUMN IF EXISTS "y_thuc";

    -- period: enum → varchar (giữ nhãn hiện có dạng text)
    ALTER TABLE "progress_reports"
      ALTER COLUMN "period" TYPE varchar USING ("period"::text);
    DROP TYPE IF EXISTS "public"."enum_progress_reports_period";
  `);
}
