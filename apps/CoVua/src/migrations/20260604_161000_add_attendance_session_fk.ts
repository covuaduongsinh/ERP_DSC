import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * Nối `attendance` ↔ `class_sessions`: thêm FK `session_id` (1-1, nullable).
 *
 * Chồng-thêm-không-phá: KHÔNG đụng `khoa` (khóa import) hay cột nào khác. Bản ghi
 * điểm danh cũ / không có lớp để `session_id` NULL. ON DELETE SET NULL ⇒ xóa buổi
 * không xóa lịch sử điểm danh. Phải chạy SAU `20260604_160000_add_class_sessions`
 * (FK tham chiếu bảng class_sessions).
 *
 * DDL additive idempotent. Viết tay theo convention repo; áp bằng `payload migrate`/MCP.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "session_id" integer;

    DO $$ BEGIN
      ALTER TABLE "attendance"
        ADD CONSTRAINT "attendance_session_id_class_sessions_id_fk"
        FOREIGN KEY ("session_id") REFERENCES "public"."class_sessions"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "attendance_session_idx"
      ON "attendance" USING btree ("session_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "attendance_session_idx";
    ALTER TABLE "attendance" DROP CONSTRAINT IF EXISTS "attendance_session_id_class_sessions_id_fk";
    ALTER TABLE "attendance" DROP COLUMN IF EXISTS "session_id";
  `);
}
