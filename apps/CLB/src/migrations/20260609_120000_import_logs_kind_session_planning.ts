import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Thêm giá trị enum `session-planning` cho `import_logs.kind` — nhật ký tổng kết
 * mỗi lần "Lập kế hoạch buổi học" sinh chuỗi buổi dự kiến. Additive idempotent —
 * `ADD VALUE IF NOT EXISTS` (mẫu 20260604_180000).
 *
 * Postgres KHÔNG cho XÓA giá trị enum ⇒ `down()` để trống (no-op an toàn).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "enum_import_logs_kind" ADD VALUE IF NOT EXISTS 'session-planning';
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Postgres không hỗ trợ DROP VALUE khỏi enum — no-op (giá trị thừa vô hại).
}
