import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Thêm collection `audit_logs` (nhật ký kiểm toán). MIGRATION THUẦN ADDITIVE.
 *
 * Mỗi thao tác ghi trên students/progress-reports/payments/users sinh một bản
 * ghi diff tối thiểu (hook ở `lib/audit/log.ts`). Access ở tầng app
 * (AuditLogs.ts): chỉ admin đọc; create chặn (chỉ hook hệ thống tạo qua
 * overrideAccess); update/delete chỉ admin.
 *
 * Quy ước Payload db-postgres (đối chiếu import_logs/leads pipeline trong repo):
 *  - select 1 giá trị ⇒ enum `enum_<table>_<column>` (action).
 *  - text ⇒ varchar; json ⇒ jsonb (diff).
 *  - quan hệ đơn → users ⇒ cột `user_id` integer, FK ON DELETE set null,
 *    index `<table>_user_idx`.
 *  - đăng ký vào `payload_locked_documents_rels` (cột + FK cascade + index).
 * DDL idempotent (DO $$ duplicate_object / IF NOT EXISTS) — chạy lại an toàn.
 * KHÔNG push; áp bằng `payload migrate` sau khi review.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_audit_logs_action" AS ENUM('create', 'update', 'delete');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "audit_logs" (
      "id" serial PRIMARY KEY NOT NULL,
      "action" "enum_audit_logs_action" NOT NULL,
      "collection_slug" varchar NOT NULL,
      "document_id" varchar,
      "user_id" integer,
      "actor_label" varchar,
      "diff" jsonb,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "audit_logs"
        ADD CONSTRAINT "audit_logs_user_id_users_id_fk"
        FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "audit_logs_action_idx"
      ON "audit_logs" USING btree ("action");
    CREATE INDEX IF NOT EXISTS "audit_logs_collection_slug_idx"
      ON "audit_logs" USING btree ("collection_slug");
    CREATE INDEX IF NOT EXISTS "audit_logs_document_id_idx"
      ON "audit_logs" USING btree ("document_id");
    CREATE INDEX IF NOT EXISTS "audit_logs_user_idx"
      ON "audit_logs" USING btree ("user_id");
    CREATE INDEX IF NOT EXISTS "audit_logs_updated_at_idx"
      ON "audit_logs" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx"
      ON "audit_logs" USING btree ("created_at");

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "audit_logs_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_audit_logs_fk"
        FOREIGN KEY ("audit_logs_id") REFERENCES "public"."audit_logs"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_audit_logs_id_idx"
      ON "payload_locked_documents_rels" USING btree ("audit_logs_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_audit_logs_fk";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "audit_logs_id";
    DROP TABLE IF EXISTS "audit_logs" CASCADE;
    DROP TYPE IF EXISTS "enum_audit_logs_action";
  `)
}
