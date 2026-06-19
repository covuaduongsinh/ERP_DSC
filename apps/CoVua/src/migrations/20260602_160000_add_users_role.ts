import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * Users → thêm field `role` (select: admin/manager/coach/accountant/receptionist).
 *
 * Required + defaultValue 'receptionist' → cột NOT NULL DEFAULT 'receptionist',
 * nên các tài khoản nhân viên hiện có được điền 'receptionist' tự động (quyền
 * thấp nhất — an toàn theo nguyên tắc least-privilege).
 *
 * Viết tay theo convention repo (KHÔNG dùng auto-generate): `payload migrate:create`
 * bị chặn ở prompt tương tác và còn gộp nhầm drift không liên quan
 * (`enum_students_current_level` mồ côi từ refactor Levels — KHÔNG đụng ở đây).
 *
 * Quy ước Payload db-postgres: tên cột = to-snake-case(field) ('role' giữ nguyên),
 * enum `enum_<table>_<column>`. DDL idempotent (DO $$ duplicate_object /
 * IF NOT EXISTS) — chạy lại an toàn. KHÔNG push; áp bằng `payload migrate` sau.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'manager', 'coach', 'accountant', 'receptionist');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "role" "enum_users_role" DEFAULT 'receptionist' NOT NULL;
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" DROP COLUMN IF EXISTS "role";
    DROP TYPE IF EXISTS "enum_users_role";
  `);
}
