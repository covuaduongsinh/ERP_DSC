import type { Access, Payload, Where } from 'payload'
import { describe, it, expect, vi } from 'vitest'

// Lưu ý: `lib/progress-reports/publish.ts` mở đầu bằng `import 'server-only'`;
// vitest.config alias `server-only` → module rỗng để test được core thuần.

import type { ProgressReport, User } from '@/payload-types'
import {
  publishProgressReports,
  MAX_PUBLISH_BATCH,
  DRAFT_PROGRESS_REPORTS_WHERE,
} from '@/lib/progress-reports/publish'
import { ProgressReports } from '@/collections/ProgressReports'

// ─── Actors ─────────────────────────────────────────────────────────────────
const staff = { id: 1, collection: 'users', role: 'admin' } as unknown as User
const parentA = { id: 101, collection: 'parents', children: [1001] } as const
const anon = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asReq = (user: any) => ({ req: { user } }) as any

// ─── Fake Payload có store trong bộ nhớ (chỉ dùng findByID + update) ──────────
function makeFakePayload(initial: ProgressReport[]) {
  const store = new Map<number, ProgressReport>()
  for (const r of initial) store.set(r.id, { ...r })

  const findByID = vi.fn(async ({ id }: { id: number }) => {
    const doc = store.get(id)
    if (!doc) throw new Error('NotFound')
    return { ...doc }
  })
  const update = vi.fn(async ({ id, data }: { id: number; data: Partial<ProgressReport> }) => {
    const doc = store.get(id)
    if (!doc) throw new Error('NotFound')
    const next = { ...doc, ...data }
    store.set(id, next)
    return next
  })

  return { store, findByID, update } as unknown as Payload & {
    store: Map<number, ProgressReport>
    findByID: typeof findByID
    update: typeof update
  }
}

function draft(id: number, student: number): ProgressReport {
  return {
    id,
    student,
    period: '6 tháng cuối 2025',
    publishedAt: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
  } as ProgressReport
}

// ─── Đánh giá Where của access.read trên một document (đủ shape ta dùng) ──────
function relId(v: unknown): number | null {
  if (typeof v === 'number') return v
  if (v && typeof v === 'object' && 'id' in v) {
    const id = (v as { id: unknown }).id
    return typeof id === 'number' ? id : null
  }
  return null
}
function matchesWhere(where: Where, doc: ProgressReport): boolean {
  if (Array.isArray((where as { and?: Where[] }).and)) {
    return (where as { and: Where[] }).and.every((w) => matchesWhere(w, doc))
  }
  const studentIn = (where as { student?: { in?: number[] } }).student?.in
  if (Array.isArray(studentIn)) {
    const sid = relId(doc.student)
    if (sid === null || !studentIn.includes(sid)) return false
  }
  const notEq = (where as { publishedAt?: { not_equals?: unknown } }).publishedAt
  if (notEq && 'not_equals' in notEq) {
    if (doc.publishedAt === (notEq.not_equals as unknown)) return false
  }
  return true
}
/** Mô phỏng "phụ huynh đọc": áp Where mà access.read trả về lên store. */
function parentVisibleReports(
  read: Access,
  parent: typeof parentA,
  store: Map<number, ProgressReport>,
): ProgressReport[] {
  const where = read(asReq(parent)) as Where // parent ⇒ luôn là Where
  return [...store.values()].filter((doc) => matchesWhere(where, doc))
}

// ──────────────────────────────────────────────────────────────────────────────
describe('DRAFT_PROGRESS_REPORTS_WHERE', () => {
  it('lọc đúng báo cáo nháp (publishedAt = null)', () => {
    expect(DRAFT_PROGRESS_REPORTS_WHERE).toEqual({ publishedAt: { equals: null } })
  })
})

describe('publishProgressReports — guard chống phát hành nhầm', () => {
  it('không xác nhận ⇒ lỗi not_confirmed, KHÔNG đụng DB', async () => {
    const payload = makeFakePayload([draft(1, 1001)])
    const res = await publishProgressReports(payload, staff, { ids: [1], confirm: false })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('not_confirmed')
    expect(payload.update).not.toHaveBeenCalled()
    expect(payload.findByID).not.toHaveBeenCalled()
  })

  it('danh sách rỗng / id không hợp lệ ⇒ lỗi no_ids', async () => {
    const payload = makeFakePayload([])
    expect((await publishProgressReports(payload, staff, { ids: [], confirm: true })).ok).toBe(
      false,
    )
    const res = await publishProgressReports(payload, staff, { ids: [0, -3, NaN], confirm: true })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('no_ids')
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('vượt trần lô ⇒ lỗi too_many, KHÔNG đụng DB', async () => {
    const payload = makeFakePayload([])
    const ids = Array.from({ length: MAX_PUBLISH_BATCH + 1 }, (_, i) => i + 1)
    const res = await publishProgressReports(payload, staff, { ids, confirm: true })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('too_many')
    expect(payload.update).not.toHaveBeenCalled()
  })
})

describe('publishProgressReports — phát hành', () => {
  it('chỉ stamp NHÁP; ghi qua Local API với overrideAccess:false + user', async () => {
    const payload = makeFakePayload([draft(10, 1001), draft(11, 1001)])
    const res = await publishProgressReports(payload, staff, { ids: [10, 11], confirm: true })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.published).toBe(2)
    expect(res.publishedIds.sort()).toEqual([10, 11])
    // publishedAt được set cho cả hai và bằng giá trị trả về (1 mốc/lô)
    expect(payload.store.get(10)?.publishedAt).toBe(res.publishedAt)
    expect(payload.store.get(11)?.publishedAt).toBe(res.publishedAt)
    // defense-in-depth: update KHÔNG override access và truyền đúng actor
    const call = payload.update.mock.calls[0][0] as {
      overrideAccess: boolean
      user: User
      collection: string
    }
    expect(call.collection).toBe('progress-reports')
    expect(call.overrideAccess).toBe(false)
    expect(call.user).toBe(staff)
  })

  it('idempotent: báo cáo đã phát hành ⇒ alreadyPublished, KHÔNG stamp lại', async () => {
    const published = { ...draft(20, 1001), publishedAt: '2025-12-31T00:00:00.000Z' }
    const payload = makeFakePayload([published, draft(21, 1001)])

    const res = await publishProgressReports(payload, staff, { ids: [20, 21], confirm: true })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.publishedIds).toEqual([21])
    expect(res.alreadyPublishedIds).toEqual([20])
    // giữ nguyên ngày phát hành cũ của #20 (không churn)
    expect(payload.store.get(20)?.publishedAt).toBe('2025-12-31T00:00:00.000Z')
    // chạy lại trên tập đã phát hành ⇒ không phát hành gì thêm
    const again = await publishProgressReports(payload, staff, { ids: [20, 21], confirm: true })
    expect(again.ok && again.published).toBe(0)
  })

  it('id không tồn tại ⇒ notFound, không làm hỏng cả lô; khử trùng id', async () => {
    const payload = makeFakePayload([draft(30, 1001)])
    const res = await publishProgressReports(payload, staff, {
      ids: [30, 30, 999], // 30 lặp lại + 999 không tồn tại
      confirm: true,
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.requested).toBe(2) // đã khử trùng
    expect(res.publishedIds).toEqual([30])
    expect(res.notFoundIds).toEqual([999])
  })
})

// ── Acceptance: parent đọc → không thấy nháp; sau publish → thấy ──────────────
describe('Acceptance — guard ẩn nháp với phụ huynh', () => {
  const read = ProgressReports.access?.read as Access

  it('staff đọc tất; phụ huynh nhận Where lọc; anon bị từ chối', () => {
    expect(read(asReq(staff))).toBe(true)
    expect(read(asReq(anon))).toBe(false)
    expect(typeof read(asReq(parentA))).toBe('object') // Where
  })

  it('TRƯỚC publish: báo cáo nháp KHÔNG hiện cho phụ huynh; SAU publish: HIỆN', async () => {
    const payload = makeFakePayload([draft(40, 1001)])

    // Trước: draft (publishedAt=null) bị Where của phụ huynh loại
    const before = parentVisibleReports(read, parentA, payload.store)
    expect(before.map((r) => r.id)).not.toContain(40)
    expect(before).toHaveLength(0)

    // Phát hành
    const res = await publishProgressReports(payload, staff, { ids: [40], confirm: true })
    expect(res.ok).toBe(true)

    // Sau: cùng Where đó giờ cho phép báo cáo #40 (publishedAt != null)
    const after = parentVisibleReports(read, parentA, payload.store)
    expect(after.map((r) => r.id)).toContain(40)
  })

  it('phụ huynh KHÁC vẫn không thấy báo cáo đã phát hành của con người khác', async () => {
    const payload = makeFakePayload([
      { ...draft(50, 1001), publishedAt: '2026-01-02T00:00:00.000Z' },
    ])
    const parentB = { id: 102, collection: 'parents', children: [1002] } as const
    const visible = parentVisibleReports(read, parentB, payload.store)
    expect(visible).toHaveLength(0) // student 1001 ∉ children của B
  })
})
