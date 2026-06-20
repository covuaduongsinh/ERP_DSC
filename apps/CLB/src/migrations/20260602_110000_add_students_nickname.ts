import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Students → thêm cột `nickname` (biệt danh / ghi chú nhận diện từ sổ gốc).
 *
 * Phục vụ import HocVien_goc.csv (cột "nick" → nickname). Additive, nullable —
 * DDL idempotent (`ADD COLUMN IF NOT EXISTS`) nên chạy lại an toàn.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "nickname" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "students" DROP COLUMN IF EXISTS "nickname";
  `)
}
