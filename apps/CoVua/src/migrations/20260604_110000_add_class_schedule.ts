import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * Classes → lịch học CÓ CẤU TRÚC + sĩ số tối đa + trạng thái lớp (Cụm 1C).
 *
 *  - `lichHoc` (array) ⇒ bảng con `classes_lich_hoc` (mỗi buổi: `thu` enum,
 *    `gio_bat_dau`, `gio_ket_thuc`, `phong?`). Thay free-text `schedule` bằng dữ
 *    liệu truy vấn được (thời khóa biểu tuần + phát hiện trùng lịch). `schedule`
 *    GIỮ NGUYÊN làm fallback/ghi chú.
 *  - `si_so_toi_da` (number) — sĩ số tối đa (cảnh báo khi vượt).
 *  - `trang_thai` (enum: dang_mo/tam_dung/da_dong, mặc định `dang_mo`).
 *
 * Bảng array khớp convention Payload (soi `classes_tuition_tiers` trên prod):
 * `_order` int, `_parent_id` int FK→classes ON DELETE cascade, `id` varchar PK,
 * index `_order` + `_parent_id`. DDL additive idempotent — chạy lại an toàn.
 * Viết tay theo convention repo; KHÔNG push — áp bằng `payload migrate`/MCP.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_classes_lich_hoc_thu" AS ENUM('t2','t3','t4','t5','t6','t7','cn');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "enum_classes_trang_thai" AS ENUM('dang_mo','tam_dung','da_dong');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE TABLE IF NOT EXISTS "classes_lich_hoc" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "thu" "enum_classes_lich_hoc_thu" NOT NULL,
      "gio_bat_dau" varchar NOT NULL,
      "gio_ket_thuc" varchar NOT NULL,
      "phong" varchar
    );

    DO $$ BEGIN
      ALTER TABLE "classes_lich_hoc"
        ADD CONSTRAINT "classes_lich_hoc_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."classes"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "classes_lich_hoc_order_idx"
      ON "classes_lich_hoc" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "classes_lich_hoc_parent_id_idx"
      ON "classes_lich_hoc" USING btree ("_parent_id");

    ALTER TABLE "classes"
      ADD COLUMN IF NOT EXISTS "si_so_toi_da" numeric;
    ALTER TABLE "classes"
      ADD COLUMN IF NOT EXISTS "trang_thai" "enum_classes_trang_thai" DEFAULT 'dang_mo';
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "classes_lich_hoc";
    ALTER TABLE "classes" DROP COLUMN IF EXISTS "si_so_toi_da";
    ALTER TABLE "classes" DROP COLUMN IF EXISTS "trang_thai";
    DROP TYPE IF EXISTS "enum_classes_lich_hoc_thu";
    DROP TYPE IF EXISTS "enum_classes_trang_thai";
  `);
}
