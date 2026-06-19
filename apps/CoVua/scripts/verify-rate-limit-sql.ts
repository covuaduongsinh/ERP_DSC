/**
 * Verify câu upsert THẬT của rate-limit chạy đúng trên Postgres — KHÔNG đụng
 * schema/dữ liệu thật.
 *
 * Vì sao cần: unit test (`tests/int/otp-rate-limit.int.spec.ts`) chỉ dùng fake
 * pool JS nên KHÔNG bắt được lỗi cú pháp/kiểu của `CONSUME_SQL` (ON CONFLICT,
 * phép `interval`, `RETURNING ...::bigint`). Script này gọi ĐÚNG `consumeRateLimit`
 * của lib lên một **TEMP TABLE** trong một transaction rồi **ROLLBACK** — temp
 * table (ON COMMIT DROP) chỉ thuộc session, không tạo bảng `rate_limits` thật,
 * không áp migration, không để lại gì.
 *
 * Chạy: pnpm --filter @ds/web payload run scripts/verify-rate-limit-sql.ts
 */
import { getPayload } from 'payload';
import config from '../src/payload.config';
import { consumeRateLimit, evaluateRateLimit } from '../src/lib/rate-limit';

type PoolClient = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }>;
  release: () => void;
};
type Pool = {
  connect: () => Promise<PoolClient>;
};

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`✗ ${msg}`);
  console.error(`  ✓ ${msg}`);
}

async function main(): Promise<void> {
  const payload = await getPayload({ config: await config });
  const pool = (payload.db as unknown as { pool?: Pool }).pool;
  if (!pool?.connect) {
    throw new Error('Không lấy được pg pool (payload.db.pool.connect).');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Temp table khớp DDL migration (trừ index). ON COMMIT DROP ⇒ tự biến mất.
    // pg_temp đứng đầu search_path nên `INSERT INTO "rate_limits"` của CONSUME_SQL
    // trỏ vào temp table này, KHÔNG đụng bảng thật (chưa tồn tại).
    await client.query(`
      CREATE TEMP TABLE "rate_limits" (
        "key" varchar PRIMARY KEY NOT NULL,
        "count" integer DEFAULT 0 NOT NULL,
        "window_start" timestamptz DEFAULT now() NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "updated_at" timestamptz DEFAULT now() NOT NULL,
        "created_at" timestamptz DEFAULT now() NOT NULL
      ) ON COMMIT DROP
    `);

    const max = 3;
    const windowMs = 60 * 60 * 1000; // 1 giờ

    console.error('— Ngưỡng (cùng 1 khóa, cửa sổ còn hạn) —');
    const r1 = await consumeRateLimit(client, { key: 'otp_send:verify', max, windowMs });
    const r2 = await consumeRateLimit(client, { key: 'otp_send:verify', max, windowMs });
    const r3 = await consumeRateLimit(client, { key: 'otp_send:verify', max, windowMs });
    const r4 = await consumeRateLimit(client, { key: 'otp_send:verify', max, windowMs });

    assert(r1.count === 1 && !r1.limited, 'lần 1: count=1, không chặn');
    assert(r2.count === 2 && !r2.limited, 'lần 2: count=2, không chặn');
    assert(r3.count === 3 && !r3.limited, 'lần 3: count=3 (=max), không chặn');
    assert(r4.count === 4 && r4.limited, 'lần 4: count=4, BỊ CHẶN');
    assert(r4.retryAfterMs > 0 && r4.retryAfterMs <= windowMs, `retryAfterMs hợp lệ (${r4.retryAfterMs}ms ~ ${Math.round(r4.retryAfterMs / 60000)} phút)`);

    console.error('— Cửa sổ KHÔNG bị nới khi bị chặn —');
    assert(r4.retryAfterMs <= r1.retryAfterMs, 'retryAfter của lần 4 ≤ lần 1 (expires_at giữ nguyên)');

    console.error('— Nhánh reset: hàng có expires_at quá khứ ⇒ mở cửa sổ mới —');
    await client.query(
      `INSERT INTO "rate_limits"("key","count","window_start","expires_at","updated_at","created_at")
       VALUES ('otp_send:expired', 99, now() - interval '2 hours', now() - interval '1 hour', now(), now())`,
    );
    const reset = await consumeRateLimit(client, { key: 'otp_send:expired', max, windowMs });
    assert(reset.count === 1 && !reset.limited, 'count reset về 1 (không cộng dồn 99→100)');
    assert(reset.retryAfterMs > windowMs - 5000, 'expires_at được đặt lại ~ +1 giờ');

    console.error('— Khóa độc lập —');
    const other = await consumeRateLimit(client, { key: 'otp_send:other', max, windowMs });
    assert(other.count === 1 && !other.limited, 'khóa khác bắt đầu từ count=1');

    console.error('— evaluateRateLimit khớp count thật từ DB —');
    assert(evaluateRateLimit(r4.count, max) === true, 'evaluateRateLimit(4,3)=true');

    await client.query('ROLLBACK');
    console.error('\n✓ TẤT CẢ PASS — CONSUME_SQL chạy đúng trên Postgres. Đã ROLLBACK (không để lại gì).');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

let code = 0;
try {
  await main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  code = 1;
}
process.exit(code);
