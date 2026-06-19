import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * Tách "Gói học phí" khỏi `classes` → collection độc lập `tuition_packages`.
 *
 * Trước đây là array nhúng `classes.tuitionTiers` ⇒ bảng con `classes_tuition_tiers`
 * (`_order`, `_parent_id`→classes, `id` varchar PK, `tier_name`, `session_count`,
 * `tuition`, `benefits`). Nay:
 *
 *  1. `tuition_packages` — collection chuẩn (mẫu `refunds`): id serial PK, timestamps,
 *     scalar tier_name/session_count/tuition/benefits. Đăng ký `payload_locked_documents_rels`.
 *  2. `tuition_packages_rels` — bảng nối hasMany (mẫu `payload_locked_documents_rels`)
 *     cho 2 quan hệ `classes`/`students`.
 *  3. CHUYỂN dữ liệu cũ: mỗi dòng `classes_tuition_tiers` → 1 `tuition_packages` + 1 rel
 *     path='classes' trỏ về lớp nguồn (giữ 1:1, KHÔNG gộp trùng). Rồi DROP bảng cũ.
 *
 * DDL additive idempotent (DROP chạy SAU khi đã copy trong cùng transaction). Viết tay
 * theo convention repo; KHÔNG push — áp bằng `payload migrate`/MCP.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- 1) Bảng collection chính
    CREATE TABLE IF NOT EXISTS "tuition_packages" (
      "id" serial PRIMARY KEY NOT NULL,
      "tier_name" varchar NOT NULL,
      "session_count" numeric NOT NULL,
      "tuition" numeric NOT NULL,
      "benefits" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "tuition_packages_updated_at_idx"
      ON "tuition_packages" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "tuition_packages_created_at_idx"
      ON "tuition_packages" USING btree ("created_at");

    -- 2) Bảng nối hasMany (classes / students)
    CREATE TABLE IF NOT EXISTS "tuition_packages_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "classes_id" integer,
      "students_id" integer
    );

    DO $$ BEGIN
      ALTER TABLE "tuition_packages_rels"
        ADD CONSTRAINT "tuition_packages_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."tuition_packages"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "tuition_packages_rels"
        ADD CONSTRAINT "tuition_packages_rels_classes_fk"
        FOREIGN KEY ("classes_id") REFERENCES "public"."classes"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "tuition_packages_rels"
        ADD CONSTRAINT "tuition_packages_rels_students_fk"
        FOREIGN KEY ("students_id") REFERENCES "public"."students"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "tuition_packages_rels_order_idx"
      ON "tuition_packages_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "tuition_packages_rels_parent_idx"
      ON "tuition_packages_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "tuition_packages_rels_path_idx"
      ON "tuition_packages_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "tuition_packages_rels_classes_id_idx"
      ON "tuition_packages_rels" USING btree ("classes_id");
    CREATE INDEX IF NOT EXISTS "tuition_packages_rels_students_id_idx"
      ON "tuition_packages_rels" USING btree ("students_id");

    -- 3) Đăng ký vào payload_locked_documents_rels
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "tuition_packages_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_tuition_packages_fk"
        FOREIGN KEY ("tuition_packages_id") REFERENCES "public"."tuition_packages"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_tuition_packages_id_idx"
      ON "payload_locked_documents_rels" USING btree ("tuition_packages_id");

    -- 4) CHUYỂN dữ liệu cũ (chạy trước DROP). Cột tạm giữ lớp nguồn để dựng rel.
    ALTER TABLE "tuition_packages" ADD COLUMN IF NOT EXISTS "_src_class_id" integer;

    INSERT INTO "tuition_packages"
      ("tier_name", "session_count", "tuition", "benefits", "_src_class_id", "updated_at", "created_at")
    SELECT "tier_name", "session_count", "tuition", "benefits", "_parent_id", now(), now()
    FROM "classes_tuition_tiers";

    INSERT INTO "tuition_packages_rels" ("order", "parent_id", "path", "classes_id")
    SELECT 1, "id", 'classes', "_src_class_id"
    FROM "tuition_packages"
    WHERE "_src_class_id" IS NOT NULL;

    ALTER TABLE "tuition_packages" DROP COLUMN "_src_class_id";

    -- 5) Dọn bảng cũ (field đã gỡ khỏi config ⇒ tránh schema drift)
    DROP TABLE IF EXISTS "classes_tuition_tiers";
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- Tạo lại bảng array cũ + copy ngược dữ liệu (qua rel path='classes')
    CREATE TABLE IF NOT EXISTS "classes_tuition_tiers" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "tier_name" varchar NOT NULL,
      "session_count" numeric NOT NULL,
      "tuition" numeric NOT NULL,
      "benefits" varchar
    );

    DO $$ BEGIN
      ALTER TABLE "classes_tuition_tiers"
        ADD CONSTRAINT "classes_tuition_tiers_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."classes"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "classes_tuition_tiers_order_idx"
      ON "classes_tuition_tiers" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "classes_tuition_tiers_parent_id_idx"
      ON "classes_tuition_tiers" USING btree ("_parent_id");

    INSERT INTO "classes_tuition_tiers"
      ("_order", "_parent_id", "id", "tier_name", "session_count", "tuition", "benefits")
    SELECT
      row_number() OVER (PARTITION BY r."classes_id" ORDER BY tp."id"),
      r."classes_id",
      tp."id"::varchar,
      tp."tier_name",
      tp."session_count",
      tp."tuition",
      tp."benefits"
    FROM "tuition_packages" tp
    JOIN "tuition_packages_rels" r
      ON r."parent_id" = tp."id" AND r."path" = 'classes'
    WHERE r."classes_id" IS NOT NULL;

    -- Gỡ đăng ký locked-docs + bảng mới
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_tuition_packages_fk";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "tuition_packages_id";

    DROP TABLE IF EXISTS "tuition_packages_rels" CASCADE;
    DROP TABLE IF EXISTS "tuition_packages" CASCADE;
  `);
}
