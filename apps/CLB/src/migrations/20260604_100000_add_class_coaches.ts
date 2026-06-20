import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Classes → thêm 2 relationship tùy chọn về `coaches`:
 *  - `coach` (cột `coach_id`)      — Giáo viên phụ trách (GV chính)
 *  - `troGiang` (cột `tro_giang_id`) — Trợ giảng
 *
 * Lớp có thể có GV chính, chỉ trợ giảng, hoặc cả hai (cả 2 cột NULL được). Trước
 * đây "ai dạy lớp" chỉ suy ra từ `Attendance.coach` theo TỪNG buổi; field này cho
 * lớp một nguồn-sự-thật về người phụ trách.
 *
 * Quy ước Payload db-postgres (khớp classes.location_id):
 *  - cột integer, FK → coaches(id) ON DELETE set null (xóa GV ⇒ lớp gỡ liên kết)
 *  - index `classes_coach_idx` / `classes_tro_giang_idx`
 * DDL additive idempotent (IF NOT EXISTS / duplicate_object) — chạy lại an toàn.
 * Viết tay theo convention repo; KHÔNG push — áp bằng `payload migrate`.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "classes"
      ADD COLUMN IF NOT EXISTS "coach_id" integer;
    ALTER TABLE "classes"
      ADD COLUMN IF NOT EXISTS "tro_giang_id" integer;

    DO $$ BEGIN
      ALTER TABLE "classes"
        ADD CONSTRAINT "classes_coach_id_coaches_id_fk"
        FOREIGN KEY ("coach_id") REFERENCES "public"."coaches"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "classes"
        ADD CONSTRAINT "classes_tro_giang_id_coaches_id_fk"
        FOREIGN KEY ("tro_giang_id") REFERENCES "public"."coaches"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "classes_coach_idx"
      ON "classes" USING btree ("coach_id");
    CREATE INDEX IF NOT EXISTS "classes_tro_giang_idx"
      ON "classes" USING btree ("tro_giang_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "classes_coach_idx";
    DROP INDEX IF EXISTS "classes_tro_giang_idx";
    ALTER TABLE "classes"
      DROP CONSTRAINT IF EXISTS "classes_coach_id_coaches_id_fk";
    ALTER TABLE "classes"
      DROP CONSTRAINT IF EXISTS "classes_tro_giang_id_coaches_id_fk";
    ALTER TABLE "classes"
      DROP COLUMN IF EXISTS "coach_id";
    ALTER TABLE "classes"
      DROP COLUMN IF EXISTS "tro_giang_id";
  `)
}
