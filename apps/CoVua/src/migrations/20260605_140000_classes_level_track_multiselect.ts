import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * Classes: `level` (select đơn) → `level` (select hasMany) VÀ thêm `track`
 * (select hasMany MỚI). Một lớp có thể gắn NHIỀU cấp + NHIỀU tuyến ⇒ gộp lớp,
 * giảm số lớp khi vắng học sinh. Tuyến trước đây là field ẢO (suy từ cấp); nay
 * lưu thật để chọn/lệch độc lập, vẫn tự suy khi bỏ trống (hook `syncLevelTrack`).
 *
 * Cấu trúc KHỚP Payload db-postgres cho hasMany select (mẫu `classes_age_group`):
 *  - `classes_level` (value enum_classes_level — TÁI DÙNG enum sẵn có).
 *  - `classes_track` (value enum_classes_track — TẠO MỚI).
 *
 * Viết tay theo convention repo (migrate:create/push treo qua pooler). Idempotent.
 * Backfill: copy cấp đơn → mảng 1 phần tử; suy tuyến từ cấp (Tốt→nhập môn;
 * Mã/Tượng/Xe→cơ bản; Hậu/Vua→nâng cao) ⇒ dữ liệu cũ không mất, tuyến khớp cấp.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- 1) Bảng hasMany SELECT cho level (tái dùng enum_classes_level)
    CREATE TABLE IF NOT EXISTS "classes_level" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "value" "enum_classes_level" NOT NULL
    );
    DO $$ BEGIN
      ALTER TABLE "classes_level" ADD CONSTRAINT "classes_level_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "classes_level_order_idx" ON "classes_level" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "classes_level_parent_idx" ON "classes_level" USING btree ("parent_id");

    -- 2) Copy cấp đơn hiện có → mảng (idempotent)
    INSERT INTO "classes_level" ("order", "parent_id", "value")
      SELECT 0, c."id", c."level" FROM "classes" c
      WHERE c."level" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "classes_level" r WHERE r."parent_id" = c."id");

    -- 3) Enum + bảng hasMany SELECT cho track (TẠO MỚI)
    DO $$ BEGIN
      CREATE TYPE "enum_classes_track" AS ENUM ('nhap_mon', 'co_ban', 'nang_cao');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE TABLE IF NOT EXISTS "classes_track" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "value" "enum_classes_track" NOT NULL
    );
    DO $$ BEGIN
      ALTER TABLE "classes_track" ADD CONSTRAINT "classes_track_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "classes_track_order_idx" ON "classes_track" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "classes_track_parent_idx" ON "classes_track" USING btree ("parent_id");

    -- 4) Backfill tuyến suy từ cấp cũ (idempotent). Cột "level" vẫn còn ở bước này.
    INSERT INTO "classes_track" ("order", "parent_id", "value")
      SELECT 0, c."id",
        (CASE c."level"
          WHEN 'tot' THEN 'nhap_mon'
          WHEN 'ma' THEN 'co_ban'
          WHEN 'tuong' THEN 'co_ban'
          WHEN 'xe' THEN 'co_ban'
          WHEN 'hau' THEN 'nang_cao'
          WHEN 'vua' THEN 'nang_cao'
        END)::"enum_classes_track"
      FROM "classes" c
      WHERE c."level" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "classes_track" r WHERE r."parent_id" = c."id");

    -- 5) Bỏ cột đơn cũ (giữ type enum_classes_level — bảng classes_level dùng nó)
    ALTER TABLE "classes" DROP COLUMN IF EXISTS "level";
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    -- Khôi phục cột cấp đơn (lấy phần tử đầu của mảng theo order)
    ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "level" "enum_classes_level";
    UPDATE "classes" c SET "level" = sub.value
      FROM (SELECT DISTINCT ON (parent_id) parent_id, value FROM "classes_level" ORDER BY parent_id, "order") sub
      WHERE sub.parent_id = c."id";

    DROP TABLE IF EXISTS "classes_level";
    DROP TABLE IF EXISTS "classes_track";
    DROP TYPE IF EXISTS "enum_classes_track";
  `);
}
