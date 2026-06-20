import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Thêm collection `session_student_plans` (Kế hoạch buổi theo HV — V1.1).
 *
 * MỘT dòng = (buổi × HV). Chỉ lưu OVERRIDE nội dung cá nhân (kế thừa nội dung cả
 * lớp ở class_sessions khi trống). Quan hệ 1-1 ⇒ FK trực tiếp, KHÔNG bảng `_rels`.
 *  - `session_id` → class_sessions ON DELETE cascade (xóa buổi ⇒ xóa kế hoạch HV).
 *  - `student_id` → students ON DELETE cascade.
 *  - `khoa_ke_hoach` UNIQUE (`session|student`) — khóa idempotent upsert.
 * Cột camelCase hoa-liên-tiếp: `giaoBTVN` → `giao_b_t_v_n` (convention Payload).
 *
 * 🔒 KHÔNG đụng `attendance`/`tuition_cycles` — không ảnh hưởng đếm buổi/tính phí.
 * DDL additive idempotent. Áp bằng `payload migrate`/MCP (KHÔNG push).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "session_student_plans" (
      "id" serial PRIMARY KEY NOT NULL,
      "session_id" integer NOT NULL,
      "student_id" integer NOT NULL,
      "sach_dang_hoc" varchar,
      "kien_thuc_moi" varchar,
      "giao_b_t_v_n" varchar,
      "kh_buoi_sau" varchar,
      "khoa_ke_hoach" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "session_student_plans"
        ADD CONSTRAINT "session_student_plans_session_id_class_sessions_id_fk"
        FOREIGN KEY ("session_id") REFERENCES "public"."class_sessions"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "session_student_plans"
        ADD CONSTRAINT "session_student_plans_student_id_students_id_fk"
        FOREIGN KEY ("student_id") REFERENCES "public"."students"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "session_student_plans_session_idx"
      ON "session_student_plans" USING btree ("session_id");
    CREATE INDEX IF NOT EXISTS "session_student_plans_student_idx"
      ON "session_student_plans" USING btree ("student_id");
    CREATE INDEX IF NOT EXISTS "session_student_plans_updated_at_idx"
      ON "session_student_plans" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "session_student_plans_created_at_idx"
      ON "session_student_plans" USING btree ("created_at");
    CREATE UNIQUE INDEX IF NOT EXISTS "session_student_plans_khoa_ke_hoach_idx"
      ON "session_student_plans" USING btree ("khoa_ke_hoach");

    -- Đăng ký vào payload_locked_documents_rels (mẫu class_sessions)
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "session_student_plans_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_session_student_plans_fk"
        FOREIGN KEY ("session_student_plans_id") REFERENCES "public"."session_student_plans"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_session_student_plans_id_idx"
      ON "payload_locked_documents_rels" USING btree ("session_student_plans_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_session_student_plans_fk";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "session_student_plans_id";

    DROP TABLE IF EXISTS "session_student_plans" CASCADE;
  `)
}
