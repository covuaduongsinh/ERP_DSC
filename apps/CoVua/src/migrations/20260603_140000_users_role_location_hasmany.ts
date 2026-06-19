import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * Users: `role` (select đơn) → `role` (select hasMany) + `location` (relationship
 * đơn) → `location` (relationship hasMany). Một nhân viên có thể NHIỀU vai trò +
 * NHIỀU cơ sở (quyền = HỢP các vai trò; phạm vi cơ sở = IN các cơ sở).
 *
 * Cấu trúc KHỚP Payload db-postgres (lấy từ @payloadcms/drizzle schema builder +
 * dump _rels prod):
 *  - hasMany select → bảng `users_role` (id serial PK, order, parent_id FK→users
 *    cascade, value enum_users_role). TÁI DÙNG enum `enum_users_role` sẵn có.
 *  - hasMany relationship → bảng `users_rels` (id serial PK, order, parent_id
 *    FK→users cascade, path varchar, locations_id FK→locations cascade).
 *
 * Viết tay theo convention repo (migrate:create/push treo qua pooler). Idempotent.
 * Data hiện tại: 1 user (admin, location null) ⇒ copy tầm thường.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- 1) Bảng hasMany SELECT cho role (tái dùng enum_users_role)
    CREATE TABLE IF NOT EXISTS "users_role" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "value" "enum_users_role" NOT NULL
    );
    DO $$ BEGIN
      ALTER TABLE "users_role" ADD CONSTRAINT "users_role_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "users_role_order_idx" ON "users_role" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "users_role_parent_idx" ON "users_role" USING btree ("parent_id");

    -- 2) Bảng hasMany RELATIONSHIP cho location (users_rels, path='location')
    CREATE TABLE IF NOT EXISTS "users_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "locations_id" integer
    );
    DO $$ BEGIN
      ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "users_rels" ADD CONSTRAINT "users_rels_locations_fk"
        FOREIGN KEY ("locations_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "users_rels_order_idx" ON "users_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "users_rels_parent_idx" ON "users_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "users_rels_path_idx" ON "users_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "users_rels_locations_id_idx" ON "users_rels" USING btree ("locations_id");

    -- 3) Copy giá trị đơn hiện có → mảng (idempotent)
    INSERT INTO "users_role" ("order", "parent_id", "value")
      SELECT 0, u."id", u."role" FROM "users" u
      WHERE u."role" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "users_role" r WHERE r."parent_id" = u."id");

    INSERT INTO "users_rels" ("order", "parent_id", "path", "locations_id")
      SELECT 1, u."id", 'location', u."location_id" FROM "users" u
      WHERE u."location_id" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "users_rels" r WHERE r."parent_id" = u."id" AND r."path" = 'location');

    -- 4) Bỏ cột đơn cũ
    ALTER TABLE "users" DROP COLUMN IF EXISTS "role";
    DROP INDEX IF EXISTS "users_location_idx";
    ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_location_id_locations_id_fk";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "location_id";
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- Khôi phục cột đơn (lấy phần tử đầu của mảng)
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "enum_users_role" DEFAULT 'receptionist' NOT NULL;
    UPDATE "users" u SET "role" = sub.value
      FROM (SELECT DISTINCT ON (parent_id) parent_id, value FROM "users_role" ORDER BY parent_id, "order") sub
      WHERE sub.parent_id = u."id";

    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "location_id" integer;
    DO $$ BEGIN
      ALTER TABLE "users" ADD CONSTRAINT "users_location_id_locations_id_fk"
        FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "users_location_idx" ON "users" USING btree ("location_id");
    UPDATE "users" u SET "location_id" = sub.locations_id
      FROM (SELECT DISTINCT ON (parent_id) parent_id, locations_id FROM "users_rels" WHERE path='location' ORDER BY parent_id, "order") sub
      WHERE sub.parent_id = u."id";

    DROP TABLE IF EXISTS "users_role";
    DROP TABLE IF EXISTS "users_rels";
  `);
}
