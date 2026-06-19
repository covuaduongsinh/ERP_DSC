/**
 * Bộ đếm số thứ tự ATOMIC cho mã định danh nghiệp vụ (`code_counters`).
 *
 * Vì sao KHÔNG `count()+1`: hai request đồng thời cùng đọc max cũ rồi cùng +1 ⇒
 * trùng số (TOCTOU). Thay vào đó dùng MỘT câu `INSERT ... ON CONFLICT DO UPDATE
 * ... RETURNING` nguyên tử — Postgres khóa hàng theo `scope` trong 1 statement,
 * không thể có hai caller cùng nhận một số. MIRROR precedent `rate_limits`
 * (`apps/web/src/lib/rate-limit.ts`).
 *
 * Số được cấp trên CHÍNH connection của pool và commit ngay theo từng statement
 * (autocommit của câu lệnh độc lập), KHÔNG nằm trong transaction nghiệp vụ bên
 * ngoài. Hệ quả: nếu create lỗi/rollback sau khi đã cấp số → bỏ 1 số (gap). Đây
 * là ĐÁNH ĐỔI CHẤP NHẬN ĐƯỢC (yêu cầu: KHÔNG BAO GIỜ tái dùng một số; gap OK).
 * Xóa bản ghi KHÔNG giảm counter.
 *
 * Portable Vercel → VPS: chỉ phụ thuộc Postgres (`payload.db.pool`), không cần
 * Redis/KV.
 */

/** Hình dạng tối thiểu của `node-postgres` Pool (khớp `payload.db.pool`). */
export type CodeCounterPool = {
  query: (
    text: string,
    params?: unknown[],
  ) => Promise<{ rows: unknown[]; rowCount: number | null }>;
};

/**
 * Lấy Postgres pool từ Payload. Adapter `@payloadcms/db-postgres` để lộ pool
 * node-postgres ở `payload.db.pool`. Throw rõ ràng nếu thiếu (cấu hình sai).
 */
export function getCodeCounterPool(payload: { db: unknown }): CodeCounterPool {
  const pool = (payload.db as { pool?: CodeCounterPool }).pool;
  if (!pool) {
    throw new Error(
      'Không truy cập được Postgres pool để cấp mã (payload.db.pool).',
    );
  }
  return pool;
}

const NEXT_SEQUENCE_SQL = `
  INSERT INTO "code_counters" AS c ("scope", "value")
  VALUES ($1, 1)
  ON CONFLICT ("scope") DO UPDATE SET
    "value" = c."value" + 1,
    "updated_at" = now()
  RETURNING "value"
`;

/**
 * Cấp số thứ tự kế tiếp cho `scope` (vd `HV:2026`, `PT:KL:202606`). Nguyên tử:
 * mỗi lần gọi trả về một số tăng dần DUY NHẤT trong scope đó, kể cả khi nhiều
 * caller gọi đồng thời.
 */
export async function nextSequence(
  pool: CodeCounterPool,
  scope: string,
): Promise<number> {
  const { rows } = await pool.query(NEXT_SEQUENCE_SQL, [scope]);
  const row = (rows[0] ?? {}) as { value?: number | string };
  const value = Number(row.value);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Cấp số thứ tự thất bại cho scope "${scope}".`);
  }
  return value;
}

const SEED_COUNTER_SQL = `
  INSERT INTO "code_counters" AS c ("scope", "value")
  VALUES ($1, $2)
  ON CONFLICT ("scope") DO UPDATE SET
    "value" = GREATEST(c."value", EXCLUDED."value"),
    "updated_at" = now()
`;

/**
 * Đặt counter của `scope` lên ÍT NHẤT `value` (dùng `GREATEST` — không bao giờ
 * lùi số). Dùng sau backfill để counter khởi từ max seq đã cấp, tránh trùng với
 * bản ghi đã có. An toàn chạy lại (idempotent).
 */
export async function seedCounter(
  pool: CodeCounterPool,
  scope: string,
  value: number,
): Promise<void> {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Giá trị seed counter không hợp lệ cho scope "${scope}".`);
  }
  await pool.query(SEED_COUNTER_SQL, [scope, value]);
}
