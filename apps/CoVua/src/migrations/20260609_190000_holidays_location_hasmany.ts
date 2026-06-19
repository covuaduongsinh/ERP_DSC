import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * Holidays: `location` (relationship ĐƠN) → `location` (relationship hasMany). Một
 * ngày nghỉ có thể áp cho NHIỀU cơ sở cụ thể (vd Kim Liên + Vĩnh Phúc) thay vì chỉ
 * 1-cơ-sở-HOẶC-toàn-công-ty. Quy ước giữ: rỗng = toàn công ty.
 *
 * Cấu trúc KHỚP Payload db-postgres (mẫu `users_rels` ở
 * `20260603_140000_users_role_location_hasmany`):
 *  - hasMany relationship → bảng `holidays_rels` (id serial PK, order, parent_id
 *    FK→holidays cascade, path varchar, locations_id FK→locations cascade).
 *  - Copy `location_id` đơn hiện có → 1 dòng rels rồi BỎ cột đơn.
 *
 * DDL additive idempotent. Áp bằng `payload migrate`/MCP (KHÔNG push). Forward-only —
 * KHÔNG sửa migration `20260609_180000_add_holidays` đã áp.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- 1) Bảng hasMany RELATIONSHIP cho location (holidays_rels, path='location')
    CREATE TABLE IF NOT EXISTS "holidays_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "locations_id" integer
    );
    DO $$ BEGIN
      ALTER TABLE "holidays_rels" ADD CONSTRAINT "holidays_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."holidays"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "holidays_rels" ADD CONSTRAINT "holidays_rels_locations_fk"
        FOREIGN KEY ("locations_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "holidays_rels_order_idx" ON "holidays_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "holidays_rels_parent_idx" ON "holidays_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "holidays_rels_path_idx" ON "holidays_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "holidays_rels_locations_id_idx" ON "holidays_rels" USING btree ("locations_id");

    -- 2) Copy giá trị đơn hiện có → mảng (idempotent)
    INSERT INTO "holidays_rels" ("order", "parent_id", "path", "locations_id")
      SELECT 1, h."id", 'location', h."location_id" FROM "holidays" h
      WHERE h."location_id" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "holidays_rels" r WHERE r."parent_id" = h."id" AND r."path" = 'location');

    -- 3) Bỏ cột đơn cũ
    DROP INDEX IF EXISTS "holidays_location_idx";
    ALTER TABLE "holidays" DROP CONSTRAINT IF EXISTS "holidays_location_id_locations_id_fk";
    ALTER TABLE "holidays" DROP COLUMN IF EXISTS "location_id";
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- Khôi phục cột đơn (lấy phần tử đầu của mảng)
    ALTER TABLE "holidays" ADD COLUMN IF NOT EXISTS "location_id" integer;
    DO $$ BEGIN
      ALTER TABLE "holidays" ADD CONSTRAINT "holidays_location_id_locations_id_fk"
        FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "holidays_location_idx" ON "holidays" USING btree ("location_id");
    UPDATE "holidays" h SET "location_id" = sub.locations_id
      FROM (SELECT DISTINCT ON (parent_id) parent_id, locations_id FROM "holidays_rels" WHERE path='location' ORDER BY parent_id, "order") sub
      WHERE sub.parent_id = h."id";

    DROP TABLE IF EXISTS "holidays_rels";
  `);
}
