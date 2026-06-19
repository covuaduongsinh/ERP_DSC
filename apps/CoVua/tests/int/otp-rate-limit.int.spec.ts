import { describe, it, expect, vi } from 'vitest'

import {
  evaluateRateLimit,
  consumeRateLimit,
  getRateLimitPool,
  type RateLimitPool,
} from '@/lib/rate-limit'
import {
  consumeOtpSendRateLimit,
  otpSendRateLimitKey,
  OTP_SEND_MAX_PER_WINDOW,
  OTP_SEND_WINDOW_MS,
} from '@/lib/otp'

/**
 * Test rate-limit BỀN-DB cho gửi OTP — trọng tâm: VƯỢT NGƯỠNG.
 *
 * Không cần Postgres thật: dùng `fakePool` mô phỏng TRUNG THỰC ngữ nghĩa của câu
 * upsert cửa sổ cố định trong `CONSUME_SQL` (mở cửa sổ mới khi hết hạn; trong cửa
 * sổ thì count+1 và GIỮ expires_at). Đồng hồ điều khiển được để test reset cửa
 * sổ. Nhờ vậy bài test đi qua đúng code thật của `consumeRateLimit` /
 * `consumeOtpSendRateLimit` (truyền tham số, parse RETURNING, quyết định limited).
 */

// ── Fake pool: cùng logic CASE WHEN expires_at <= now() như SQL ───────────────
function makeFakePool(clock: { now: number }) {
  const store = new Map<string, { count: number; expiresAt: number }>()
  const query = vi.fn(
    async (_text: string, params?: unknown[]) => {
      const key = String(params?.[0])
      const windowMs = Number(params?.[1])
      const t = clock.now
      const cur = store.get(key)
      const entry =
        !cur || cur.expiresAt <= t
          ? { count: 1, expiresAt: t + windowMs } // mở cửa sổ mới
          : { count: cur.count + 1, expiresAt: cur.expiresAt } // trong cửa sổ
      store.set(key, entry)
      const retry_after_ms = Math.max(0, Math.ceil(entry.expiresAt - t))
      return {
        rows: [
          {
            count: entry.count,
            expires_at: new Date(entry.expiresAt).toISOString(),
            retry_after_ms,
          },
        ],
        rowCount: 1,
      }
    },
  )
  return { query, store } as RateLimitPool & { store: typeof store }
}

const fakePayload = (pool: RateLimitPool) => ({ db: { pool } })

describe('evaluateRateLimit (thuần)', () => {
  it('cho phép count 1..max, chặn từ max+1 trở đi', () => {
    const max = OTP_SEND_MAX_PER_WINDOW
    expect(evaluateRateLimit(1, max)).toBe(false)
    expect(evaluateRateLimit(max, max)).toBe(false) // lần thứ 3 vẫn qua
    expect(evaluateRateLimit(max + 1, max)).toBe(true) // lần thứ 4 chặn
    expect(evaluateRateLimit(max + 5, max)).toBe(true)
  })
})

describe('consumeRateLimit — vượt ngưỡng', () => {
  it('3 lần đầu không bị chặn, lần thứ 4 bị chặn (max=3)', async () => {
    const clock = { now: 1_700_000_000_000 }
    const pool = makeFakePool(clock)
    const opts = { key: 'k', max: 3, windowMs: 60_000 }

    const r1 = await consumeRateLimit(pool, opts)
    const r2 = await consumeRateLimit(pool, opts)
    const r3 = await consumeRateLimit(pool, opts)
    const r4 = await consumeRateLimit(pool, opts)

    expect([r1.limited, r2.limited, r3.limited]).toEqual([false, false, false])
    expect([r1.count, r2.count, r3.count]).toEqual([1, 2, 3])
    expect(r4.limited).toBe(true)
    expect(r4.count).toBe(4)
    expect(r4.retryAfterMs).toBeGreaterThan(0)
  })

  it('các khóa khác nhau là các xô độc lập', async () => {
    const clock = { now: 0 }
    const pool = makeFakePool(clock)
    const a = { key: 'a', max: 1, windowMs: 1_000 }
    const b = { key: 'b', max: 1, windowMs: 1_000 }

    expect((await consumeRateLimit(pool, a)).limited).toBe(false)
    expect((await consumeRateLimit(pool, a)).limited).toBe(true) // a vượt
    expect((await consumeRateLimit(pool, b)).limited).toBe(false) // b vẫn sạch
  })

  it('hết cửa sổ ⇒ reset: lại được gửi và count về 1', async () => {
    const clock = { now: 0 }
    const pool = makeFakePool(clock)
    const opts = { key: 'k', max: 1, windowMs: 1_000 }

    expect((await consumeRateLimit(pool, opts)).limited).toBe(false) // count 1
    expect((await consumeRateLimit(pool, opts)).limited).toBe(true) // count 2 > 1

    clock.now = 1_001 // qua mốc expires_at (0 + 1000)
    const after = await consumeRateLimit(pool, opts)
    expect(after.limited).toBe(false)
    expect(after.count).toBe(1)
  })

  it('trong cửa sổ KHÔNG nới hạn: retryAfter giảm dần theo thời gian', async () => {
    const clock = { now: 0 }
    const pool = makeFakePool(clock)
    const opts = { key: 'k', max: 1, windowMs: 1_000 }

    await consumeRateLimit(pool, opts) // mở cửa sổ, expires_at = 1000
    clock.now = 600
    const blocked = await consumeRateLimit(pool, opts)
    expect(blocked.limited).toBe(true)
    expect(blocked.retryAfterMs).toBe(400) // 1000 - 600, cửa sổ không bị đẩy
  })
})

describe('consumeOtpSendRateLimit — binding OTP', () => {
  it('chặn lần gửi thứ 4 trong giờ cho cùng 1 SĐT', async () => {
    const clock = { now: 1_700_000_000_000 }
    const pool = makeFakePool(clock)
    const payload = fakePayload(pool)
    const phone = '0987654321'

    const results = []
    for (let i = 0; i < OTP_SEND_MAX_PER_WINDOW + 1; i++) {
      results.push(await consumeOtpSendRateLimit(payload, phone))
    }

    expect(results.slice(0, OTP_SEND_MAX_PER_WINDOW).every((r) => !r.limited)).toBe(true)
    expect(results[OTP_SEND_MAX_PER_WINDOW].limited).toBe(true)

    // Dùng đúng khóa + cửa sổ 1 giờ
    const call = pool.query.mock.calls[0]
    expect(call[1]).toEqual([otpSendRateLimitKey(phone), OTP_SEND_WINDOW_MS])
  })

  it('hai SĐT khác nhau không ảnh hưởng nhau', async () => {
    const clock = { now: 0 }
    const pool = makeFakePool(clock)
    const payload = fakePayload(pool)

    for (let i = 0; i < OTP_SEND_MAX_PER_WINDOW; i++) {
      await consumeOtpSendRateLimit(payload, '0900000001')
    }
    const a4 = await consumeOtpSendRateLimit(payload, '0900000001')
    const b1 = await consumeOtpSendRateLimit(payload, '0900000002')

    expect(a4.limited).toBe(true)
    expect(b1.limited).toBe(false)
  })

  it('thiếu pool ⇒ ném lỗi rõ ràng (caller coi như lỗi server)', () => {
    expect(() => getRateLimitPool({ db: {} })).toThrow(/pool/i)
  })
})
