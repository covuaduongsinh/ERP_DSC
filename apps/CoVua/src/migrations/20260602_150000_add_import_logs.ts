import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * Thêm collection `import_logs` (nhật ký import). MIGRATION THUẦN ADDITIVE.
 *
 * Mỗi lần nhân viên xác nhận ghi một file import (Students/Attendance/
 * ProgressReports/Coaches/Payments) sẽ tạo một bản ghi nhật ký. Access ở tầng
 * app (ImportLogs.ts): chỉ staff đọc/xóa, update bị chặn (bất biến).
 *
 * Quy ước Payload db-postgres: tên cột = to-snake-case(field), enum
 * `enum_<table>_<column>`, FK ON DELETE set null, đăng ký vào
 * payload_locked_documents_rels. DDL idempotent (IF NOT EXISTS / DO $$
 * duplicate_object) — chạy lại an toàn.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_import_logs_kind" AS ENUM('students', 'attendance', 'progress-reports', 'coaches', 'payments');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "import_logs" (
      "id" serial PRIMARY KEY NOT NULL,
      "kind" "enum_import_logs_kind" NOT NULL,
      "file_name" varchar NOT NULL,
      "user_id" integer,
      "rows_total" numeric,
      "rows_created" numeric,
      "rows_updated" numeric,
      "rows_skipped" numeric,
      "rows_errors" numeric,
      "notes" varchar,
      "error_sample" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "import_logs"
        ADD CONSTRAINT "import_logs_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "import_logs_user_idx"
      ON "import_logs" USING btree ("user_id");
    CREATE INDEX IF NOT EXISTS "import_logs_updated_at_idx"
      ON "import_logs" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "import_logs_created_at_idx"
      ON "import_logs" USING btree ("created_at");

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "import_logs_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_import_logs_fk"
        FOREIGN KEY ("import_logs_id") REFERENCES "public"."import_logs"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_import_logs_id_idx"
      ON "payload_locked_documents_rels" USING btree ("import_logs_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_import_logs_fk";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "import_logs_id";
    DROP TABLE IF EXISTS "import_logs" CASCADE;
    DROP TYPE IF EXISTS "enum_import_logs_kind";
  `);
}
