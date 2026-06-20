import { describe, it, expect, vi } from 'vitest'

import { makeCodeHook, type CodeSpec } from '@/lib/codes/makeCodeHook'
import { lockCodeHook } from '@/lib/codes/lockCodeHook'
import {
  ENROLLMENT_CODE_SPEC,
  TUITION_CYCLE_CODE_SPEC,
  RENEWAL_REQUEST_CODE_SPEC,
  PROGRESS_REPORT_CODE_SPEC,
} from '@/lib/codes/field'
import type { CodeCounterPool } from '@/lib/codes/counters'

/**
 * Test mã định danh nghiệp vụ — Phase 2 (enrollments / tuition_cycles /
 * renewal_requests / progress_reports). Tất cả BRANCHLESS.
 *
 * Cùng kỹ thuật Phase 1: `makeFakePool` mô phỏng TRUNG THỰC ngữ nghĩa atomic
 * (INSERT ... ON CONFLICT DO UPDATE value+1) nên hook đi qua đúng code thật.
 * Trọng tâm: ĐỒNG THỜI (N=50), ROLLOVER năm/tháng, BẤT BIẾN. Enrollments
 * (reset/năm) + RenewalRequests (reset/tháng) phủ cả 2 kiểu reset.
 */

// ── Fake pool: cùng ngữ nghĩa value+1 / GREATEST như SQL thật ─────────────────
function makeFakePool() {
  const store = new Map<string, number>()
  const query = vi.fn(async (text: string, params?: unknown[]) => {
    const scope = String(params?.[0])
    if (text.includes('GREATEST')) {
      const seedVal = Number(params?.[1])
      const cur = store.get(scope) ?? 0
      store.set(scope, Math.max(cur, seedVal))
      return { rows: [], rowCount: 1 }
    }
    const next = (store.get(scope) ?? 0) + 1
    store.set(scope, next)
    return { rows: [{ value: next }], rowCount: 1 }
  })
  return { query, store } as CodeCounterPool & { store: Map<string, number> }
}

const fakePayload = (pool: CodeCounterPool) => ({ db: { pool } })

const runHook = (spec: CodeSpec, pool: CodeCounterPool, data: Record<string, unknown>) =>
  makeCodeHook(spec)({
    data,
    operation: 'create',
    req: { payload: fakePayload(pool) },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)

// ─── ĐỒNG THỜI (quan trọng nhất) ──────────────────────────────────────────────
describe('Phase 2 đồng thời — N=50 song song, mã duy nhất + liền mạch', () => {
  it('Enrollments: 50 create song song → 50 mã GD-26-NNNNN duy nhất, seq 1..50', async () => {
    const pool = makeFakePool()
    const datas = Array.from({ length: 50 }, () => ({
      createdAt: '2026-03-15T00:00:00.000Z',
    })) as Record<string, unknown>[]

    await Promise.all(datas.map((d) => runHook(ENROLLMENT_CODE_SPEC, pool, d)))

    const codes = datas.map((d) => d.code as string)
    expect(new Set(codes).size).toBe(50)
    for (const c of codes) expect(c).toMatch(/^GD-26-\d{5}$/)
    const seqs = codes.map((c) => Number(c.split('-')[2])).sort((a, b) => a - b)
    expect(seqs).toEqual(Array.from({ length: 50 }, (_, i) => i + 1))
  })

  it('RenewalRequests: 50 create song song cùng tháng → seq 1..50 liền mạch', async () => {
    const pool = makeFakePool()
    const datas = Array.from({ length: 50 }, () => ({
      createdAt: '2026-06-01T00:00:00.000Z',
    })) as Record<string, unknown>[]

    await Promise.all(datas.map((d) => runHook(RENEWAL_REQUEST_CODE_SPEC, pool, d)))

    const codes = datas.map((d) => d.code as string)
    expect(new Set(codes).size).toBe(50)
    for (const c of codes) expect(c).toMatch(/^GH-202606-\d{4}$/)
    const seqs = codes.map((c) => Number(c.split('-')[2])).sort((a, b) => a - b)
    expect(seqs).toEqual(Array.from({ length: 50 }, (_, i) => i + 1))
  })
})

// ─── ROLLOVER năm/tháng ───────────────────────────────────────────────────────
describe('Phase 2 rollover — reset seq theo kỳ', () => {
  it('Enrollments: 31/12 và 01/01 reset seq theo năm', async () => {
    const pool = makeFakePool()
    const dec = { createdAt: '2025-12-31T23:00:00.000Z' } as Record<string, unknown>
    const jan = { createdAt: '2026-01-01T01:00:00.000Z' } as Record<string, unknown>
    await runHook(ENROLLMENT_CODE_SPEC, pool, dec)
    await runHook(ENROLLMENT_CODE_SPEC, pool, jan)
    expect(dec.code).toBe('GD-25-00001')
    expect(jan.code).toBe('GD-26-00001')
  })

  it('RenewalRequests: 06→07 reset seq theo tháng', async () => {
    const pool = makeFakePool()
    const jun = { createdAt: '2026-06-30T00:00:00.000Z' } as Record<string, unknown>
    const jul = { createdAt: '2026-07-01T00:00:00.000Z' } as Record<string, unknown>
    await runHook(RENEWAL_REQUEST_CODE_SPEC, pool, jun)
    await runHook(RENEWAL_REQUEST_CODE_SPEC, pool, jul)
    expect(jun.code).toBe('GH-202606-0001')
    expect(jul.code).toBe('GH-202607-0001')
  })

  it('TuitionCycles: mốc kỳ theo startDate (fallback createdAt)', async () => {
    const pool = makeFakePool()
    // startDate có giá trị → dùng startDate (năm 2026), bỏ qua createdAt (2025).
    const withStart = {
      startDate: '2026-02-01T00:00:00.000Z',
      createdAt: '2025-12-01T00:00:00.000Z',
    } as Record<string, unknown>
    // startDate null → fallback createdAt (năm 2025).
    const fallback = { createdAt: '2025-05-01T00:00:00.000Z' } as Record<string, unknown>
    await runHook(TUITION_CYCLE_CODE_SPEC, pool, withStart)
    await runHook(TUITION_CYCLE_CODE_SPEC, pool, fallback)
    expect(withStart.code).toBe('CK-26-00001')
    expect(fallback.code).toBe('CK-25-00001') // năm khác → scope riêng
  })

  it('ProgressReports: mốc kỳ theo createdAt (publishedAt KHÔNG dùng)', async () => {
    const pool = makeFakePool()
    // publishedAt khác năm createdAt — hook PHẢI bỏ qua publishedAt, chỉ dùng createdAt.
    const data = {
      createdAt: '2026-04-10T00:00:00.000Z',
      publishedAt: '2025-12-31T00:00:00.000Z',
    } as Record<string, unknown>
    await runHook(PROGRESS_REPORT_CODE_SPEC, pool, data)
    expect(data.code).toBe('BC-26-00001')
  })
})

// ─── BẤT BIẾN (lockCodeHook) ──────────────────────────────────────────────────
describe('Phase 2 bất biến — lockCodeHook chặn sửa code mọi vai trò', () => {
  const admin = { collection: 'users', role: 'admin' }
  const run = (
    data: Record<string, unknown> | undefined,
    originalDoc: Record<string, unknown>,
    operation = 'update',
  ) =>
    lockCodeHook({
      data,
      operation,
      originalDoc,
      req: { user: admin },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

  it('Enrollments: update đổi code (kể cả admin) → throw', () => {
    expect(() => run({ code: 'GD-26-99999' }, { code: 'GD-26-00001' })).toThrow(/bất biến/i)
  })

  it('Enrollments: update field khác (không gửi code) → OK', () => {
    expect(run({ dangHoc: true }, { code: 'GD-26-00001' })).toEqual({ dangHoc: true })
  })

  it('RenewalRequests: gửi lại code y nguyên → OK', () => {
    expect(run({ code: 'GH-202606-0001' }, { code: 'GH-202606-0001' })).toEqual({
      code: 'GH-202606-0001',
    })
  })

  it('RenewalRequests: đổi code → throw', () => {
    expect(() => run({ code: 'GH-202607-0001' }, { code: 'GH-202606-0001' })).toThrow(/bất biến/i)
  })
})
