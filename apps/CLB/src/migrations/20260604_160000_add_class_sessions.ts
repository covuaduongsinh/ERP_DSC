import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Thêm collection `class_sessions` (Buổi học) — xương sống vận hành lớp (Phase 2).
 *
 * MỘT buổi = MỘT lớp diễn ra MỘT ngày. Sinh theo nhu cầu từ `classes.lichHoc`
 * (ensureSession), idempotent qua `khoa_buoi` (unique). Mọi quan hệ là 1-1
 * (hasMany:false) ⇒ FK trực tiếp trên bảng, KHÔNG cần bảng `_rels`.
 *
 *  - `lop_id` → classes ON DELETE cascade (lop là bắt buộc; xóa lớp ⇒ xóa buổi).
 *  - `coach_thuc_te_id` / `tro_giang_thuc_te_id` → coaches ON DELETE SET NULL.
 *  - `buoi_goc_id` → class_sessions (self) ON DELETE SET NULL (buổi bù trỏ buổi gốc).
 *  - `khoa_buoi` UNIQUE (Postgres cho phép nhiều NULL) — khóa idempotent sinh buổi.
 *  - Đăng ký vào `payload_locked_documents_rels` (mẫu refunds).
 *
 * DDL additive idempotent. Viết tay theo convention repo; KHÔNG push — áp bằng
 * `payload migrate`/MCP.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_class_sessions_thu" AS ENUM('t2','t3','t4','t5','t6','t7','cn');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "enum_class_sessions_trang_thai" AS ENUM('du_kien','da_day','huy','bu');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE TABLE IF NOT EXISTS "class_sessions" (
      "id" serial PRIMARY KEY NOT NULL,
      "lop_id" integer NOT NULL,
      "date" timestamp(3) with time zone NOT NULL,
      "thu" "enum_class_sessions_thu",
      "gio_bat_dau" varchar,
      "gio_ket_thuc" varchar,
      "phong" varchar,
      "coach_thuc_te_id" integer,
      "tro_giang_thuc_te_id" integer,
      "trang_thai" "enum_class_sessions_trang_thai" DEFAULT 'du_kien' NOT NULL,
      "kien_thuc_moi" varchar,
      "giao_b_t_v_n" varchar,
      "kh_buoi_sau" varchar,
      "sach_dang_hoc" varchar,
      "ghi_chu_buoi" varchar,
      "buoi_goc_id" integer,
      "khoa_buoi" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "class_sessions"
        ADD CONSTRAINT "class_sessions_lop_id_classes_id_fk"
        FOREIGN KEY ("lop_id") REFERENCES "public"."classes"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "class_sessions"
        ADD CONSTRAINT "class_sessions_coach_thuc_te_id_coaches_id_fk"
        FOREIGN KEY ("coach_thuc_te_id") REFERENCES "public"."coaches"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "class_sessions"
        ADD CONSTRAINT "class_sessions_tro_giang_thuc_te_id_coaches_id_fk"
        FOREIGN KEY ("tro_giang_thuc_te_id") REFERENCES "public"."coaches"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "class_sessions"
        ADD CONSTRAINT "class_sessions_buoi_goc_id_class_sessions_id_fk"
        FOREIGN KEY ("buoi_goc_id") REFERENCES "public"."class_sessions"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "class_sessions_lop_idx"
      ON "class_sessions" USING btree ("lop_id");
    CREATE INDEX IF NOT EXISTS "class_sessions_date_idx"
      ON "class_sessions" USING btree ("date");
    CREATE INDEX IF NOT EXISTS "class_sessions_coach_thuc_te_idx"
      ON "class_sessions" USING btree ("coach_thuc_te_id");
    CREATE INDEX IF NOT EXISTS "class_sessions_updated_at_idx"
      ON "class_sessions" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "class_sessions_created_at_idx"
      ON "class_sessions" USING btree ("created_at");
    CREATE UNIQUE INDEX IF NOT EXISTS "class_sessions_khoa_buoi_idx"
      ON "class_sessions" USING btree ("khoa_buoi");

    -- Đăng ký vào payload_locked_documents_rels (mẫu refunds)
    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "class_sessions_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_class_sessions_fk"
        FOREIGN KEY ("class_sessions_id") REFERENCES "public"."class_sessions"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_class_sessions_id_idx"
      ON "payload_locked_documents_rels" USING btree ("class_sessions_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_class_sessions_fk";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "class_sessions_id";

    DROP TABLE IF EXISTS "class_sessions" CASCADE;
    DROP TYPE IF EXISTS "enum_class_sessions_thu";
    DROP TYPE IF EXISTS "enum_class_sessions_trang_thai";
  `)
}
