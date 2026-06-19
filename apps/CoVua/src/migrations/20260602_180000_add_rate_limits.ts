import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres';

/**
 * Thêm bảng `rate_limits` cho rate-limit BỀN (thay bản in-memory cũ ở luồng OTP).
 *
 * Bảng đếm cửa sổ cố định, KHÓA theo `key` (vd `otp_send:<sdt>`). Bộ đếm sống
 * chung DB nên chính xác trên mọi serverless instance / sau restart — portable
 * Vercel → VPS (chỉ cần db-postgres). Xem `apps/web/src/lib/rate-limit.ts`.
 *
 * CỐ Ý KHÔNG đăng ký làm collection Payload: rate-limit cần upsert nguyên tử
 * (`INSERT ... ON CONFLICT DO UPDATE`) mà Local API không làm được, và bảng này
 * thuần hạ tầng (không cần access control / REST / admin UI). Payload bỏ qua bảng
 * lạ nên không gây drift schema. Vì vậy KHÔNG đụng `payload_locked_documents_rels`.
 *
 * Dọn rác (tùy chọn, làm sau): `DELETE FROM rate_limits WHERE expires_at < now();`
 * — index `rate_limits_expires_at_idx` phục vụ việc này. Hàng cũ bị ghi đè khi
 * cùng key mở cửa sổ mới nên số hàng bị chặn theo số khóa (nhỏ với OTP theo SĐT).
 *
 * DDL additive idempotent (IF NOT EXISTS) — chạy lại an toàn. Áp bằng `payload
 * migrate` (KHÔNG push).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "rate_limits" (
      "key" varchar PRIMARY KEY NOT NULL,
      "count" integer DEFAULT 0 NOT NULL,
      "window_start" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "expires_at" timestamp(3) with time zone NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE INDEX IF NOT EXISTS "rate_limits_expires_at_idx"
      ON "rate_limits" USING btree ("expires_at");
  `);
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "rate_limits" CASCADE;
  `);
}
