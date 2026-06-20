import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * KHUNG LỘ TRÌNH / giáo trình mẫu theo cấp (V2).
 *
 *  1. Thêm cột `muc_tieu` (Mục tiêu — field hạng nhất) vào `class_sessions` và
 *     `session_student_plans` (override theo HV). Thuần additive, nullable.
 *  2. Collection `curriculum_templates` (id serial PK, ten_khung, cap_do enum,
 *     tuyen enum?, mo_ta, trang_thai enum) — TÀI SẢN DÙNG CHUNG, KHÔNG branch-scope.
 *  3. Bảng con array `curriculum_templates_bai_hoc` (mẫu `classes_lich_hoc`):
 *     `_order` int, `_parent_id` int FK→curriculum_templates ON DELETE cascade,
 *     `id` varchar PK, + cột nội dung bài. Cột HOA-liên-tiếp: `giaoBTVN`→`giao_b_t_v_n`.
 *  4. Đăng ký vào `payload_locked_documents_rels` (mẫu class_sessions).
 *
 * 🔒 KHÔNG đụng `attendance`/`tuition_cycles` — không ảnh hưởng đếm buổi/tính phí.
 * DDL additive idempotent. Áp bằng `payload migrate`/MCP (KHÔNG push).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- 1) Field Mục tiêu (hạng nhất) ở buổi + override theo HV
    ALTER TABLE "class_sessions" ADD COLUMN IF NOT EXISTS "muc_tieu" varchar;
    ALTER TABLE "session_student_plans" ADD COLUMN IF NOT EXISTS "muc_tieu" varchar;

    -- 2) Enum cho khung lộ trình
    DO $$ BEGIN
      CREATE TYPE "enum_curriculum_templates_cap_do" AS ENUM('tot','ma','tuong','xe','hau','vua');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "enum_curriculum_templates_tuyen" AS ENUM('nhap_mon','co_ban','nang_cao');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "enum_curriculum_templates_trang_thai" AS ENUM('dang_dung','luu_tru');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    -- 3) Bảng khung
    CREATE TABLE IF NOT EXISTS "curriculum_templates" (
      "id" serial PRIMARY KEY NOT NULL,
      "ten_khung" varchar NOT NULL,
      "cap_do" "enum_curriculum_templates_cap_do" NOT NULL,
      "tuyen" "enum_curriculum_templates_tuyen",
      "mo_ta" varchar,
      "trang_thai" "enum_curriculum_templates_trang_thai" DEFAULT 'dang_dung',
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "curriculum_templates_updated_at_idx"
      ON "curriculum_templates" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "curriculum_templates_created_at_idx"
      ON "curriculum_templates" USING btree ("created_at");

    -- 4) Bảng con array bài mẫu (mẫu classes_lich_hoc)
    CREATE TABLE IF NOT EXISTS "curriculum_templates_bai_hoc" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "tieu_de" varchar,
      "muc_tieu" varchar,
      "kien_thuc_moi" varchar,
      "giao_b_t_v_n" varchar,
      "sach_dang_hoc" varchar,
      "ghi_chu" varchar,
      "nguon_ref" varchar
    );

    DO $$ BEGIN
      ALTER TABLE "curriculum_templates_bai_hoc"
        ADD CONSTRAINT "curriculum_templates_bai_hoc_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."curriculum_templates"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "curriculum_templates_bai_hoc_order_idx"
      ON "curriculum_templates_bai_hoc" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "curriculum_templates_bai_hoc_parent_id_idx"
      ON "curriculum_templates_bai_hoc" USING btree ("_parent_id");

    -- 5) Đăng ký vào payload_locked_documents_rels (mẫu class_sessions)
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "curriculum_templates_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_curriculum_templates_fk"
        FOREIGN KEY ("curriculum_templates_id") REFERENCES "public"."curriculum_templates"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_curriculum_templates_id_idx"
      ON "payload_locked_documents_rels" USING btree ("curriculum_templates_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_curriculum_templates_fk";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "curriculum_templates_id";

    DROP TABLE IF EXISTS "curriculum_templates_bai_hoc" CASCADE;
    DROP TABLE IF EXISTS "curriculum_templates" CASCADE;
    DROP TYPE IF EXISTS "enum_curriculum_templates_cap_do";
    DROP TYPE IF EXISTS "enum_curriculum_templates_tuyen";
    DROP TYPE IF EXISTS "enum_curriculum_templates_trang_thai";

    ALTER TABLE "class_sessions" DROP COLUMN IF EXISTS "muc_tieu";
    ALTER TABLE "session_student_plans" DROP COLUMN IF EXISTS "muc_tieu";
  `)
}
