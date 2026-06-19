import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * Leads → thêm relationship tùy chọn `interestedClass` về `classes`
 * (cột `interested_class_id`). Form "Đăng ký học thử" trên website ghi lớp phụ
 * huynh quan tâm vào lead — giúp nhân viên gọi xác nhận đúng lớp/cơ sở.
 *
 * Quy ước Payload db-postgres (khớp leads.interested_location_id đã có):
 *  - cột integer, FK → classes(id) ON DELETE set null (xóa lớp ⇒ lead gỡ liên kết)
 *  - index `leads_interested_class_idx`
 * DDL additive idempotent (IF NOT EXISTS / duplicate_object) — chạy lại an toàn.
 * Viết tay theo convention repo; KHÔNG push — áp bằng `payload migrate`.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "leads"
      ADD COLUMN IF NOT EXISTS "interested_class_id" integer;

    DO $$ BEGIN
      ALTER TABLE "leads"
        ADD CONSTRAINT "leads_interested_class_id_classes_id_fk"
        FOREIGN KEY ("interested_class_id") REFERENCES "public"."classes"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;

    CREATE INDEX IF NOT EXISTS "leads_interested_class_idx"
      ON "leads" USING btree ("interested_class_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "leads_interested_class_idx";
    ALTER TABLE "leads"
      DROP CONSTRAINT IF EXISTS "leads_interested_class_id_classes_id_fk";
    ALTER TABLE "leads"
      DROP COLUMN IF EXISTS "interested_class_id";
  `);
}
