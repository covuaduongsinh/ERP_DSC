import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Chỉ thêm collection renewal-requests — DB GĐ4 đã có sẵn qua push trước đó.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_renewal_requests_status" AS ENUM('moi', 'dang_xu_ly', 'da_chot', 'da_huy');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "renewal_requests" (
      "id" serial PRIMARY KEY NOT NULL,
      "student_id" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "tuition_cycle_id" integer,
      "sessions_remaining" numeric NOT NULL,
      "parent_note" varchar,
      "status" "enum_renewal_requests_status" DEFAULT 'moi' NOT NULL,
      "staff_note" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "renewal_requests"
        ADD CONSTRAINT "renewal_requests_student_id_students_id_fk"
        FOREIGN KEY ("student_id") REFERENCES "public"."students"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "renewal_requests"
        ADD CONSTRAINT "renewal_requests_parent_id_parents_id_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."parents"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "renewal_requests"
        ADD CONSTRAINT "renewal_requests_tuition_cycle_id_tuition_cycles_id_fk"
        FOREIGN KEY ("tuition_cycle_id") REFERENCES "public"."tuition_cycles"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "renewal_requests_student_idx"
      ON "renewal_requests" USING btree ("student_id");
    CREATE INDEX IF NOT EXISTS "renewal_requests_parent_idx"
      ON "renewal_requests" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "renewal_requests_tuition_cycle_idx"
      ON "renewal_requests" USING btree ("tuition_cycle_id");
    CREATE INDEX IF NOT EXISTS "renewal_requests_updated_at_idx"
      ON "renewal_requests" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "renewal_requests_created_at_idx"
      ON "renewal_requests" USING btree ("created_at");

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "renewal_requests_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_renewal_requests_fk"
        FOREIGN KEY ("renewal_requests_id") REFERENCES "public"."renewal_requests"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_renewal_requests_id_idx"
      ON "payload_locked_documents_rels" USING btree ("renewal_requests_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_renewal_requests_fk";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "renewal_requests_id";
    DROP TABLE IF EXISTS "renewal_requests" CASCADE;
    DROP TYPE IF EXISTS "enum_renewal_requests_status";
  `)
}
