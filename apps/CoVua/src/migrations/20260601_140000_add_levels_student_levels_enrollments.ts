import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * Thêm 3 collection: levels, student_levels, enrollments + refactor students.
 *
 * - levels: danh mục cấp độ (ten_tat unique, ten_day_du, thu_tu).
 * - student_levels: lịch sử cấp độ của học viên (student→students, level→levels,
 *   trang_thai enum, ngay_bat_dau). Access: phụ huynh chỉ đọc bản ghi con mình.
 * - enrollments: ghi danh lớp (student→students, class→classes, ngay_bat_dau,
 *   ngay_ket_thuc, dang_hoc). Access: phụ huynh chỉ đọc bản ghi con mình.
 * - students: BỎ current_level (enum) và class_id; THÊM cap_chinh_id (→levels).
 *
 * Quy ước theo Payload db-postgres: FK ON DELETE set null, index
 * `<table>_<field>_idx`, đăng ký vào payload_locked_documents_rels. DDL
 * idempotent (IF NOT EXISTS / DO $$ duplicate_object) — chạy lại an toàn.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- ── levels ────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS "levels" (
      "id" serial PRIMARY KEY NOT NULL,
      "ten_tat" varchar NOT NULL,
      "ten_day_du" varchar,
      "thu_tu" numeric,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "levels_ten_tat_idx" ON "levels" USING btree ("ten_tat");
    CREATE INDEX IF NOT EXISTS "levels_updated_at_idx" ON "levels" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "levels_created_at_idx" ON "levels" USING btree ("created_at");

    -- ── student_levels ────────────────────────────────────────────────────
    DO $$ BEGIN
      CREATE TYPE "public"."enum_student_levels_trang_thai" AS ENUM('dang_hoc', 'da_hoan_thanh');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "student_levels" (
      "id" serial PRIMARY KEY NOT NULL,
      "student_id" integer NOT NULL,
      "level_id" integer NOT NULL,
      "trang_thai" "enum_student_levels_trang_thai",
      "ngay_bat_dau" timestamp(3) with time zone,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "student_levels"
        ADD CONSTRAINT "student_levels_student_id_students_id_fk"
        FOREIGN KEY ("student_id") REFERENCES "public"."students"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "student_levels"
        ADD CONSTRAINT "student_levels_level_id_levels_id_fk"
        FOREIGN KEY ("level_id") REFERENCES "public"."levels"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "student_levels_student_idx" ON "student_levels" USING btree ("student_id");
    CREATE INDEX IF NOT EXISTS "student_levels_level_idx" ON "student_levels" USING btree ("level_id");
    CREATE INDEX IF NOT EXISTS "student_levels_updated_at_idx" ON "student_levels" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "student_levels_created_at_idx" ON "student_levels" USING btree ("created_at");

    -- ── enrollments ───────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS "enrollments" (
      "id" serial PRIMARY KEY NOT NULL,
      "student_id" integer NOT NULL,
      "class_id" integer NOT NULL,
      "ngay_bat_dau" timestamp(3) with time zone,
      "ngay_ket_thuc" timestamp(3) with time zone,
      "dang_hoc" boolean,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "enrollments"
        ADD CONSTRAINT "enrollments_student_id_students_id_fk"
        FOREIGN KEY ("student_id") REFERENCES "public"."students"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "enrollments"
        ADD CONSTRAINT "enrollments_class_id_classes_id_fk"
        FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "enrollments_student_idx" ON "enrollments" USING btree ("student_id");
    CREATE INDEX IF NOT EXISTS "enrollments_class_idx" ON "enrollments" USING btree ("class_id");
    CREATE INDEX IF NOT EXISTS "enrollments_updated_at_idx" ON "enrollments" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "enrollments_created_at_idx" ON "enrollments" USING btree ("created_at");

    -- ── students: thêm cap_chinh_id, bỏ class_id + current_level ────────────
    ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "cap_chinh_id" integer;

    DO $$ BEGIN
      ALTER TABLE "students"
        ADD CONSTRAINT "students_cap_chinh_id_levels_id_fk"
        FOREIGN KEY ("cap_chinh_id") REFERENCES "public"."levels"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "students_cap_chinh_idx" ON "students" USING btree ("cap_chinh_id");

    DROP INDEX IF EXISTS "students_class_idx";
    ALTER TABLE "students" DROP CONSTRAINT IF EXISTS "students_class_id_classes_id_fk";
    ALTER TABLE "students" DROP COLUMN IF EXISTS "class_id";
    ALTER TABLE "students" DROP COLUMN IF EXISTS "current_level";
    DROP TYPE IF EXISTS "public"."enum_students_current_level";

    -- ── payload_locked_documents_rels: đăng ký 3 collection mới ─────────────
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "levels_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "student_levels_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "enrollments_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_levels_fk"
        FOREIGN KEY ("levels_id") REFERENCES "public"."levels"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_student_levels_fk"
        FOREIGN KEY ("student_levels_id") REFERENCES "public"."student_levels"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_enrollments_fk"
        FOREIGN KEY ("enrollments_id") REFERENCES "public"."enrollments"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_levels_id_idx"
      ON "payload_locked_documents_rels" USING btree ("levels_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_student_levels_id_idx"
      ON "payload_locked_documents_rels" USING btree ("student_levels_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_enrollments_id_idx"
      ON "payload_locked_documents_rels" USING btree ("enrollments_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- payload_locked_documents_rels
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_enrollments_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_student_levels_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_levels_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "enrollments_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "student_levels_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "levels_id";

    -- students rollback (tạo lại enum + cột; KHÔNG khôi phục được dữ liệu cũ)
    ALTER TABLE "students" DROP CONSTRAINT IF EXISTS "students_cap_chinh_id_levels_id_fk";
    DROP INDEX IF EXISTS "students_cap_chinh_idx";
    ALTER TABLE "students" DROP COLUMN IF EXISTS "cap_chinh_id";

    DO $$ BEGIN
      CREATE TYPE "public"."enum_students_current_level" AS ENUM('tot', 'ma', 'tuong', 'xe', 'hau', 'vua');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "current_level" "enum_students_current_level";
    ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "class_id" integer;
    DO $$ BEGIN
      ALTER TABLE "students"
        ADD CONSTRAINT "students_class_id_classes_id_fk"
        FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
    CREATE INDEX IF NOT EXISTS "students_class_idx" ON "students" USING btree ("class_id");

    -- drop new tables
    DROP TABLE IF EXISTS "enrollments" CASCADE;
    DROP TABLE IF EXISTS "student_levels" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_student_levels_trang_thai";
    DROP TABLE IF EXISTS "levels" CASCADE;
  `);
}
