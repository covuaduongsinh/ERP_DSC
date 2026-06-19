import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * Classes: `ageGroup` (select đơn) → `ageGroup` (select hasMany). Một lớp có thể
 * phục vụ NHIỀU nhóm tuổi (Mầm non + Cấp 1-2) ⇒ giảm số lớp, dễ gộp khi vắng.
 *
 * Cấu trúc KHỚP Payload db-postgres cho hasMany select (mẫu `users_role`):
 *  - bảng `classes_age_group` (id serial PK, order, parent_id FK→classes cascade,
 *    value enum_classes_age_group). TÁI DÙNG enum `enum_classes_age_group` sẵn có.
 *
 * Viết tay theo convention repo (migrate:create/push treo qua pooler). Idempotent.
 * Dữ liệu hiện tại: mỗi lớp 1 nhóm tuổi ⇒ copy thành mảng 1 phần tử, không mất nhóm.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- 1) Bảng hasMany SELECT cho ageGroup (tái dùng enum_classes_age_group)
    CREATE TABLE IF NOT EXISTS "classes_age_group" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "value" "enum_classes_age_group" NOT NULL
    );
    DO $$ BEGIN
      ALTER TABLE "classes_age_group" ADD CONSTRAINT "classes_age_group_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "classes_age_group_order_idx" ON "classes_age_group" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "classes_age_group_parent_idx" ON "classes_age_group" USING btree ("parent_id");

    -- 2) Copy giá trị đơn hiện có → mảng (idempotent)
    INSERT INTO "classes_age_group" ("order", "parent_id", "value")
      SELECT 0, c."id", c."age_group" FROM "classes" c
      WHERE c."age_group" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "classes_age_group" r WHERE r."parent_id" = c."id");

    -- 3) Bỏ cột đơn cũ (giữ type enum — bảng mới dùng nó)
    ALTER TABLE "classes" DROP COLUMN IF EXISTS "age_group";
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- Khôi phục cột đơn (lấy phần tử đầu của mảng theo order)
    ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "age_group" "enum_classes_age_group";
    UPDATE "classes" c SET "age_group" = sub.value
      FROM (SELECT DISTINCT ON (parent_id) parent_id, value FROM "classes_age_group" ORDER BY parent_id, "order") sub
      WHERE sub.parent_id = c."id";

    DROP TABLE IF EXISTS "classes_age_group";
  `);
}
