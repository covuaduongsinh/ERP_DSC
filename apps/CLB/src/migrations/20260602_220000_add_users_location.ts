import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Users → thêm relationship `location` → locations (cột `location_id`).
 *
 * Nền cho phân quyền theo cơ sở 🔒: vai trò bị-khóa (coach/receptionist) chỉ
 * đọc/sửa Students + Classes cùng `location` của nhân viên. Cột NULL được —
 * vai trò global (admin/manager/accountant) không cần gán; vai trò bị-khóa chưa
 * gán ⇒ fail-closed ở tầng access (xem `apps/web/src/access/branch.ts`).
 *
 * Quy ước Payload db-postgres (khớp students.location_id / classes.location_id):
 *  - cột `location_id` integer, FK → locations(id) ON DELETE set null
 *  - index `users_location_idx`
 * DDL additive idempotent (IF NOT EXISTS / duplicate_object) — chạy lại an toàn.
 * Viết tay theo convention repo; KHÔNG push — áp bằng `payload migrate`.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "location_id" integer;

    DO $$ BEGIN
      ALTER TABLE "users"
        ADD CONSTRAINT "users_location_id_locations_id_fk"
        FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "users_location_idx"
      ON "users" USING btree ("location_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "users_location_idx";
    ALTER TABLE "users"
      DROP CONSTRAINT IF EXISTS "users_location_id_locations_id_fk";
    ALTER TABLE "users"
      DROP COLUMN IF EXISTS "location_id";
  `)
}
