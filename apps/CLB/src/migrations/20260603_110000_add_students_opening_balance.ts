import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Students → thêm 2 cột số dư đầu kỳ cho đối soát "số buổi tồn":
 *   - `so_buoi_ton_dau_ky` (numeric, nullable) = số buổi tồn chốt thủ công.
 *   - `ngay_chot_so_du`    (timestamptz, nullable) = mốc chốt số dư.
 *
 * Khi CẢ HAI có giá trị, màn /admin/so-buoi-ton tính tồn theo công thức
 * `opening` (số dư đầu + buổi nộp sau − buổi học sau) thay vì "lần nộp gần nhất".
 *
 * Quy ước Payload db-postgres: tên cột = to-snake-case(field), kiểu number→numeric,
 * date→timestamp(3) with time zone. Additive, nullable; DDL idempotent
 * (ADD/DROP COLUMN IF [NOT] EXISTS) ⇒ chạy lại an toàn.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "so_buoi_ton_dau_ky" numeric;
    ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "ngay_chot_so_du" timestamp(3) with time zone;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "students" DROP COLUMN IF EXISTS "so_buoi_ton_dau_ky";
    ALTER TABLE "students" DROP COLUMN IF EXISTS "ngay_chot_so_du";
  `)
}
