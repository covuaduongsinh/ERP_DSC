import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Thêm các field hồ sơ nhân sự cho collection `coaches` (khớp file
 * GiaoVien_da_chuan_hoa.csv): tenTat (khóa định danh, unique), hoTen, vaiTro,
 * sdt, email, elo, trangThai.
 *
 * Ghi chú:
 * - `ten_tat` để NULLABLE ở tầng DB (UNIQUE index cho phép nhiều NULL trong
 *   Postgres) nhằm không phá vỡ bản ghi hồ sơ công khai cũ chưa có tên tắt;
 *   tính bắt buộc (`required`) được Payload kiểm ở tầng ứng dụng khi nhân viên
 *   tạo/sửa qua /admin và khi import.
 * - select fields tạo enum riêng theo quy ước Payload: `enum_coaches_vai_tro`,
 *   `enum_coaches_trang_thai`.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_coaches_vai_tro" AS ENUM('gv', 'tro_giang', 'tap_su');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_coaches_trang_thai" AS ENUM('dang_day', 'nghi');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE "coaches" ADD COLUMN IF NOT EXISTS "ten_tat" varchar;
    ALTER TABLE "coaches" ADD COLUMN IF NOT EXISTS "ho_ten" varchar;
    ALTER TABLE "coaches" ADD COLUMN IF NOT EXISTS "vai_tro" "enum_coaches_vai_tro";
    ALTER TABLE "coaches" ADD COLUMN IF NOT EXISTS "sdt" varchar;
    ALTER TABLE "coaches" ADD COLUMN IF NOT EXISTS "email" varchar;
    ALTER TABLE "coaches" ADD COLUMN IF NOT EXISTS "elo" numeric;
    ALTER TABLE "coaches" ADD COLUMN IF NOT EXISTS "trang_thai" "enum_coaches_trang_thai";

    CREATE UNIQUE INDEX IF NOT EXISTS "coaches_ten_tat_idx"
      ON "coaches" USING btree ("ten_tat");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "coaches_ten_tat_idx";
    ALTER TABLE "coaches" DROP COLUMN IF EXISTS "ten_tat";
    ALTER TABLE "coaches" DROP COLUMN IF EXISTS "ho_ten";
    ALTER TABLE "coaches" DROP COLUMN IF EXISTS "vai_tro";
    ALTER TABLE "coaches" DROP COLUMN IF EXISTS "sdt";
    ALTER TABLE "coaches" DROP COLUMN IF EXISTS "email";
    ALTER TABLE "coaches" DROP COLUMN IF EXISTS "elo";
    ALTER TABLE "coaches" DROP COLUMN IF EXISTS "trang_thai";
    DROP TYPE IF EXISTS "enum_coaches_vai_tro";
    DROP TYPE IF EXISTS "enum_coaches_trang_thai";
  `)
}
