import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Thêm cột `ten_tat_alias` cho `coaches`: các cách viết tắt khác của GV (ngăn
 * cách bởi dấu phẩy) để import nhận xét buổi khớp cả bí danh — gom đúng một
 * người khi file ghi nhiều dạng (vd "Phương Anh" / "P.Anh" / "Panh" / "Phanh").
 * Additive, NULLABLE, idempotent.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "coaches" ADD COLUMN IF NOT EXISTS "ten_tat_alias" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "coaches" DROP COLUMN IF EXISTS "ten_tat_alias";
  `)
}
