import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Thêm collection `payments` (thanh toán học phí). MIGRATION THUẦN ADDITIVE.
 *
 * - payments: student→students (NOT NULL), ngay_nop (NOT NULL), các số tiền/buổi
 *   (numeric, nullable), co_so + tinh_trang (enum, nullable; tinh_trang default
 *   'da_nop'), anh_bill→media (upload, nullable), ghi_chu (varchar). Access ở
 *   tầng app (Payments.ts): phụ huynh chỉ đọc payment của con mình; ghi chỉ staff.
 *
 * LƯU Ý `tuition_cycles.sessions_used`: field nay là VIRTUAL (tính lúc đọc từ
 * đếm Attendance status=co_mat — xem TuitionCycles.ts). Cột DB cũ KHÔNG bị xóa
 * ở đây để TRÁNH MẤT DỮ LIỆU (đang có bản ghi giá trị nhập tay). Payload bỏ qua
 * cột này vì field đã virtual (drizzle không map). Có thể dọn cột ở migration
 * sau nếu muốn — xem ghi chú dưới.
 *
 * Quy ước Payload db-postgres: tên cột = to-snake-case(field), enum
 * `enum_<table>_<column>`, FK ON DELETE set null, đăng ký vào
 * payload_locked_documents_rels. DDL idempotent (IF NOT EXISTS / DO $$
 * duplicate_object) — chạy lại an toàn.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_payments_co_so" AS ENUM('kim_lien', 'vinh_phuc');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_payments_tinh_trang" AS ENUM('da_nop', 'cho');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS "payments" (
      "id" serial PRIMARY KEY NOT NULL,
      "student_id" integer NOT NULL,
      "ngay_nop" timestamp(3) with time zone NOT NULL,
      "hoc_phi" numeric,
      "tien_sach" numeric,
      "mua_khac" numeric,
      "hp1_buoi" numeric,
      "so_buoi_nop" numeric,
      "co_so" "enum_payments_co_so",
      "tinh_trang" "enum_payments_tinh_trang" DEFAULT 'da_nop',
      "anh_bill_id" integer,
      "ghi_chu" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "payments"
        ADD CONSTRAINT "payments_student_id_students_id_fk"
        FOREIGN KEY ("student_id") REFERENCES "public"."students"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "payments"
        ADD CONSTRAINT "payments_anh_bill_id_media_id_fk"
        FOREIGN KEY ("anh_bill_id") REFERENCES "public"."media"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "payments_student_idx"
      ON "payments" USING btree ("student_id");
    CREATE INDEX IF NOT EXISTS "payments_anh_bill_idx"
      ON "payments" USING btree ("anh_bill_id");
    CREATE INDEX IF NOT EXISTS "payments_updated_at_idx"
      ON "payments" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "payments_created_at_idx"
      ON "payments" USING btree ("created_at");

    ALTER TABLE "payload_locked_documents_rels"
      ADD COLUMN IF NOT EXISTS "payments_id" integer;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_payments_fk"
        FOREIGN KEY ("payments_id") REFERENCES "public"."payments"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_payments_id_idx"
      ON "payload_locked_documents_rels" USING btree ("payments_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels"
      DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_payments_fk";
    ALTER TABLE "payload_locked_documents_rels"
      DROP COLUMN IF EXISTS "payments_id";
    DROP TABLE IF EXISTS "payments" CASCADE;
    DROP TYPE IF EXISTS "enum_payments_co_so";
    DROP TYPE IF EXISTS "enum_payments_tinh_trang";
  `)
}
