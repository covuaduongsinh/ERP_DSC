import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * Thêm collection `refunds` (Hoàn tiền) — vế "tiền ra" của doanh thu. Mirror cấu
 * trúc một collection Payload (đối chiếu `audit_logs`): id serial PK, timestamps,
 * FK → students, đăng ký vào `payload_locked_documents_rels`.
 *
 * DDL additive idempotent. Viết tay theo convention repo; áp bằng `payload migrate`/MCP.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_refunds_co_so" AS ENUM('kim_lien','vinh_phuc');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      CREATE TYPE "enum_refunds_phuong_thuc" AS ENUM('tien_mat','ck');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE TABLE IF NOT EXISTS "refunds" (
      "id" serial PRIMARY KEY NOT NULL,
      "student_id" integer,
      "so_tien" numeric NOT NULL,
      "ngay_hoan" timestamp(3) with time zone NOT NULL,
      "ly_do" varchar NOT NULL,
      "co_so" "enum_refunds_co_so",
      "phuong_thuc" "enum_refunds_phuong_thuc",
      "note" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "refunds"
        ADD CONSTRAINT "refunds_student_id_students_id_fk"
        FOREIGN KEY ("student_id") REFERENCES "public"."students"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "refunds_student_idx" ON "refunds" USING btree ("student_id");
    CREATE INDEX IF NOT EXISTS "refunds_updated_at_idx" ON "refunds" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "refunds_created_at_idx" ON "refunds" USING btree ("created_at");

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "refunds_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_refunds_fk"
        FOREIGN KEY ("refunds_id") REFERENCES "public"."refunds"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_refunds_id_idx"
      ON "payload_locked_documents_rels" USING btree ("refunds_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_refunds_fk";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "refunds_id";
    DROP TABLE IF EXISTS "refunds" CASCADE;
    DROP TYPE IF EXISTS "enum_refunds_co_so";
    DROP TYPE IF EXISTS "enum_refunds_phuong_thuc";
  `);
}
