import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Lớp "Nội dung website" (curated) — 3 collection mới, tách khỏi dữ liệu vận hành:
 *  - `web_locations`  — lịch học theo cơ sở (+ bảng con array `web_locations_lich_hoc_gio`)
 *  - `web_coaches`    — HLV hiển thị web (upload photo→media, richText bio, array `web_coaches_titles`)
 *  - `web_programs`   — tuyến lớp đang tuyển (Nhập môn/Cơ bản/Nâng cao)
 *
 * Không có quan hệ hasMany ⇒ KHÔNG cần bảng `*_rels`. Mỗi collection được đăng ký vào
 * `payload_locked_documents_rels` (khóa tài liệu khi admin sửa). DDL additive idempotent
 * (IF NOT EXISTS / guard duplicate_object) — viết tay theo convention repo, áp bằng
 * `payload migrate` hoặc Supabase apply_migration. KHÔNG push.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ── web_programs ──────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS "web_programs" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "short_desc" varchar,
      "order" numeric DEFAULT 0,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "web_programs_updated_at_idx" ON "web_programs" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "web_programs_created_at_idx" ON "web_programs" USING btree ("created_at");

    -- ── web_locations ─────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS "web_locations" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "address" varchar NOT NULL,
      "map_url" varchar,
      "lich_hoc_ngay" varchar,
      "order" numeric DEFAULT 0,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "web_locations_updated_at_idx" ON "web_locations" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "web_locations_created_at_idx" ON "web_locations" USING btree ("created_at");

    CREATE TABLE IF NOT EXISTS "web_locations_lich_hoc_gio" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "gio" varchar NOT NULL
    );
    DO $$ BEGIN
      ALTER TABLE "web_locations_lich_hoc_gio"
        ADD CONSTRAINT "web_locations_lich_hoc_gio_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."web_locations"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "web_locations_lich_hoc_gio_order_idx" ON "web_locations_lich_hoc_gio" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "web_locations_lich_hoc_gio_parent_id_idx" ON "web_locations_lich_hoc_gio" USING btree ("_parent_id");

    -- ── web_coaches ───────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS "web_coaches" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "photo_id" integer,
      "role" varchar,
      "bio" jsonb,
      "order" numeric DEFAULT 0,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    DO $$ BEGIN
      ALTER TABLE "web_coaches"
        ADD CONSTRAINT "web_coaches_photo_id_media_id_fk"
        FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "web_coaches_photo_id_idx" ON "web_coaches" USING btree ("photo_id");
    CREATE INDEX IF NOT EXISTS "web_coaches_updated_at_idx" ON "web_coaches" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "web_coaches_created_at_idx" ON "web_coaches" USING btree ("created_at");

    CREATE TABLE IF NOT EXISTS "web_coaches_titles" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "title" varchar NOT NULL
    );
    DO $$ BEGIN
      ALTER TABLE "web_coaches_titles"
        ADD CONSTRAINT "web_coaches_titles_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."web_coaches"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "web_coaches_titles_order_idx" ON "web_coaches_titles" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "web_coaches_titles_parent_id_idx" ON "web_coaches_titles" USING btree ("_parent_id");

    -- ── Đăng ký vào payload_locked_documents_rels ─────────────────
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "web_locations_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "web_coaches_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "web_programs_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_web_locations_fk"
        FOREIGN KEY ("web_locations_id") REFERENCES "public"."web_locations"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_web_coaches_fk"
        FOREIGN KEY ("web_coaches_id") REFERENCES "public"."web_coaches"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_web_programs_fk"
        FOREIGN KEY ("web_programs_id") REFERENCES "public"."web_programs"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_web_locations_id_idx" ON "payload_locked_documents_rels" USING btree ("web_locations_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_web_coaches_id_idx" ON "payload_locked_documents_rels" USING btree ("web_coaches_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_web_programs_id_idx" ON "payload_locked_documents_rels" USING btree ("web_programs_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_web_locations_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_web_coaches_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_web_programs_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "web_locations_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "web_coaches_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "web_programs_id";

    DROP TABLE IF EXISTS "web_locations_lich_hoc_gio" CASCADE;
    DROP TABLE IF EXISTS "web_coaches_titles" CASCADE;
    DROP TABLE IF EXISTS "web_locations" CASCADE;
    DROP TABLE IF EXISTS "web_coaches" CASCADE;
    DROP TABLE IF EXISTS "web_programs" CASCADE;
  `)
}
