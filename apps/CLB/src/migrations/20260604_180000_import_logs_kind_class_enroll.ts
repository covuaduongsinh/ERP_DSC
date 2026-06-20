import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Thêm 2 giá trị enum cho `import_logs.kind`: `classes` + `enrollments`
 * (công cụ import Lớp + Ghi danh). Additive idempotent — `ADD VALUE IF NOT EXISTS`.
 *
 * Postgres KHÔNG cho XÓA giá trị enum ⇒ `down()` để trống (no-op an toàn).
 * Áp bằng `payload migrate`/MCP.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "enum_import_logs_kind" ADD VALUE IF NOT EXISTS 'classes';
    ALTER TYPE "enum_import_logs_kind" ADD VALUE IF NOT EXISTS 'enrollments';
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Postgres không hỗ trợ DROP VALUE khỏi enum — no-op (giá trị thừa vô hại).
}
