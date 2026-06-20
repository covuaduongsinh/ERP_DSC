import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Thêm bảng đếm ATOMIC `code_counters` — nền cho mã định danh nghiệp vụ (`code`)
 * tự sinh, duy nhất, bất biến trên các collection (Phase 1: students/payments/
 * refunds). MIRROR precedent `rate_limits` (`20260602_180000_add_rate_limits`).
 *
 * Mỗi `scope` (vd `HV:2026`, `PT:KL:202606`, `PH:VP:202606`) giữ số thứ tự đã
 * cấp gần nhất. Cấp số kế tiếp dùng MỘT câu `INSERT ... ON CONFLICT DO UPDATE
 * ... RETURNING` nguyên tử (xem `apps/web/src/lib/codes/counters.ts`) — chống
 * race TOCTOU mà `count()+1` không tránh được.
 *
 * CỐ Ý KHÔNG đăng ký làm collection Payload (giống `rate_limits`): bảng thuần hạ
 * tầng, không cần access control / REST / admin UI, và cần upsert nguyên tử mà
 * Local API không làm được. Payload bỏ qua bảng lạ ⇒ KHÔNG drift schema, KHÔNG
 * đụng `payload_locked_documents_rels`.
 *
 * DDL additive idempotent (IF NOT EXISTS) — chạy lại an toàn. Áp bằng `payload
 * migrate` sau review (KHÔNG push, KHÔNG migrate:fresh trên prod).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "code_counters" (
      "scope" varchar PRIMARY KEY NOT NULL,
      "value" integer NOT NULL DEFAULT 0,
      "updated_at" timestamp(3) with time zone NOT NULL DEFAULT now()
    );
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "code_counters" CASCADE;
  `)
}
