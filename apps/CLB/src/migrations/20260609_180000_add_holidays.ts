import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * LỊCH NGHỈ LỄ (Đợt 1) — collection `holidays`:
 *   id serial PK, ten_ngay_nghi (NOT NULL), tu_ngay/den_ngay (timestamptz),
 *   location_id (FK→locations, ON DELETE set null; null = toàn công ty),
 *   kich_hoat boolean DEFAULT true, ghi_chu, created_at/updated_at.
 * Đăng ký vào `payload_locked_documents_rels` (mẫu class_sessions/curriculum_templates).
 *
 * 🔒 KHÔNG đụng `attendance`/`tuition_cycles` — lịch nghỉ chỉ lọc ở tầng lập kế
 * hoạch buổi, không ảnh hưởng đếm buổi/tính phí. DDL additive idempotent. Áp bằng
 * `payload migrate`/MCP (KHÔNG push).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- 1) Bảng lịch nghỉ
    CREATE TABLE IF NOT EXISTS "holidays" (
      "id" serial PRIMARY KEY NOT NULL,
      "ten_ngay_nghi" varchar NOT NULL,
      "tu_ngay" timestamp(3) with time zone NOT NULL,
      "den_ngay" timestamp(3) with time zone,
      "location_id" integer,
      "kich_hoat" boolean DEFAULT true,
      "ghi_chu" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    -- 2) FK cơ sở (null = toàn công ty)
    DO $$ BEGIN
      ALTER TABLE "holidays"
        ADD CONSTRAINT "holidays_location_id_locations_id_fk"
        FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    -- 3) Index
    CREATE INDEX IF NOT EXISTS "holidays_location_idx"
      ON "holidays" USING btree ("location_id");
    CREATE INDEX IF NOT EXISTS "holidays_tu_ngay_idx"
      ON "holidays" USING btree ("tu_ngay");
    CREATE INDEX IF NOT EXISTS "holidays_updated_at_idx"
      ON "holidays" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "holidays_created_at_idx"
      ON "holidays" USING btree ("created_at");

    -- 4) Đăng ký vào payload_locked_documents_rels (mẫu class_sessions)
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "holidays_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_holidays_fk"
        FOREIGN KEY ("holidays_id") REFERENCES "public"."holidays"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_holidays_id_idx"
      ON "payload_locked_documents_rels" USING btree ("holidays_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_holidays_fk";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "holidays_id";

    DROP TABLE IF EXISTS "holidays" CASCADE;
  `)
}
