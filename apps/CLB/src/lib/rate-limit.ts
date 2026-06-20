/**
 * Rate limit BỀN qua Postgres (bảng `rate_limits`) — thay cho bản in-memory cũ.
 *
 * Vì sao không dùng Map in-memory: trên Vercel serverless mỗi cold start là một
 * tiến trình mới ⇒ bộ đếm reset ⇒ rate-limit "thủng" (kẻ tấn công ép cold start
 * hoặc trúng instance khác để vượt ngưỡng). Bảng Postgres sống chung với DB nên
 * đếm chính xác trên MỌI instance, MỌI lần restart — portable Vercel → VPS vì
 * chỉ phụ thuộc `db-postgres` (không cần Redis/KV riêng).
 *
 * Cơ chế: cửa sổ cố định (fixed window) bằng MỘT câu lệnh `INSERT ... ON CONFLICT
 * DO UPDATE` nguyên tử. Atomic là điểm mấu chốt cho rate-limit: nếu đọc-rồi-ghi
 * qua Payload Local API (find → update) thì hai request đồng thời cùng đọc count
 * cũ rồi cùng ghi ⇒ lọt ngưỡng (TOCTOU). Upsert nguyên tử trong 1 statement loại
 * bỏ race đó ở tầng DB.
 *
 * Đường nâng cấp: khi tải lớn, có thể chuyển bộ đếm sang Redis/Upstash (TTL gốc,
 * không cần dọn rác). Giữ API `consumeRateLimit` ổn định để chỉ thay phần lưu trữ.
 */

/** Hình dạng tối thiểu của `node-postgres` Pool mà ta cần (khớp `payload.db.pool`). */
export type RateLimitPool = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }>
}

export type RateLimitResult = {
  /** Đã vượt ngưỡng trong cửa sổ hiện tại? */
  limited: boolean
  /** Tổng số lần gọi trong cửa sổ (gồm cả lần bị chặn). */
  count: number
  /** Còn bao lâu (ms) tới khi cửa sổ reset — dùng cho thông báo "thử lại sau". */
  retryAfterMs: number
}

/**
 * Lấy Postgres pool từ Payload. Adapter `@payloadcms/db-postgres` để lộ pool
 * node-postgres ở `payload.db.pool`. Throw rõ ràng nếu thiếu (cấu hình sai) —
 * caller bọc trong try/catch sẽ coi như lỗi server (không có DB ⇒ không gửi OTP).
 */
export function getRateLimitPool(payload: { db: unknown }): RateLimitPool {
  const pool = (payload.db as { pool?: RateLimitPool }).pool
  if (!pool) {
    throw new Error('Không truy cập được Postgres pool cho rate-limit (payload.db.pool).')
  }
  return pool
}

/**
 * Quyết định thuần (không DB): đã vượt ngưỡng chưa khi đếm được `count` lần với
 * tối đa `max` lần/cửa sổ. Tách riêng để test được mọi ca biên không cần DB.
 *
 * Quy ước: cho phép đúng `max` lần. count=1..max ⇒ chưa chặn; count=max+1 trở đi
 * ⇒ chặn. (Upsert luôn tăng count nên lần bị chặn vẫn được đếm — phục vụ phát
 * hiện lạm dụng; cửa sổ KHÔNG bị nới vì `expires_at` chỉ đặt lúc mở cửa sổ.)
 */
export function evaluateRateLimit(count: number, max: number): boolean {
  return count > max
}

/**
 * Upsert nguyên tử cửa sổ cố định.
 * - Chưa có hàng HOẶC cửa sổ đã hết hạn ⇒ mở cửa sổ mới: count=1, expires_at=now+window.
 * - Còn trong cửa sổ ⇒ count = count + 1, GIỮ nguyên expires_at (không nới cửa sổ).
 *
 * `$1`=key, `$2`=windowMs. Mốc thời gian lấy từ DB (`now()`) để không lệ thuộc
 * đồng hồ app. RETURNING trả count, expires_at và retry_after_ms tính sẵn tại DB.
 */
const CONSUME_SQL = `
  INSERT INTO "rate_limits" AS rl ("key", "count", "window_start", "expires_at", "updated_at", "created_at")
  VALUES ($1, 1, now(), now() + ($2::double precision * interval '1 millisecond'), now(), now())
  ON CONFLICT ("key") DO UPDATE SET
    "count" = CASE WHEN rl."expires_at" <= now() THEN 1 ELSE rl."count" + 1 END,
    "window_start" = CASE WHEN rl."expires_at" <= now() THEN now() ELSE rl."window_start" END,
    "expires_at" = CASE WHEN rl."expires_at" <= now() THEN now() + ($2::double precision * interval '1 millisecond') ELSE rl."expires_at" END,
    "updated_at" = now()
  RETURNING
    "count",
    "expires_at",
    GREATEST(0, CEIL(EXTRACT(EPOCH FROM ("expires_at" - now())) * 1000))::bigint AS retry_after_ms
`

/**
 * Tiêu thụ 1 "token" của khóa `key`: tăng bộ đếm cửa sổ và cho biết đã vượt
 * `max` lần/`windowMs` hay chưa. Race-safe (1 statement nguyên tử).
 */
export async function consumeRateLimit(
  pool: RateLimitPool,
  opts: { key: string; max: number; windowMs: number },
): Promise<RateLimitResult> {
  const { rows } = await pool.query(CONSUME_SQL, [opts.key, opts.windowMs])
  const row = (rows[0] ?? {}) as {
    count?: number | string
    retry_after_ms?: number | string
  }
  // node-postgres trả int4 dạng number, bigint dạng string ⇒ ép Number cho chắc.
  const count = Number(row.count ?? 0)
  const retryAfterMs = Number(row.retry_after_ms ?? 0)
  return { limited: evaluateRateLimit(count, opts.max), count, retryAfterMs }
}
