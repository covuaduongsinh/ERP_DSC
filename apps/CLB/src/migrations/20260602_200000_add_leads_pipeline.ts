import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Leads → pipeline chăm sóc: `assignedTo`, `nextFollowUpAt`, `activityLog`
 * (array) + dấu vết chuyển đổi (`convertedAt`, `convertedParent`,
 * `convertedStudent`). MIGRATION THUẦN ADDITIVE — bảng `leads` đã có sẵn (tạo qua
 * push GĐ trước); ở đây chỉ thêm cột + bảng con của array.
 *
 * Quy ước Payload db-postgres (đã đối chiếu schema thật của repo này):
 *  - Quan hệ đơn (không hasMany/không polymorphic) ⇒ cột FK trực tiếp `<field>_id`
 *    (vd students.cap_chinh_id, location_id). Nên assignedTo→users = `assigned_to_id`.
 *  - Array field ⇒ bảng con `<table>_<field>` với `_order, _parent_id, id(varchar PK)`
 *    + cột scalar; quan hệ đơn bên trong array cũng là cột `<field>_id` trên bảng con
 *    (chưa có array nào trong repo chứa quan hệ để đối chiếu trực tiếp ⇒ theo đúng
 *    quy ước Payload). Tên: enum `enum_<table>_<column>`, index `<table>_<field>_idx`,
 *    FK `<table>_<col>_<target>_id_fk`.
 *  - FK quan hệ ON DELETE set null (nhất quán renewal_requests/payments).
 *
 * DDL idempotent (DO $$ duplicate_object / IF NOT EXISTS) — chạy lại an toàn.
 * KHÔNG push; áp bằng `payload migrate` sau khi review.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- enum cho activityLog.type
    DO $$ BEGIN
      CREATE TYPE "public"."enum_leads_activity_log_type" AS ENUM('lien_he', 'ghi_chu', 'doi_giai_doan', 'hen_lich', 'chuyen_doi', 'khac');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- cột pipeline + dấu vết chuyển đổi trên leads
    ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "assigned_to_id" integer;
    ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "next_follow_up_at" timestamp(3) with time zone;
    ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "converted_at" timestamp(3) with time zone;
    ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "converted_parent_id" integer;
    ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "converted_student_id" integer;

    DO $$ BEGIN
      ALTER TABLE "leads"
        ADD CONSTRAINT "leads_assigned_to_id_users_id_fk"
        FOREIGN KEY ("assigned_to_id") REFERENCES "public"."users"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "leads"
        ADD CONSTRAINT "leads_converted_parent_id_parents_id_fk"
        FOREIGN KEY ("converted_parent_id") REFERENCES "public"."parents"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "leads"
        ADD CONSTRAINT "leads_converted_student_id_students_id_fk"
        FOREIGN KEY ("converted_student_id") REFERENCES "public"."students"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "leads_assigned_to_idx"
      ON "leads" USING btree ("assigned_to_id");
    CREATE INDEX IF NOT EXISTS "leads_converted_parent_idx"
      ON "leads" USING btree ("converted_parent_id");
    CREATE INDEX IF NOT EXISTS "leads_converted_student_idx"
      ON "leads" USING btree ("converted_student_id");

    -- bảng con cho array activityLog
    CREATE TABLE IF NOT EXISTS "leads_activity_log" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "type" "enum_leads_activity_log_type" DEFAULT 'ghi_chu' NOT NULL,
      "at" timestamp(3) with time zone,
      "note" varchar,
      "by_id" integer
    );

    DO $$ BEGIN
      ALTER TABLE "leads_activity_log"
        ADD CONSTRAINT "leads_activity_log_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."leads"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "leads_activity_log"
        ADD CONSTRAINT "leads_activity_log_by_id_users_id_fk"
        FOREIGN KEY ("by_id") REFERENCES "public"."users"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "leads_activity_log_order_idx"
      ON "leads_activity_log" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "leads_activity_log_parent_id_idx"
      ON "leads_activity_log" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "leads_activity_log_by_idx"
      ON "leads_activity_log" USING btree ("by_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "leads_activity_log" CASCADE;

    ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_assigned_to_id_users_id_fk";
    ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_converted_parent_id_parents_id_fk";
    ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_converted_student_id_students_id_fk";

    ALTER TABLE "leads" DROP COLUMN IF EXISTS "assigned_to_id";
    ALTER TABLE "leads" DROP COLUMN IF EXISTS "next_follow_up_at";
    ALTER TABLE "leads" DROP COLUMN IF EXISTS "converted_at";
    ALTER TABLE "leads" DROP COLUMN IF EXISTS "converted_parent_id";
    ALTER TABLE "leads" DROP COLUMN IF EXISTS "converted_student_id";

    DROP TYPE IF EXISTS "enum_leads_activity_log_type";
  `)
}
