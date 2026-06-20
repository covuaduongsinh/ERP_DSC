import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Refine `class_sessions` để chứa BUỔI HỌC LỊCH SỬ (không gắn lớp) — GĐ2.
 *
 * Dữ liệu lịch sử (4330 attendance) đều `lop_id` NULL, vận hành theo mã `buoi`.
 * Để materialize buổi lịch sử (gom theo buoi+coach+date):
 *  - `lop_id` → NULLABLE (buổi lịch sử lop=null; buổi đi-tới vẫn có lop).
 *  - `location_id` (FK→locations, set null) — cơ sở của buổi; TRỤC branch-scope
 *    THỐNG NHẤT cho cả buổi-lớp lẫn buổi-lịch-sử (thay scope qua `lop.location`).
 *  - `buoi` (varchar) — nhãn khối lịch sử (trace + hiển thị).
 *
 * Prod hiện 0 buổi ⇒ refine an toàn. DDL additive idempotent; áp bằng `payload migrate`/MCP.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "class_sessions" ALTER COLUMN "lop_id" DROP NOT NULL;
    ALTER TABLE "class_sessions" ADD COLUMN IF NOT EXISTS "location_id" integer;
    ALTER TABLE "class_sessions" ADD COLUMN IF NOT EXISTS "buoi" varchar;

    DO $$ BEGIN
      ALTER TABLE "class_sessions"
        ADD CONSTRAINT "class_sessions_location_id_locations_id_fk"
        FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "class_sessions_location_idx"
      ON "class_sessions" USING btree ("location_id");
    CREATE INDEX IF NOT EXISTS "class_sessions_buoi_idx"
      ON "class_sessions" USING btree ("buoi");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- Gỡ buổi lịch sử (lop null) để có thể khôi phục NOT NULL như GĐ1.
    DELETE FROM "class_sessions" WHERE "lop_id" IS NULL;

    DROP INDEX IF EXISTS "class_sessions_buoi_idx";
    DROP INDEX IF EXISTS "class_sessions_location_idx";
    ALTER TABLE "class_sessions" DROP CONSTRAINT IF EXISTS "class_sessions_location_id_locations_id_fk";
    ALTER TABLE "class_sessions" DROP COLUMN IF EXISTS "buoi";
    ALTER TABLE "class_sessions" DROP COLUMN IF EXISTS "location_id";
    ALTER TABLE "class_sessions" ALTER COLUMN "lop_id" SET NOT NULL;
  `)
}
