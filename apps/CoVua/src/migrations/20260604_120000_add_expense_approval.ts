import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * Expenses → DUYỆT PHIẾU CHI (tách trách nhiệm 🔒): kế toán tạo (`cho_duyet`),
 * admin/manager duyệt. Thêm:
 *  - `trang_thai` enum (cho_duyet/da_duyet/tu_choi, mặc định `cho_duyet`)
 *  - `duyet_boi_id` (FK→users — người duyệt) + `ngay_duyet` + `ly_do_tu_choi`
 *
 * DDL additive idempotent. Viết tay theo convention repo; áp bằng `payload migrate`/MCP.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_expenses_trang_thai" AS ENUM('cho_duyet','da_duyet','tu_choi');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    ALTER TABLE "expenses"
      ADD COLUMN IF NOT EXISTS "trang_thai" "enum_expenses_trang_thai" DEFAULT 'cho_duyet';
    ALTER TABLE "expenses"
      ADD COLUMN IF NOT EXISTS "duyet_boi_id" integer;
    ALTER TABLE "expenses"
      ADD COLUMN IF NOT EXISTS "ngay_duyet" timestamp(3) with time zone;
    ALTER TABLE "expenses"
      ADD COLUMN IF NOT EXISTS "ly_do_tu_choi" varchar;

    DO $$ BEGIN
      ALTER TABLE "expenses"
        ADD CONSTRAINT "expenses_duyet_boi_id_users_id_fk"
        FOREIGN KEY ("duyet_boi_id") REFERENCES "public"."users"("id")
        ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "expenses_duyet_boi_idx"
      ON "expenses" USING btree ("duyet_boi_id");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "expenses_duyet_boi_idx";
    ALTER TABLE "expenses" DROP CONSTRAINT IF EXISTS "expenses_duyet_boi_id_users_id_fk";
    ALTER TABLE "expenses" DROP COLUMN IF EXISTS "trang_thai";
    ALTER TABLE "expenses" DROP COLUMN IF EXISTS "duyet_boi_id";
    ALTER TABLE "expenses" DROP COLUMN IF EXISTS "ngay_duyet";
    ALTER TABLE "expenses" DROP COLUMN IF EXISTS "ly_do_tu_choi";
    DROP TYPE IF EXISTS "enum_expenses_trang_thai";
  `);
}
