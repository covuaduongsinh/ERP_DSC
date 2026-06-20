import type { Access, Payload } from 'payload'
import { describe, it, expect, vi } from 'vitest'

import type { User } from '@/payload-types'
import { ClassSessions } from '@/collections/ClassSessions'
import {
  ensureSession,
  expandSlotsForRange,
  formatUtcDate,
  sessionKey,
  weekdayToThu,
} from '@/lib/operations/sessions'

// ─── Actors ───────────────────────────────────────────────────────────────────
const KIM_LIEN = 1
const VINH_PHUC = 2
const admin = { id: 1, collection: 'users', role: 'admin' } as unknown as User
const coachKL = {
  id: 10,
  collection: 'users',
  role: 'coach',
  location: KIM_LIEN,
} as unknown as User
const receptionistVP = {
  id: 11,
  collection: 'users',
  role: 'receptionist',
  location: VINH_PHUC,
} as unknown as User
const coachNoBranch = { id: 12, collection: 'users', role: 'coach' } as unknown as User
const parentA = { id: 101, collection: 'parents', children: [1001] } as const
const anon = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asReq = (user: any) => ({ req: { user } }) as any

// ════════════════════════════════════════════════════════════════════════════════
describe('sessions — hàm thuần (date/key/expand)', () => {
  it('formatUtcDate: theo UTC, bỏ giờ', () => {
    expect(formatUtcDate('2026-06-04')).toBe('2026-06-04')
    expect(formatUtcDate('2026-06-04T15:30:00Z')).toBe('2026-06-04')
    expect(formatUtcDate(new Date(Date.UTC(2026, 11, 9, 23, 59)))).toBe('2026-12-09')
  })

  it('sessionKey: lop|YYYY-MM-DD', () => {
    expect(sessionKey(5001, '2026-06-04')).toBe('5001|2026-06-04')
    expect(sessionKey(7, new Date(Date.UTC(2026, 0, 2)))).toBe('7|2026-01-02')
  })

  it('weekdayToThu: map getUTCDay → t2..cn (mốc đã biết)', () => {
    expect(weekdayToThu(new Date(Date.UTC(2024, 0, 1)))).toBe('t2') // 01/01/2024 = Thứ 2
    expect(weekdayToThu(new Date(Date.UTC(2024, 0, 7)))).toBe('cn') // 07/01/2024 = Chủ nhật
    // 7 ngày liên tiếp ⇒ phủ đủ 7 thứ khác nhau
    const week = Array.from({ length: 7 }, (_, i) =>
      weekdayToThu(new Date(Date.UTC(2026, 5, 1 + i))),
    )
    expect(new Set(week).size).toBe(7)
  })

  it('expandSlotsForRange: mỗi slot khớp thứ → 1 buổi/tuần; rỗng/đảo khoảng → []', () => {
    const lichHoc = [
      { thu: 't2', gioBatDau: '17:00', gioKetThuc: '18:30', phong: 'A1' },
      { thu: 't4', gioBatDau: '17:00', gioKetThuc: '18:30' },
    ]
    // 7 ngày liên tiếp phủ mỗi thứ đúng 1 lần ⇒ đúng 2 buổi
    const out = expandSlotsForRange(lichHoc, '2026-06-01', '2026-06-07')
    expect(out).toHaveLength(2)
    expect(out.every((s) => s.thu === 't2' || s.thu === 't4')).toBe(true)
    expect(out.find((s) => s.thu === 't2')?.phong).toBe('A1')
    expect(out.find((s) => s.thu === 't4')?.phong).toBe(null)

    expect(expandSlotsForRange([], '2026-06-01', '2026-06-07')).toEqual([])
    expect(expandSlotsForRange(lichHoc, '2026-06-07', '2026-06-01')).toEqual([]) // from > to
  })
})

// ════════════════════════════════════════════════════════════════════════════════
// Fake payload có TRẠNG THÁI: lưu class-sessions vào mảng; create chặn trùng
// khoaBuoi (mô phỏng unique index). Đủ để kiểm idempotency của ensureSession.
function makeStatefulPayload(classDoc?: { id: number; lichHoc?: unknown[]; location?: number }) {
  const store: Array<Record<string, unknown>> = []
  let nextId = 1
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    if (data.khoaBuoi && store.some((s) => s.khoaBuoi === data.khoaBuoi)) {
      throw new Error(
        'duplicate key value violates unique constraint "class_sessions_khoa_buoi_idx"',
      )
    }
    const doc = { id: nextId++, ...data }
    store.push(doc)
    return doc
  })
  const find = vi.fn(async ({ where }: { where?: { khoaBuoi?: { equals?: string } } }) => {
    const k = where?.khoaBuoi?.equals
    const docs = k != null ? store.filter((s) => s.khoaBuoi === k) : store.slice()
    return { docs, totalDocs: docs.length }
  })
  const findByID = vi.fn(async () => classDoc ?? null)
  return {
    payload: { find, create, findByID } as unknown as Payload,
    create,
    find,
    findByID,
    store,
  }
}

describe('ensureSession — idempotent qua khoaBuoi 🔒', () => {
  it('chưa có buổi ⇒ tạo, copy slot + cơ sở từ lớp + set khoaBuoi/thu', async () => {
    const date = '2026-06-04'
    const thu = weekdayToThu(date)
    const cls = {
      id: 5001,
      location: 7,
      lichHoc: [{ thu, gioBatDau: '17:00', gioKetThuc: '18:30', phong: 'A1' }],
    }
    const { payload, create } = makeStatefulPayload(cls)

    const s = (await ensureSession(payload, admin, { lopId: 5001, date })) as unknown as Record<
      string,
      unknown
    >
    expect(create).toHaveBeenCalledOnce()
    expect(s.khoaBuoi).toBe('5001|2026-06-04')
    expect(s.thu).toBe(thu)
    expect(s.gioBatDau).toBe('17:00')
    expect(s.gioKetThuc).toBe('18:30')
    expect(s.phong).toBe('A1')
    expect(s.location).toBe(7)
    expect(s.trangThai).toBe('du_kien')
  })

  it('gọi 2 lần cùng (lop, ngày) ⇒ CHỈ 1 bản ghi (idempotent)', async () => {
    const date = '2026-06-04'
    const { payload, create, store } = makeStatefulPayload({ id: 5001, lichHoc: [] })
    const a = (await ensureSession(payload, admin, { lopId: 5001, date })) as unknown as {
      id: number
    }
    const b = (await ensureSession(payload, admin, { lopId: 5001, date })) as unknown as {
      id: number
    }
    expect(create).toHaveBeenCalledOnce() // lần 2 tìm thấy, không tạo
    expect(store).toHaveLength(1)
    expect(a.id).toBe(b.id)
  })

  it('giờ khác nhau trong ngày coi là CÙNG buổi (khóa theo lop|ngày, bỏ giờ)', async () => {
    const { payload, store } = makeStatefulPayload({ id: 5001, lichHoc: [] })
    await ensureSession(payload, admin, { lopId: 5001, date: '2026-06-04T08:00:00Z' })
    await ensureSession(payload, admin, { lopId: 5001, date: '2026-06-04T19:00:00Z' })
    expect(store).toHaveLength(1)
  })
})

// ════════════════════════════════════════════════════════════════════════════════
describe('ClassSessions.access — branch-scope qua location 🔒 (KHÔNG public)', () => {
  const read = ClassSessions.access?.read as Access
  const update = ClassSessions.access?.update as Access
  const del = ClassSessions.access?.delete as Access
  const create = ClassSessions.access?.create as Access
  const SCOPE = (...b: number[]) => ({ location: { in: b } })

  it('read: coach KL → scoped location; admin → true; coachNoBranch/parent/anon → false', () => {
    expect(read(asReq(coachKL))).toEqual(SCOPE(KIM_LIEN))
    expect(read(asReq(receptionistVP))).toEqual(SCOPE(VINH_PHUC))
    expect(read(asReq(admin))).toBe(true)
    expect(read(asReq(coachNoBranch))).toBe(false)
    expect(read(asReq(parentA))).toBe(false) // staff-only: phụ huynh KHÔNG đọc buổi học
    expect(read(asReq(anon))).toBe(false)
  })

  it('update/delete: coach KL → scoped; admin → true; non-staff → false', () => {
    expect(update(asReq(coachKL))).toEqual(SCOPE(KIM_LIEN))
    expect(del(asReq(coachKL))).toEqual(SCOPE(KIM_LIEN))
    expect(update(asReq(admin))).toBe(true)
    expect(del(asReq(admin))).toBe(true)
    expect(update(asReq(parentA))).toBe(false)
    expect(del(asReq(anon))).toBe(false)
  })

  it('create: staffOnly (KHÔNG scope) — staff → true; phụ huynh/anon → false', () => {
    expect(create(asReq(coachKL))).toBe(true)
    expect(create(asReq(admin))).toBe(true)
    expect(create(asReq(parentA))).toBe(false)
    expect(create(asReq(anon))).toBe(false)
  })
})
