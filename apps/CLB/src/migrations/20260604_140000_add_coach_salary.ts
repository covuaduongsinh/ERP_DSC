import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Coaches → `luong_moi_buoi` (numeric, NULL được): đơn giá/buổi đứng lớp, dùng
 * tính BẢNG LƯƠNG (số buổi distinct × đơn giá). Field khóa field-level chỉ tài
 * chính đọc (xem `collections/Coaches.ts`). DDL additive idempotent.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "coaches"
      ADD COLUMN IF NOT EXISTS "luong_moi_buoi" numeric;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "coaches"
      DROP COLUMN IF EXISTS "luong_moi_buoi";
  `)
}
