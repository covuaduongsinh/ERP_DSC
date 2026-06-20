import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Mở rộng collection `attendance` cho nhận xét buổi học (khớp file
 * NhanXetBuoi_long.csv): buoi, coach (→coaches), lop (→classes), lam_btvn,
 * y_thuc, kien_thuc_moi, nhan_xet, giao_btvn, kh_buoi_sau, sach_dang_hoc,
 * link_lichess và `khoa` (khóa idempotent: co_so|buoi|ten_hoc_vien).
 *
 * Ghi chú:
 * - Tất cả cột thêm đều NULLABLE để không phá vỡ bản ghi điểm danh cũ.
 * - `coach_id`/`lop_id` là FK ON DELETE SET NULL (theo quy ước Payload với
 *   `student_id`): xóa GV/lớp không xóa lịch sử điểm danh.
 * - `khoa` UNIQUE (Postgres cho phép nhiều NULL) để import chống trùng; điểm
 *   danh nhập tay vẫn để khoa NULL bình thường.
 * - DDL additive idempotent (IF NOT EXISTS) — chạy lại an toàn.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "buoi" varchar;
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "coach_id" integer;
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "lop_id" integer;
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "lam_b_t_v_n" numeric;
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "y_thuc" numeric;
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "kien_thuc_moi" varchar;
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "nhan_xet" varchar;
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "giao_b_t_v_n" varchar;
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "kh_buoi_sau" varchar;
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "sach_dang_hoc" varchar;
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "link_lichess" varchar;
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "khoa" varchar;

    DO $$ BEGIN
      ALTER TABLE "attendance" ADD CONSTRAINT "attendance_coach_id_coaches_id_fk"
        FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id") ON DELETE SET NULL;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "attendance" ADD CONSTRAINT "attendance_lop_id_classes_id_fk"
        FOREIGN KEY ("lop_id") REFERENCES "public"."classes"("id") ON DELETE SET NULL;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "attendance_coach_idx"
      ON "attendance" USING btree ("coach_id");
    CREATE INDEX IF NOT EXISTS "attendance_lop_idx"
      ON "attendance" USING btree ("lop_id");
    CREATE UNIQUE INDEX IF NOT EXISTS "attendance_khoa_idx"
      ON "attendance" USING btree ("khoa");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "attendance_khoa_idx";
    DROP INDEX IF EXISTS "attendance_lop_idx";
    DROP INDEX IF EXISTS "attendance_coach_idx";
    ALTER TABLE "attendance" DROP CONSTRAINT IF EXISTS "attendance_lop_id_classes_id_fk";
    ALTER TABLE "attendance" DROP CONSTRAINT IF EXISTS "attendance_coach_id_coaches_id_fk";
    ALTER TABLE "attendance" DROP COLUMN IF EXISTS "khoa";
    ALTER TABLE "attendance" DROP COLUMN IF EXISTS "link_lichess";
    ALTER TABLE "attendance" DROP COLUMN IF EXISTS "sach_dang_hoc";
    ALTER TABLE "attendance" DROP COLUMN IF EXISTS "kh_buoi_sau";
    ALTER TABLE "attendance" DROP COLUMN IF EXISTS "giao_b_t_v_n";
    ALTER TABLE "attendance" DROP COLUMN IF EXISTS "nhan_xet";
    ALTER TABLE "attendance" DROP COLUMN IF EXISTS "kien_thuc_moi";
    ALTER TABLE "attendance" DROP COLUMN IF EXISTS "y_thuc";
    ALTER TABLE "attendance" DROP COLUMN IF EXISTS "lam_b_t_v_n";
    ALTER TABLE "attendance" DROP COLUMN IF EXISTS "lop_id";
    ALTER TABLE "attendance" DROP COLUMN IF EXISTS "coach_id";
    ALTER TABLE "attendance" DROP COLUMN IF EXISTS "buoi";
  `)
}
