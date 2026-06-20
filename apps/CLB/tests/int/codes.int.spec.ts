import type { Where } from 'payload'
import { describe, it, expect, vi } from 'vitest'

import { formatCode, branchFromCoSo, padSeq, yy, yyyy, yyyymm } from '@/lib/codes/format'
import {
  nextSequence,
  seedCounter,
  getCodeCounterPool,
  type CodeCounterPool,
} from '@/lib/codes/counters'
import { makeCodeHook, type CodeSpec } from '@/lib/codes/makeCodeHook'
import { lockCodeHook } from '@/lib/codes/lockCodeHook'
import { STUDENT_CODE_SPEC, PAYMENT_CODE_SPEC, REFUND_CODE_SPEC } from '@/lib/codes/field'
import { Payments, staffOnlyFieldRead } from '@/collections/Payments'
import { readByStudentRelation, staffOnly } from '@/access/parents'

/**
 * Test mã định danh nghiệp vụ (Phase 1: students/payments/refunds).
 *
 * KHÔNG cần Postgres thật: `makeFakePool` mô phỏng TRUNG THỰC ngữ nghĩa của câu
 * upsert atomic trong `counters.ts` (INSERT ... ON CONFLICT DO UPDATE value+1 /
 * GREATEST cho seed). Nhờ vậy hook + counter đi qua đúng code thật. Trọng tâm:
 * ĐỒNG THỜI (atomic), BẤT BIẾN, ROLLOVER, THIẾU CƠ SỞ, RÒ RỈ PHỤ HUYNH.
 */

// ── Fake pool: cùng ngữ nghĩa value+1 / GREATEST như SQL thật ─────────────────
function makeFakePool() {
  const store = new Map<string, number>()
  const query = vi.fn(async (text: string, params?: unknown[]) => {
    const scope = String(params?.[0])
    if (text.includes('GREATEST')) {
      // seedCounter: value = GREATEST(cur, $2)
      const seedVal = Number(params?.[1])
      const cur = store.get(scope) ?? 0
      store.set(scope, Math.max(cur, seedVal))
      return { rows: [], rowCount: 1 }
    }
    // nextSequence: value = cur + 1 (atomic — 1 statement)
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

// ─── format (thuần) ──────────────────────────────────────────────────────────
describe('format — helpers thuần', () => {
  it('padSeq đệm tối thiểu, KHÔNG cắt khi tràn', () => {
    expect(padSeq(7, 4)).toBe('0007')
    expect(padSeq(1234, 4)).toBe('1234')
    expect(padSeq(12345, 4)).toBe('12345') // tràn → in thêm chữ số
  })

  it('branchFromCoSo map đúng + null khi không hợp lệ', () => {
    expect(branchFromCoSo('kim_lien')).toBe('KL')
    expect(branchFromCoSo('vinh_phuc')).toBe('VP')
    expect(branchFromCoSo('')).toBeNull()
    expect(branchFromCoSo(undefined)).toBeNull()
    expect(branchFromCoSo('haiba_trung')).toBeNull()
  })

  it('yy/yyyy/yyyymm theo UTC', () => {
    const d = '2026-06-09T10:00:00.000Z'
    expect(yyyy(d)).toBe('2026')
    expect(yy(d)).toBe('26')
    expect(yyyymm(d)).toBe('202606')
    expect(yyyy('not-a-date')).toBeNull()
  })

  it('formatCode bỏ phần rỗng', () => {
    expect(formatCode('HV', [null, '26'], 148, 4)).toBe('HV-26-0148')
    expect(formatCode('PT', ['KL', '202606'], 32, 4)).toBe('PT-KL-202606-0032')
  })
})

// ─── Counter atomic ──────────────────────────────────────────────────────────
describe('counters — cấp số atomic', () => {
  it('nextSequence tăng dần liền mạch trong scope', async () => {
    const pool = makeFakePool()
    expect(await nextSequence(pool, 'HV:2026')).toBe(1)
    expect(await nextSequence(pool, 'HV:2026')).toBe(2)
    expect(await nextSequence(pool, 'HV:2025')).toBe(1) // scope khác → riêng
    expect(await nextSequence(pool, 'HV:2026')).toBe(3)
  })

  it('seedCounter dùng GREATEST — không lùi số', async () => {
    const pool = makeFakePool()
    await seedCounter(pool, 'PT:KL:202606', 10)
    expect(await nextSequence(pool, 'PT:KL:202606')).toBe(11)
    await seedCounter(pool, 'PT:KL:202606', 5) // nhỏ hơn → giữ nguyên
    expect(await nextSequence(pool, 'PT:KL:202606')).toBe(12)
  })

  it('getCodeCounterPool throw rõ ràng khi thiếu pool', () => {
    expect(() => getCodeCounterPool({ db: {} })).toThrow(/pool/i)
  })
})

// ─── ĐỒNG THỜI (quan trọng nhất) ──────────────────────────────────────────────
describe('đồng thời — N=50 song song, mã duy nhất + liền mạch', () => {
  it('Students: 50 create song song → 50 mã HV-26-NNNN duy nhất, seq 1..50', async () => {
    const pool = makeFakePool()
    const datas = Array.from({ length: 50 }, () => ({
      createdAt: '2026-03-15T00:00:00.000Z',
    })) as Record<string, unknown>[]

    await Promise.all(datas.map((d) => runHook(STUDENT_CODE_SPEC, pool, d)))

    const codes = datas.map((d) => d.code as string)
    expect(new Set(codes).size).toBe(50) // duy nhất
    for (const c of codes) expect(c).toMatch(/^HV-26-\d{4}$/)
    const seqs = codes.map((c) => Number(c.split('-')[2])).sort((a, b) => a - b)
    expect(seqs).toEqual(Array.from({ length: 50 }, (_, i) => i + 1)) // liền mạch
  })

  it('Payments: 50 create song song cùng cơ sở+tháng → seq 1..50 liền mạch', async () => {
    const pool = makeFakePool()
    const datas = Array.from({ length: 50 }, () => ({
      ngayNop: '2026-06-01T00:00:00.000Z',
      coSo: 'kim_lien',
    })) as Record<string, unknown>[]

    await Promise.all(datas.map((d) => runHook(PAYMENT_CODE_SPEC, pool, d)))

    const codes = datas.map((d) => d.code as string)
    expect(new Set(codes).size).toBe(50)
    for (const c of codes) expect(c).toMatch(/^PT-KL-202606-\d{4}$/)
    const seqs = codes.map((c) => Number(c.split('-')[3])).sort((a, b) => a - b)
    expect(seqs).toEqual(Array.from({ length: 50 }, (_, i) => i + 1))
  })
})

// ─── ROLLOVER năm/tháng ───────────────────────────────────────────────────────
describe('rollover — reset seq theo kỳ', () => {
  it('Students: 31/12 và 01/01 reset seq theo năm', async () => {
    const pool = makeFakePool()
    const dec = { createdAt: '2025-12-31T23:00:00.000Z' } as Record<string, unknown>
    const jan = { createdAt: '2026-01-01T01:00:00.000Z' } as Record<string, unknown>
    await runHook(STUDENT_CODE_SPEC, pool, dec)
    await runHook(STUDENT_CODE_SPEC, pool, jan)
    expect(dec.code).toBe('HV-25-0001')
    expect(jan.code).toBe('HV-26-0001') // năm mới reset
  })

  it('Payments: 06→07 reset seq theo tháng', async () => {
    const pool = makeFakePool()
    const jun = { ngayNop: '2026-06-30T00:00:00.000Z', coSo: 'vinh_phuc' } as Record<
      string,
      unknown
    >
    const jul = { ngayNop: '2026-07-01T00:00:00.000Z', coSo: 'vinh_phuc' } as Record<
      string,
      unknown
    >
    await runHook(PAYMENT_CODE_SPEC, pool, jun)
    await runHook(PAYMENT_CODE_SPEC, pool, jul)
    expect(jun.code).toBe('PT-VP-202606-0001')
    expect(jul.code).toBe('PT-VP-202607-0001')
  })

  it('Payments cùng tháng nhưng KHÁC cơ sở → seq riêng', async () => {
    const pool = makeFakePool()
    const kl = { ngayNop: '2026-06-10T00:00:00.000Z', coSo: 'kim_lien' } as Record<string, unknown>
    const vp = { ngayNop: '2026-06-10T00:00:00.000Z', coSo: 'vinh_phuc' } as Record<string, unknown>
    await runHook(PAYMENT_CODE_SPEC, pool, kl)
    await runHook(PAYMENT_CODE_SPEC, pool, vp)
    expect(kl.code).toBe('PT-KL-202606-0001')
    expect(vp.code).toBe('PT-VP-202606-0001')
  })

  it('Refunds: mốc kỳ theo ngayHoan', async () => {
    const pool = makeFakePool()
    const r = { ngayHoan: '2026-06-05T00:00:00.000Z', coSo: 'kim_lien' } as Record<string, unknown>
    await runHook(REFUND_CODE_SPEC, pool, r)
    expect(r.code).toBe('PH-KL-202606-0001')
  })
})

// ─── THIẾU CƠ SỞ ──────────────────────────────────────────────────────────────
describe('thiếu cơ sở — lỗi rõ ràng', () => {
  it('Payment không coSo → throw', async () => {
    const pool = makeFakePool()
    await expect(
      runHook(PAYMENT_CODE_SPEC, pool, { ngayNop: '2026-06-01T00:00:00.000Z' }),
    ).rejects.toThrow(/cơ sở/i)
  })

  it('Refund coSo không hợp lệ → throw', async () => {
    const pool = makeFakePool()
    await expect(
      runHook(REFUND_CODE_SPEC, pool, { ngayHoan: '2026-06-01T00:00:00.000Z', coSo: 'xxx' }),
    ).rejects.toThrow(/cơ sở/i)
  })
})

// ─── BẤT BIẾN (lockCodeHook) ──────────────────────────────────────────────────
describe('bất biến — lockCodeHook chặn sửa code mọi vai trò', () => {
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

  it('update đổi code (kể cả admin) → throw', () => {
    expect(() => run({ code: 'HV-26-9999' }, { code: 'HV-26-0001' })).toThrow(/bất biến/i)
  })

  it('update field khác (không gửi code) → OK', () => {
    expect(run({ fullName: 'A' }, { code: 'HV-26-0001' })).toEqual({ fullName: 'A' })
  })

  it('gửi lại code y nguyên → OK (không coi là sửa)', () => {
    expect(run({ code: 'HV-26-0001' }, { code: 'HV-26-0001' })).toEqual({ code: 'HV-26-0001' })
  })

  it('create → bỏ qua (chưa có originalDoc)', () => {
    expect(run({ code: 'HV-26-0001' }, {}, 'create')).toEqual({ code: 'HV-26-0001' })
  })
})

// ─── makeCodeHook giữ mã sẵn có ───────────────────────────────────────────────
describe('makeCodeHook — không ghi đè mã đã có', () => {
  it('data.code đã có (migration/khôi phục) → giữ nguyên, không cấp số', async () => {
    const pool = makeFakePool()
    const data = { createdAt: '2026-01-01T00:00:00.000Z', code: 'HV-26-0500' } as Record<
      string,
      unknown
    >
    await runHook(STUDENT_CODE_SPEC, pool, data)
    expect(data.code).toBe('HV-26-0500')
    expect(pool.query).not.toHaveBeenCalled()
  })

  it('operation=update → bỏ qua', async () => {
    const pool = makeFakePool()
    const data = { createdAt: '2026-01-01T00:00:00.000Z' } as Record<string, unknown>
    await makeCodeHook(STUDENT_CODE_SPEC)({
      data,
      operation: 'update',
      req: { payload: fakePayload(pool) },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    expect(data.code).toBeUndefined()
    expect(pool.query).not.toHaveBeenCalled()
  })
})

// ─── 🔒 RÒ RỈ PHỤ HUYNH ───────────────────────────────────────────────────────
describe('🔒 firewall học phí — phụ huynh đọc Payments scoped + field ẩn', () => {
  const staff = { collection: 'users', role: 'admin' }
  const parentA = { collection: 'parents', id: 101, children: [1001] }
  const parentB = { collection: 'parents', id: 102, children: [1002] }
  const anon = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const asReq = (user: unknown) => ({ req: { user } }) as any

  const isWhere = (v: unknown): v is Where =>
    typeof v === 'object' && v !== null && !Array.isArray(v)

  it('Payments.read: phụ huynh chỉ thấy payment của con mình (Where student.in)', () => {
    const read = readByStudentRelation()
    const outA = read(asReq(parentA))
    expect(isWhere(outA)).toBe(true)
    expect((outA as { student?: { in?: number[] } }).student?.in).toEqual([1001])

    const outB = read(asReq(parentB))
    expect((outB as { student?: { in?: number[] } }).student?.in).toEqual([1002])
    // A không bao giờ thấy con của B
    expect((outA as { student?: { in?: number[] } }).student?.in).not.toContain(1002)
  })

  it('Payments.read: anonymous bị cấm', () => {
    expect(readByStudentRelation()(asReq(anon))).toBe(false)
  })

  it('Payments.read: staff full access', () => {
    expect(staffOnly(asReq(staff))).toBe(true)
  })

  it('field nhạy cảm: phụ huynh KHÔNG đọc; staff đọc được', () => {
    expect(staffOnlyFieldRead(asReq(parentA))).toBe(false)
    expect(staffOnlyFieldRead(asReq(parentB))).toBe(false)
    expect(staffOnlyFieldRead(asReq(anon))).toBe(false)
    expect(staffOnlyFieldRead(asReq(staff))).toBe(true)
  })

  it('config Payments: field nhạy cảm gắn read=staffOnlyFieldRead; code & ngayNop & tiền KHÔNG ẩn', () => {
    const fieldsByName = new Map(
      Payments.fields
        .filter((f): f is { name: string; access?: { read?: unknown } } => 'name' in f)
        .map((f) => [f.name, f]),
    )
    const hidden = [
      'tuitionCycle',
      'hp1Buoi',
      'soBuoiNop',
      'coSo',
      'tinhTrang',
      'anhBill',
      'ghiChu',
    ]
    for (const name of hidden) {
      expect(fieldsByName.get(name)?.access?.read).toBe(staffOnlyFieldRead)
    }
    // An toàn cho phụ huynh ⇒ KHÔNG có field-level read.
    const safe = ['code', 'ngayNop', 'student', 'hocPhi', 'tienSach', 'muaKhac']
    for (const name of safe) {
      expect(fieldsByName.get(name)?.access?.read).toBeUndefined()
    }
  })
})
