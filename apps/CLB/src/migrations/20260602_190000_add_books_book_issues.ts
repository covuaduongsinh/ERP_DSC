import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Thêm collection `books` (catalog sách nội bộ) + `book-issues` (sổ phát sách
 * cho HV). MIGRATION THUẦN ADDITIVE (nguồn: Lark CRM, ngoài scope GĐ1).
 *
 * - books: code (NOT NULL, unique), title (NOT NULL), cover_price / sale_price
 *   (numeric, nullable), level_summary (varchar). Chỉ staff đọc/ghi (giá nội bộ).
 * - book_issues: student→students (NOT NULL), book→books (nullable), ngay_dung
 *   (timestamptz), gia_sach / uu_dai / tien_sach (numeric), co_so (enum), lark_code
 *   (varchar, index), ghi_chu (varchar). Chỉ staff đọc/ghi.
 *
 * Quy ước Payload db-postgres: cột = to-snake-case(field), enum
 * `enum_<table>_<column>`, FK ON DELETE set null, đăng ký vào
 * payload_locked_documents_rels. DDL idempotent (IF NOT EXISTS / duplicate_object).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_book_issues_co_so" AS ENUM('kim_lien', 'vinh_phuc');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "books" (
      "id" serial PRIMARY KEY NOT NULL,
      "code" varchar NOT NULL,
      "title" varchar NOT NULL,
      "cover_price" numeric,
      "sale_price" numeric,
      "level_summary" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "book_issues" (
      "id" serial PRIMARY KEY NOT NULL,
      "student_id" integer NOT NULL,
      "book_id" integer,
      "ngay_dung" timestamp(3) with time zone,
      "gia_sach" numeric,
      "uu_dai" numeric,
      "tien_sach" numeric,
      "co_so" "enum_book_issues_co_so",
      "lark_code" varchar,
      "ghi_chu" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "book_issues"
        ADD CONSTRAINT "book_issues_student_id_students_id_fk"
        FOREIGN KEY ("student_id") REFERENCES "public"."students"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "book_issues"
        ADD CONSTRAINT "book_issues_book_id_books_id_fk"
        FOREIGN KEY ("book_id") REFERENCES "public"."books"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE UNIQUE INDEX IF NOT EXISTS "books_code_idx" ON "books" USING btree ("code");
    CREATE INDEX IF NOT EXISTS "books_updated_at_idx" ON "books" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "books_created_at_idx" ON "books" USING btree ("created_at");

    CREATE INDEX IF NOT EXISTS "book_issues_student_idx" ON "book_issues" USING btree ("student_id");
    CREATE INDEX IF NOT EXISTS "book_issues_book_idx" ON "book_issues" USING btree ("book_id");
    CREATE INDEX IF NOT EXISTS "book_issues_lark_code_idx" ON "book_issues" USING btree ("lark_code");
    CREATE INDEX IF NOT EXISTS "book_issues_updated_at_idx" ON "book_issues" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "book_issues_created_at_idx" ON "book_issues" USING btree ("created_at");

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "books_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "book_issues_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_books_fk"
        FOREIGN KEY ("books_id") REFERENCES "public"."books"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_book_issues_fk"
        FOREIGN KEY ("book_issues_id") REFERENCES "public"."book_issues"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_books_id_idx"
      ON "payload_locked_documents_rels" USING btree ("books_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_book_issues_id_idx"
      ON "payload_locked_documents_rels" USING btree ("book_issues_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_book_issues_fk";
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_books_fk";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "book_issues_id";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "books_id";
    DROP TABLE IF EXISTS "book_issues" CASCADE;
    DROP TABLE IF EXISTS "books" CASCADE;
    DROP TYPE IF EXISTS "enum_book_issues_co_so";
  `)
}
