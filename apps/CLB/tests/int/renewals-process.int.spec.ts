import type { Access, Payload } from 'payload'
import { describe, it, expect, vi } from 'vitest'

// Lưu ý: `lib/renewals/process.ts` mở đầu bằng `import 'server-only'`;
// vitest.config alias `server-only` → module rỗng để test được core thuần.

import type { RenewalRequest, TuitionCycle, User } from '@/payload-types'
import {
  approveRenewalRequest,
  rejectRenewalRequest,
  RENEWAL_PACKAGE_SESSIONS,
  PROCESSABLE_RENEWAL_STATUSES,
} from '@/lib/renewals/process'
import { RenewalRequests } from '@/collections/RenewalRequests'
import { RENEWAL_PROCESSOR_ROLES } from '@/access'

// ─── Actors ─────────────────────────────────────────────────────────────────
const accountant = { id: 1, collection: 'users', role: 'accountant' } as unknown as User
const manager = { id: 2, collection: 'users', role: 'manager' } as unknown as User
const admin = { id: 3, collection: 'users', role: 'admin' } as unknown as User
const coach = { id: 4, collection: 'users', role: 'coach' } as unknown as User
const receptionist = { id: 5, collection: 'users', role: 'receptionist' } as unknown as User
const parentA = { id: 101, collection: 'parents', children: [1001] } as const
const anon = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asReq = (user: any) => ({ req: { user } }) as any

// ─── Fake Payload có store trong bộ nhớ ──────────────────────────────────────
function makeFakePayload(initial: RenewalRequest[]) {
  const requests = new Map<number, RenewalRequest>()
  for (const r of initial) requests.set(r.id, { ...r })
  const cycles = new Map<number, TuitionCycle>()
  let nextCycleId = 5000

  const findByID = vi.fn(async ({ id }: { id: number }) => {
    const doc = requests.get(id)
    if (!doc) throw new Error('NotFound')
    return { ...doc }
  })
  const create = vi.fn(async ({ data }: { data: Partial<TuitionCycle> }) => {
    const id = ++nextCycleId
    const doc = { id, ...data } as TuitionCycle
    cycles.set(id, doc)
    return { ...doc }
  })
  const update = vi.fn(async ({ id, data }: { id: number; data: Partial<RenewalRequest> }) => {
    const doc = requests.get(id)
    if (!doc) throw new Error('NotFound')
    const next = { ...doc, ...data }
    requests.set(id, next)
    return next
  })
  // Fake KHÔNG có `db` ⇒ approveRenewalRequest rơi về nhánh bù trừ (xóa chu kỳ
  // mồ côi) khi update lỗi. `delete` gỡ chu kỳ khỏi store như prod.
  const del = vi.fn(async ({ id }: { id: number }) => {
    cycles.delete(id)
    return { id }
  })

  return { requests, cycles, findByID, create, update, delete: del } as unknown as Payload & {
    requests: Map<number, RenewalRequest>
    cycles: Map<number, TuitionCycle>
    findByID: typeof findByID
    create: typeof create
    update: typeof update
    delete: typeof del
  }
}

function pending(
  id: number,
  student: number,
  overrides: Partial<RenewalRequest> = {},
): RenewalRequest {
  return {
    id,
    student,
    parent: 101,
    sessionsRemaining: 2,
    status: 'moi',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  } as RenewalRequest
}

// ──────────────────────────────────────────────────────────────────────────────
describe('hằng số nghiệp vụ', () => {
  it('PROCESSABLE_RENEWAL_STATUSES = moi | dang_xu_ly', () => {
    expect(PROCESSABLE_RENEWAL_STATUSES).toEqual(['moi', 'dang_xu_ly'])
  })
  it('gói buổi → tổng buổi khớp options TuitionCycles', () => {
    expect(RENEWAL_PACKAGE_SESSIONS).toEqual({ '10': 10, '20': 20, '40': 40 })
  })
})

describe('approveRenewalRequest — gate role (chỉ kế toán/quản lý/admin)', () => {
  it.each([
    ['accountant', accountant],
    ['manager', manager],
    ['admin', admin],
  ])('%s ĐƯỢC duyệt', async (_label, actor) => {
    const payload = makeFakePayload([pending(1, 1001)])
    const res = await approveRenewalRequest(payload, actor, {
      id: 1,
      package: '20',
      startDate: '2026-06-02',
      confirm: true,
    })
    expect(res.ok).toBe(true)
  })

  it.each([
    ['coach', coach],
    ['receptionist', receptionist],
  ])('%s BỊ chặn (forbidden), KHÔNG đụng DB', async (_label, actor) => {
    const payload = makeFakePayload([pending(1, 1001)])
    const res = await approveRenewalRequest(payload, actor, {
      id: 1,
      package: '20',
      startDate: '2026-06-02',
      confirm: true,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('forbidden')
    expect(payload.findByID).not.toHaveBeenCalled()
    expect(payload.create).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })
})

describe('approveRenewalRequest — guard chống duyệt nhầm', () => {
  it('không xác nhận ⇒ not_confirmed, KHÔNG đụng DB', async () => {
    const payload = makeFakePayload([pending(1, 1001)])
    const res = await approveRenewalRequest(payload, accountant, {
      id: 1,
      package: '20',
      startDate: '2026-06-02',
      confirm: false,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('not_confirmed')
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('gói buổi không hợp lệ ⇒ invalid_input', async () => {
    const payload = makeFakePayload([pending(1, 1001)])
    const res = await approveRenewalRequest(payload, accountant, {
      id: 1,
      // @ts-expect-error cố tình truyền sai để test guard
      package: '99',
      startDate: '2026-06-02',
      confirm: true,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('invalid_input')
  })

  it('ngày bắt đầu không hợp lệ ⇒ invalid_input', async () => {
    const payload = makeFakePayload([pending(1, 1001)])
    const res = await approveRenewalRequest(payload, accountant, {
      id: 1,
      package: '20',
      startDate: 'not-a-date',
      confirm: true,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('invalid_input')
  })

  it('expectedEndDate trước startDate ⇒ invalid_input', async () => {
    const payload = makeFakePayload([pending(1, 1001)])
    const res = await approveRenewalRequest(payload, accountant, {
      id: 1,
      package: '20',
      startDate: '2026-06-02',
      expectedEndDate: '2026-06-01',
      confirm: true,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('invalid_input')
  })

  it('yêu cầu đã chốt ⇒ already_processed, KHÔNG tạo chu kỳ', async () => {
    const payload = makeFakePayload([pending(1, 1001, { status: 'da_chot' })])
    const res = await approveRenewalRequest(payload, accountant, {
      id: 1,
      package: '20',
      startDate: '2026-06-02',
      confirm: true,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('already_processed')
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('id không tồn tại ⇒ not_found', async () => {
    const payload = makeFakePayload([])
    const res = await approveRenewalRequest(payload, accountant, {
      id: 999,
      package: '20',
      startDate: '2026-06-02',
      confirm: true,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('not_found')
  })
})

describe('approveRenewalRequest — duyệt thành công', () => {
  it('tạo chu kỳ ĐÚNG học viên/ngày/gói; chuyển yêu cầu sang da_chot + link cycle', async () => {
    const payload = makeFakePayload([pending(7, 1001)])
    const res = await approveRenewalRequest(payload, accountant, {
      id: 7,
      package: '40',
      startDate: '2026-06-02',
      expectedEndDate: '2026-09-02',
      staffNote: 'PH chốt gói 40',
      confirm: true,
    })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.studentId).toBe(1001)
    expect(res.sessionsTotal).toBe(40)

    // Chu kỳ mới: đúng học viên + gói + tổng buổi + ngày bắt đầu + trạng thái
    const cycle = payload.cycles.get(res.tuitionCycleId)
    expect(cycle?.student).toBe(1001)
    expect(cycle?.package).toBe('40')
    expect(cycle?.sessionsTotal).toBe(40)
    expect(cycle?.status).toBe('dang_hoc')
    expect(cycle?.startDate).toBe(new Date('2026-06-02').toISOString())
    expect(cycle?.expectedEndDate).toBe(new Date('2026-09-02').toISOString())

    // Yêu cầu: da_chot + gắn cycle + ghi staffNote
    const reqDoc = payload.requests.get(7)
    expect(reqDoc?.status).toBe('da_chot')
    expect(reqDoc?.tuitionCycle).toBe(res.tuitionCycleId)
    expect(reqDoc?.staffNote).toBe('PH chốt gói 40')

    // defense-in-depth: mọi ghi đều overrideAccess:false + đúng actor
    const createCall = payload.create.mock.calls[0][0] as {
      collection: string
      overrideAccess: boolean
      user: User
    }
    expect(createCall.collection).toBe('tuition-cycles')
    expect(createCall.overrideAccess).toBe(false)
    expect(createCall.user).toBe(accountant)
    const updateCall = payload.update.mock.calls[0][0] as {
      collection: string
      overrideAccess: boolean
      user: User
    }
    expect(updateCall.collection).toBe('renewal-requests')
    expect(updateCall.overrideAccess).toBe(false)
    expect(updateCall.user).toBe(accountant)
  })

  it('update lỗi sau khi tạo chu kỳ ⇒ gỡ chu kỳ mồ côi; retry KHÔNG nhân đôi', async () => {
    const payload = makeFakePayload([pending(10, 1003)])
    // Ép bước update (chốt yêu cầu) lỗi đúng MỘT lần — mô phỏng lỗi DB giữa chừng.
    payload.update.mockImplementationOnce(async () => {
      throw new Error('DB write 2 failed')
    })

    const first = await approveRenewalRequest(payload, accountant, {
      id: 10,
      package: '20',
      startDate: '2026-06-02',
      confirm: true,
    })
    expect(first.ok).toBe(false)
    if (!first.ok) expect(first.error).toBe('server')
    // Chu kỳ vừa tạo phải bị gỡ (bù trừ) ⇒ KHÔNG mồ côi.
    expect(payload.delete).toHaveBeenCalledTimes(1)
    expect(payload.cycles.size).toBe(0)
    // Yêu cầu giữ nguyên trạng thái chờ (update đã rollback) ⇒ duyệt lại được.
    expect(payload.requests.get(10)?.status).toBe('moi')

    const retry = await approveRenewalRequest(payload, accountant, {
      id: 10,
      package: '20',
      startDate: '2026-06-02',
      confirm: true,
    })
    expect(retry.ok).toBe(true)
    // Sau retry thành công: ĐÚNG 1 chu kỳ, yêu cầu đã chốt.
    expect(payload.cycles.size).toBe(1)
    expect(payload.requests.get(10)?.status).toBe('da_chot')
  })

  it('duyệt lại sau khi đã chốt ⇒ already_processed (không sinh cycle thứ 2)', async () => {
    const payload = makeFakePayload([pending(8, 1002)])
    const first = await approveRenewalRequest(payload, manager, {
      id: 8,
      package: '10',
      startDate: '2026-06-02',
      confirm: true,
    })
    expect(first.ok).toBe(true)
    const second = await approveRenewalRequest(payload, manager, {
      id: 8,
      package: '10',
      startDate: '2026-06-02',
      confirm: true,
    })
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.error).toBe('already_processed')
    expect(payload.cycles.size).toBe(1)
  })
})

describe('rejectRenewalRequest', () => {
  it('thiếu lý do ⇒ invalid_input, KHÔNG đụng DB', async () => {
    const payload = makeFakePayload([pending(1, 1001)])
    const res = await rejectRenewalRequest(payload, accountant, {
      id: 1,
      reason: '   ',
      confirm: true,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('invalid_input')
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('từ chối ⇒ da_huy + ghi lý do vào staffNote', async () => {
    const payload = makeFakePayload([pending(9, 1001)])
    const res = await rejectRenewalRequest(payload, accountant, {
      id: 9,
      reason: 'Phụ huynh đổi ý',
      confirm: true,
    })
    expect(res.ok).toBe(true)
    const reqDoc = payload.requests.get(9)
    expect(reqDoc?.status).toBe('da_huy')
    expect(reqDoc?.staffNote).toBe('Phụ huynh đổi ý')
  })

  it('coach BỊ chặn (forbidden)', async () => {
    const payload = makeFakePayload([pending(1, 1001)])
    const res = await rejectRenewalRequest(payload, coach, {
      id: 1,
      reason: 'x',
      confirm: true,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('forbidden')
  })

  it('yêu cầu đã xử lý ⇒ already_processed', async () => {
    const payload = makeFakePayload([pending(1, 1001, { status: 'da_huy' })])
    const res = await rejectRenewalRequest(payload, manager, {
      id: 1,
      reason: 'x',
      confirm: true,
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('already_processed')
  })
})

// ── Acceptance: access control của collection chặn đúng role ──────────────────
describe('Acceptance — collection access (update gate role)', () => {
  const update = RenewalRequests.access?.update as Access

  it('kế toán/quản lý/admin được ghi; coach/lễ tân/phụ huynh/anon bị chặn', () => {
    for (const actor of [accountant, manager, admin]) {
      expect(update(asReq(actor))).toBe(true)
    }
    for (const actor of [coach, receptionist]) {
      expect(update(asReq(actor))).toBe(false)
    }
    expect(update(asReq(parentA))).toBe(false)
    expect(update(asReq(anon))).toBe(false)
  })

  it('RENEWAL_PROCESSOR_ROLES = admin | manager | accountant', () => {
    expect([...RENEWAL_PROCESSOR_ROLES].sort()).toEqual(['accountant', 'admin', 'manager'])
  })
})
