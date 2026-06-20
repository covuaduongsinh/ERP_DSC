import type { Payload } from 'payload'
import { describe, it, expect } from 'vitest'

import type { User } from '@/payload-types'
import {
  saveSessionEntry,
  setSessionCancelled,
  createMakeupSession,
} from '@/lib/operations/session-entry'

const admin = { id: 1, collection: 'users', role: 'admin' } as unknown as User

// ─── Fake payload có trạng thái: class-sessions (ensureSession) + attendance ──────
function makePayload(classDoc: Record<string, unknown> = { id: 5, location: 2, lichHoc: [] }) {
  const sessions: Array<Record<string, unknown>> = []
  const attendance: Array<Record<string, unknown>> = []
  let sid = 1
  let aid = 1

  const find = async ({ collection, where }: { collection: string; where?: any }) => {
    if (collection === 'class-sessions') {
      const k = where?.khoaBuoi?.equals
      const docs = k != null ? sessions.filter((s) => s.khoaBuoi === k) : sessions.slice()
      return { docs, totalDocs: docs.length }
    }
    if (collection === 'attendance') {
      const and = where?.and ?? []
      const studentEq = and.find((c: any) => c?.student?.equals)?.student?.equals
      const docs = attendance.filter((a) => a.student === studentEq)
      return { docs, totalDocs: docs.length }
    }
    return { docs: [], totalDocs: 0 }
  }
  const findByID = async () => classDoc
  const create = async ({
    collection,
    data,
  }: {
    collection: string
    data: Record<string, unknown>
  }) => {
    if (collection === 'class-sessions') {
      const doc = { id: sid++, ...data }
      sessions.push(doc)
      return doc
    }
    const doc = { id: aid++, ...data }
    attendance.push(doc)
    return doc
  }
  const update = async ({
    collection,
    id,
    data,
  }: {
    collection: string
    id: number
    data: Record<string, unknown>
  }) => {
    const store = collection === 'class-sessions' ? sessions : attendance
    const doc = store.find((d) => d.id === id)
    if (doc) Object.assign(doc, data)
    return doc ?? { id }
  }

  return {
    payload: { find, findByID, create, update } as unknown as Payload,
    sessions,
    attendance,
  }
}

describe('saveSessionEntry — nội dung buổi + upsert điểm danh 🔒', () => {
  it('non-staff ⇒ forbidden; classId sai ⇒ invalid_input', async () => {
    const { payload } = makePayload()
    expect(
      (
        await saveSessionEntry(payload, null, {
          classId: 5,
          date: '2026-06-04',
          session: {},
          entries: [],
        })
      ).ok,
    ).toBe(false)
    expect(
      (
        await saveSessionEntry(payload, admin, {
          classId: 0,
          date: '2026-06-04',
          session: {},
          entries: [],
        })
      ).ok,
    ).toBe(false)
  })

  it('lưu mới ⇒ tạo buổi (da_day) + attendance gắn session', async () => {
    const { payload, sessions, attendance } = makePayload()
    const res = await saveSessionEntry(payload, admin, {
      classId: 5,
      date: '2026-06-04',
      session: { kienThucMoi: 'Chiếu hết', coachThucTe: 10 },
      entries: [{ studentId: 1001, status: 'co_mat', yThuc: 8, lamBTVN: 1, nhanXet: 'Tốt' }],
    })
    expect(res).toMatchObject({ ok: true, created: 1, updated: 0 })
    expect(sessions).toHaveLength(1)
    expect(sessions[0]).toMatchObject({
      trangThai: 'da_day',
      kienThucMoi: 'Chiếu hết',
      coachThucTe: 10,
    })
    expect(attendance).toHaveLength(1)
    expect(attendance[0]).toMatchObject({
      student: 1001,
      status: 'co_mat',
      lop: 5,
      yThuc: 8,
      session: sessions[0].id,
    })
  })

  it('lưu lại cùng ngày ⇒ cập nhật, KHÔNG tạo trùng (idempotent)', async () => {
    const { payload, attendance } = makePayload()
    const base = {
      classId: 5,
      date: '2026-06-04',
      session: {},
      entries: [{ studentId: 1001, status: 'co_mat' as const }],
    }
    await saveSessionEntry(payload, admin, base)
    const res2 = await saveSessionEntry(payload, admin, {
      ...base,
      entries: [{ studentId: 1001, status: 'vang' as const }],
    })
    expect(res2).toMatchObject({ ok: true, created: 0, updated: 1 })
    expect(attendance).toHaveLength(1)
    expect(attendance[0].status).toBe('vang')
  })
})

describe('setSessionCancelled + createMakeupSession 🔒', () => {
  it('hủy buổi ⇒ trangThai huy + ghiChuBuoi', async () => {
    const { payload, sessions } = makePayload()
    const res = await setSessionCancelled(payload, admin, {
      classId: 5,
      date: '2026-06-04',
      huy: true,
      reason: 'Nghỉ lễ',
    })
    expect(res.ok).toBe(true)
    expect(sessions[0]).toMatchObject({ trangThai: 'huy', ghiChuBuoi: 'Nghỉ lễ' })
  })

  it('mở lại buổi ⇒ trangThai da_day', async () => {
    const { payload, sessions } = makePayload()
    await setSessionCancelled(payload, admin, {
      classId: 5,
      date: '2026-06-04',
      huy: true,
      reason: 'x',
    })
    await setSessionCancelled(payload, admin, { classId: 5, date: '2026-06-04', huy: false })
    expect(sessions[0]).toMatchObject({ trangThai: 'da_day', ghiChuBuoi: null })
  })

  it('tạo buổi bù ⇒ trangThai bu + buoiGoc', async () => {
    const { payload, sessions } = makePayload()
    const res = await createMakeupSession(payload, admin, {
      classId: 5,
      originalSessionId: 99,
      date: '2026-06-11',
    })
    expect(res.ok).toBe(true)
    expect(sessions[0]).toMatchObject({ trangThai: 'bu', buoiGoc: 99 })
  })

  it('non-staff ⇒ forbidden', async () => {
    const { payload } = makePayload()
    expect(
      (await setSessionCancelled(payload, null, { classId: 5, date: '2026-06-04', huy: true })).ok,
    ).toBe(false)
    expect(
      (
        await createMakeupSession(payload, null, {
          classId: 5,
          originalSessionId: 1,
          date: '2026-06-11',
        })
      ).ok,
    ).toBe(false)
  })
})
