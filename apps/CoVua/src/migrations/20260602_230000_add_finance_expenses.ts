import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * Tài chính — vế CHI. Thêm 2 collection `expense_categories` + `expenses` và cột
 * `payments.tuition_cycle_id` (link Thu ↔ chu kỳ). MIGRATION THUẦN ADDITIVE.
 *
 * - expense_categories: name (NOT NULL), active (bool default true), description.
 * - expenses: category→expense_categories, amount (NOT NULL), spent_at (NOT NULL),
 *   co_so + method (enum, nullable), payee (varchar), attachment→media, note.
 * - payments: thêm tuition_cycle_id → tuition_cycles (nullable, ON DELETE set null).
 *   Access ở tầng app: chỉ kế toán/quản lý/admin (Expenses.ts); phụ huynh bị chặn.
 *
 * Quy ước Payload db-postgres (đối chiếu payments/audit_logs trong repo):
 *  - select 1 giá trị ⇒ enum `enum_<table>_<column>`.
 *  - quan hệ đơn ⇒ cột `<field>_id` integer, FK ON DELETE set null, index `<table>_<field>_idx`.
 *  - đăng ký mỗi collection vào `payload_locked_documents_rels` (cột + FK cascade + index).
 * DDL idempotent (DO $$ duplicate_object / IF NOT EXISTS) — chạy lại an toàn.
 * KHÔNG push; áp bằng `payload migrate` sau khi review.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- enum cho expenses.co_so / expenses.method
    DO $$ BEGIN
      CREATE TYPE "public"."enum_expenses_co_so" AS ENUM('kim_lien', 'vinh_phuc');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_expenses_method" AS ENUM('tien_mat', 'ck');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    -- ── expense_categories ──────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS "expense_categories" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL,
      "active" boolean DEFAULT true,
      "description" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "expense_categories_updated_at_idx"
      ON "expense_categories" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "expense_categories_created_at_idx"
      ON "expense_categories" USING btree ("created_at");

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "expense_categories_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_expense_categories_fk"
        FOREIGN KEY ("expense_categories_id") REFERENCES "public"."expense_categories"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_expense_categories_id_idx"
      ON "payload_locked_documents_rels" USING btree ("expense_categories_id");

    -- ── expenses ────────────────────────────────────────────────────────────
    CREATE TABLE IF NOT EXISTS "expenses" (
      "id" serial PRIMARY KEY NOT NULL,
      "category_id" integer,
      "amount" numeric NOT NULL,
      "spent_at" timestamp(3) with time zone NOT NULL,
      "co_so" "enum_expenses_co_so",
      "method" "enum_expenses_method",
      "payee" varchar,
      "attachment_id" integer,
      "note" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "expenses"
        ADD CONSTRAINT "expenses_category_id_expense_categories_id_fk"
        FOREIGN KEY ("category_id") REFERENCES "public"."expense_categories"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "expenses"
        ADD CONSTRAINT "expenses_attachment_id_media_id_fk"
        FOREIGN KEY ("attachment_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "expenses_category_idx"
      ON "expenses" USING btree ("category_id");
    CREATE INDEX IF NOT EXISTS "expenses_attachment_idx"
      ON "expenses" USING btree ("attachment_id");
    CREATE INDEX IF NOT EXISTS "expenses_spent_at_idx"
      ON "expenses" USING btree ("spent_at");
    CREATE INDEX IF NOT EXISTS "expenses_updated_at_idx"
      ON "expenses" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "expenses_created_at_idx"
      ON "expenses" USING btree ("created_at");

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "expenses_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_expenses_fk"
        FOREIGN KEY ("expenses_id") REFERENCES "public"."expenses"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_expenses_id_idx"
      ON "payload_locked_documents_rels" USING btree ("expenses_id");

    -- ── payments.tuition_cycle_id (link Thu ↔ chu kỳ) ───────────────────────
    ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "tuition_cycle_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payments"
        ADD CONSTRAINT "payments_tuition_cycle_id_tuition_cycles_id_fk"
        FOREIGN KEY ("tuition_cycle_id") REFERENCES "public"."tuition_cycles"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "payments_tuition_cycle_idx"
      ON "payments" USING btree ("tuition_cycle_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_tuition_cycle_id_tuition_cycles_id_fk";
    ALTER TABLE "payments" DROP COLUMN IF EXISTS "tuition_cycle_id";

    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_expenses_fk";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "expenses_id";
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_expense_categories_fk";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "expense_categories_id";

    DROP TABLE IF EXISTS "expenses" CASCADE;
    DROP TABLE IF EXISTS "expense_categories" CASCADE;
    DROP TYPE IF EXISTS "enum_expenses_method";
    DROP TYPE IF EXISTS "enum_expenses_co_so";
  `);
}
