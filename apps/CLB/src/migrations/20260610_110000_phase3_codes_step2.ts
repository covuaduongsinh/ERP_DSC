import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Phase 3 — BƯỚC 2/2 (ràng buộc NOT NULL). 🔒 Chạy SAU khi:
 *   1. đã áp `20260610_100000_phase3_codes_step1` (backfill code nullable), VÀ
 *   2. đã DEPLOY code (field `code` + makeCodeHook) → mọi đường tạo mới đã set code.
 *
 * Vì sao tách: cột `code` được điền bởi HOOK app (không phải DB default). Nếu set
 * NOT NULL trước khi code mới sống, bản ghi tạo giữa chừng sẽ thiếu code → vỡ
 * ràng buộc. Tách 3 bước là zero-downtime (xem feedback_migration_notnull_deploy_order).
 *
 * CHỈ `ALTER COLUMN ... SET NOT NULL` cho 3 collection. KHÔNG đụng
 * `locations.code` (cố ý để nullable: có thể tồn tại cơ sở khác KL/VP chưa gán
 * mã; `required:true` ở field-config chỉ ép trên đường Payload, không ép dòng cũ).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "classes"     ALTER COLUMN "code" SET NOT NULL;
    ALTER TABLE "events"      ALTER COLUMN "code" SET NOT NULL;
    ALTER TABLE "book_issues" ALTER COLUMN "code" SET NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "classes"     ALTER COLUMN "code" DROP NOT NULL;
    ALTER TABLE "events"      ALTER COLUMN "code" DROP NOT NULL;
    ALTER TABLE "book_issues" ALTER COLUMN "code" DROP NOT NULL;
  `)
}
