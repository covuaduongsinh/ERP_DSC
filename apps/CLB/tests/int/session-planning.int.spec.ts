import type { Payload } from 'payload'
import { describe, it, expect, vi } from 'vitest'

import type { User } from '@/payload-types'
import { sessionKey } from '@/lib/operations/sessions'
import {
  previewPlan,
  generatePlan,
  loadPlannedSessions,
  cancelPlannedSession,
  createPlannedMakeup,
} from '@/lib/operations/session-planning'

// ─── Actors ───────────────────────────────────────────────────────────────────
const KIM_LIEN = 1
const manager = { id: 2, collection: 'users', role: 'manager' } as unknown as User
const admin = { id: 1, collection: 'users', role: 'admin' } as unknown as User
const coachKL = {
  id: 10,
  collection: 'users',
  role: 'coach',
  location: KIM_LIEN,
} as unknown as User
const parentA = { id: 101, collection: 'parents', children: [1001] } as unknown as User
const anon = null

const LOP = 5001
// Lớp 2 buổi/tuần: T2 + T4 (như existing class-sessions.int.spec).
const CLASS_DOC = {
  id: LOP,
  title: 'Tốt A1',
  location: KIM_LIEN,
  lichHoc: [
    { thu: 't2', gioBatDau: '17:00', gioKetThuc: '18:30', phong: 'A1' },
    { thu: 't4', gioBatDau: '17:00', gioKetThuc: '18:30' },
  ],
}
// 2 tuần 01–14/06/2026 ⇒ T2: 01, 08; T4: 03, 10 ⇒ 4 buổi.
const FROM = '2026-06-01'
const TO = '2026-06-14'
const EXPECTED_KEYS = ['2026-06-01', '2026-06-03', '2026-06-08', '2026-06-10'].map((d) =>
  sessionKey(LOP, d),
)

/**
 * Fake payload CÓ TRẠNG THÁI cho class-sessions (khoaBuoi unique) + import-logs.
 * Đếm thao tác attendance để chứng minh kế hoạch KHÔNG đụng nguồn tính tiền.
 */
function makeFakePayload(
  classDoc: Record<string, unknown> = CLASS_DOC,
  holidayDocs: Array<Record<string, unknown>> = [],
) {
  const sessions: Array<Record<string, unknown>> = []
  const logs: Array<Record<string, unknown>> = []
  let nextId = 1
  const attendanceOps = { create: 0, update: 0, delete: 0 }

  const create = vi.fn(
    async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
      if (collection === 'attendance') {
        attendanceOps.create += 1
        return { id: nextId++, ...data }
      }
      if (collection === 'import-logs') {
        const doc = { id: nextId++, ...data }
        logs.push(doc)
        return doc
      }
      // class-sessions: mô phỏng unique khoaBuoi.
      if (data.khoaBuoi && sessions.some((s) => s.khoaBuoi === data.khoaBuoi)) {
        throw new Error(
          'duplicate key value violates unique constraint "class_sessions_khoa_buoi_idx"',
        )
      }
      const doc = { id: nextId++, ...data }
      sessions.push(doc)
      return doc
    },
  )

  const find = vi.fn(
    async ({ collection, where }: { collection: string; where?: Record<string, unknown> }) => {
      if (collection === 'holidays') {
        // where chỉ còn { kichHoat: { equals: true } } — lọc cơ sở nay ở bộ nhớ
        // (loadHolidayRanges) vì `location` là quan hệ hasMany. `location` = mảng id.
        const docs = holidayDocs.filter((h) => h.kichHoat !== false)
        return { docs, totalDocs: docs.length }
      }
      if (collection !== 'class-sessions') return { docs: [], totalDocs: 0 }
      const w = (where ?? {}) as {
        khoaBuoi?: { equals?: string; in?: string[] }
        and?: Array<Record<string, unknown>>
      }
      let docs = sessions.slice()
      if (w.khoaBuoi?.equals != null) {
        docs = docs.filter((s) => s.khoaBuoi === w.khoaBuoi!.equals)
      } else if (Array.isArray(w.khoaBuoi?.in)) {
        const set = new Set(w.khoaBuoi.in)
        docs = docs.filter((s) => set.has(s.khoaBuoi as string))
      } else if (Array.isArray(w.and)) {
        for (const cond of w.and) {
          const c = cond as Record<
            string,
            { equals?: unknown; greater_than_equal?: string; less_than_equal?: string }
          >
          if (c.lop?.equals != null) docs = docs.filter((s) => s.lop === c.lop!.equals)
          if (c.date?.greater_than_equal)
            docs = docs.filter(
              (s) =>
                new Date(s.date as string).getTime() >=
                new Date(c.date!.greater_than_equal!).getTime(),
            )
          if (c.date?.less_than_equal)
            docs = docs.filter(
              (s) =>
                new Date(s.date as string).getTime() <=
                new Date(c.date!.less_than_equal!).getTime(),
            )
        }
        docs = docs.sort(
          (a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime(),
        )
      }
      return { docs, totalDocs: docs.length }
    },
  )

  const findByID = vi.fn(async ({ collection }: { collection: string }) =>
    collection === 'classes' ? classDoc : null,
  )

  const update = vi.fn(
    async ({
      collection,
      id,
      data,
    }: {
      collection: string
      id: number
      data: Record<string, unknown>
    }) => {
      if (collection === 'attendance') {
        attendanceOps.update += 1
        return { id, ...data }
      }
      const idx = sessions.findIndex((s) => s.id === id)
      if (idx >= 0) sessions[idx] = { ...sessions[idx], ...data }
      return sessions[idx]
    },
  )

  const del = vi.fn(async ({ collection }: { collection: string }) => {
    if (collection === 'attendance') attendanceOps.delete += 1
    return { docs: [] }
  })

  return {
    payload: { find, create, findByID, update, delete: del } as unknown as Payload,
    sessions,
    logs,
    attendanceOps,
    create,
  }
}

// ════════════════════════════════════════════════════════════════════════════════
describe('previewPlan — phân loại sẽ-tạo / đã-có', () => {
  it('lớp chưa có buổi ⇒ tất cả "create"', async () => {
    const { payload } = makeFakePayload()
    const res = await previewPlan(payload, manager, { lopId: LOP, from: FROM, to: TO })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.outcomes).toHaveLength(4)
    expect(res.toCreate).toBe(4)
    expect(res.existing).toBe(0)
    expect(res.outcomes.every((o) => o.status === 'create')).toBe(true)
    expect(res.classTitle).toBe('Tốt A1')
  })

  it('khoảng không hợp lệ (từ > đến) ⇒ invalid_input', async () => {
    const { payload } = makeFakePayload()
    const res = await previewPlan(payload, manager, { lopId: LOP, from: TO, to: FROM })
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('invalid_input')
  })

  it('lớp chưa có lịch tuần ⇒ rỗng + ghi chú', async () => {
    const { payload } = makeFakePayload({ id: LOP, title: 'Lớp trống', lichHoc: [] })
    const res = await previewPlan(payload, manager, { lopId: LOP, from: FROM, to: TO })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.outcomes).toHaveLength(0)
    expect(res.note).toBeTruthy()
  })

  it('non-staff (phụ huynh / anon) ⇒ forbidden', async () => {
    const { payload } = makeFakePayload()
    expect((await previewPlan(payload, parentA, { lopId: LOP, from: FROM, to: TO })).ok).toBe(false)
    expect((await previewPlan(payload, anon, { lopId: LOP, from: FROM, to: TO })).ok).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════════
describe('generatePlan — sinh idempotent + nhật ký + ranh giới tiền 🔒', () => {
  it('sinh 4 buổi du_kien đúng khoaBuoi/snapshot, ghi 1 ImportLog; KHÔNG đụng attendance', async () => {
    const { payload, sessions, logs, attendanceOps } = makeFakePayload()
    const res = await generatePlan(payload, manager, { lopId: LOP, from: FROM, to: TO })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.created).toBe(4)
    expect(res.existing).toBe(0)

    expect(sessions).toHaveLength(4)
    expect(sessions.every((s) => s.trangThai === 'du_kien')).toBe(true)
    expect(new Set(sessions.map((s) => s.khoaBuoi))).toEqual(new Set(EXPECTED_KEYS))
    // snapshot từ slot (T2 có phòng A1).
    const t2 = sessions.find((s) => s.khoaBuoi === sessionKey(LOP, '2026-06-01'))
    expect(t2?.gioBatDau).toBe('17:00')
    expect(t2?.phong).toBe('A1')

    // Nhật ký tổng kết.
    expect(logs).toHaveLength(1)
    expect(logs[0].kind).toBe('session-planning')
    expect(logs[0].rowsCreated).toBe(4)

    // Ranh giới đếm buổi: KHÔNG tạo/sửa/xóa attendance.
    expect(attendanceOps).toEqual({ create: 0, update: 0, delete: 0 })
  })

  it('gọi lần 2 cùng khoảng ⇒ created=0, existing=4 (idempotent)', async () => {
    const { payload, sessions } = makeFakePayload()
    await generatePlan(payload, manager, { lopId: LOP, from: FROM, to: TO })
    const res = await generatePlan(payload, admin, { lopId: LOP, from: FROM, to: TO })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.created).toBe(0)
    expect(res.existing).toBe(4)
    expect(sessions).toHaveLength(4) // không tạo trùng
  })

  it('coach (không phải planner) ⇒ forbidden, KHÔNG sinh gì', async () => {
    const { payload, sessions } = makeFakePayload()
    const res = await generatePlan(payload, coachKL, { lopId: LOP, from: FROM, to: TO })
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('forbidden')
    expect(sessions).toHaveLength(0)
  })
})

// ════════════════════════════════════════════════════════════════════════════════
describe('Lịch nghỉ lễ — bỏ qua khi sinh + cảnh báo preview 🔒', () => {
  // T4 03/06/2026 là ngày nghỉ toàn công ty (location rỗng = mọi cơ sở).
  const tetGlobal = {
    tenNgayNghi: 'Nghỉ thử',
    tuNgay: '2026-06-03',
    denNgay: '2026-06-03',
    location: [] as number[], // rỗng = toàn công ty
    kichHoat: true,
  }

  it('previewPlan: ngày nghỉ ⇒ status "holiday" + skipped=1, toCreate=3', async () => {
    const { payload } = makeFakePayload(CLASS_DOC, [tetGlobal])
    const res = await previewPlan(payload, manager, { lopId: LOP, from: FROM, to: TO })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.outcomes).toHaveLength(4)
    expect(res.toCreate).toBe(3)
    expect(res.skipped).toBe(1)
    const h = res.outcomes.find((o) => o.date === '2026-06-03')
    expect(h?.status).toBe('holiday')
    expect(h?.holidayName).toBe('Nghỉ thử')
  })

  it('generatePlan: KHÔNG sinh buổi vào ngày nghỉ ⇒ created=3, skipped=1', async () => {
    const { payload, sessions, attendanceOps } = makeFakePayload(CLASS_DOC, [tetGlobal])
    const res = await generatePlan(payload, manager, { lopId: LOP, from: FROM, to: TO })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.created).toBe(3)
    expect(res.skipped).toBe(1)
    expect(sessions).toHaveLength(3)
    expect(sessions.some((s) => s.khoaBuoi === sessionKey(LOP, '2026-06-03'))).toBe(false)
    // Ranh giới đếm buổi giữ nguyên.
    expect(attendanceOps).toEqual({ create: 0, update: 0, delete: 0 })
  })

  it('ngày nghỉ của cơ sở KHÁC ⇒ không ảnh hưởng lớp này', async () => {
    const otherBranch = { ...tetGlobal, location: [999] }
    const { payload, sessions } = makeFakePayload(CLASS_DOC, [otherBranch])
    const res = await generatePlan(payload, manager, { lopId: LOP, from: FROM, to: TO })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.created).toBe(4)
    expect(res.skipped).toBe(0)
    expect(sessions).toHaveLength(4)
  })

  it('ngày nghỉ áp NHIỀU cơ sở (gồm cơ sở của lớp) ⇒ bỏ buổi', async () => {
    // Lớp ở Kim Liên; ngày nghỉ áp [Kim Liên, 999] ⇒ áp cho lớp này.
    const multi = { ...tetGlobal, location: [KIM_LIEN, 999] }
    const { payload, sessions } = makeFakePayload(CLASS_DOC, [multi])
    const res = await generatePlan(payload, manager, { lopId: LOP, from: FROM, to: TO })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.created).toBe(3)
    expect(res.skipped).toBe(1)
    expect(sessions).toHaveLength(3)
    expect(sessions.some((s) => s.khoaBuoi === sessionKey(LOP, '2026-06-03'))).toBe(false)
  })

  it('ngày nghỉ TẮT (kichHoat=false) ⇒ vẫn sinh bình thường', async () => {
    const off = { ...tetGlobal, kichHoat: false }
    const { payload } = makeFakePayload(CLASS_DOC, [off])
    const res = await generatePlan(payload, manager, { lopId: LOP, from: FROM, to: TO })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.created).toBe(4)
    expect(res.skipped).toBe(0)
  })

  it('buổi du_kien đã LỠ sinh trùng nghỉ ⇒ preview giữ trangThai="du_kien" để rà soát', async () => {
    const holidays: Array<Record<string, unknown>> = []
    const { payload } = makeFakePayload(CLASS_DOC, holidays)
    // Sinh trước khi có lịch nghỉ ⇒ tạo cả buổi 03/06.
    await generatePlan(payload, manager, { lopId: LOP, from: FROM, to: TO })
    // Thêm ngày nghỉ trùng 03/06 (closure thấy mutation).
    holidays.push(tetGlobal)
    const res = await previewPlan(payload, manager, { lopId: LOP, from: FROM, to: TO })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    const conflict = res.outcomes.find((o) => o.date === '2026-06-03')
    expect(conflict?.status).toBe('holiday')
    expect(conflict?.trangThai).toBe('du_kien')
  })
})

// ════════════════════════════════════════════════════════════════════════════════
describe('loadPlannedSessions — nạp buổi để sửa/hủy/bù', () => {
  it('trả về các buổi của lớp trong khoảng, sort theo ngày', async () => {
    const { payload } = makeFakePayload()
    await generatePlan(payload, manager, { lopId: LOP, from: FROM, to: TO })
    const res = await loadPlannedSessions(payload, manager, { lopId: LOP, from: FROM, to: TO })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.rows).toHaveLength(4)
    expect(res.rows.map((r) => r.date)).toEqual([
      '2026-06-01',
      '2026-06-03',
      '2026-06-08',
      '2026-06-10',
    ])
    expect(res.rows.every((r) => r.trangThai === 'du_kien')).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════════
describe('cancelPlannedSession / createPlannedMakeup — planner-gate 🔒', () => {
  it('hủy buổi: planner ⇒ trangThai=huy + lý do; coach ⇒ forbidden', async () => {
    const { payload, sessions } = makeFakePayload()
    await generatePlan(payload, manager, { lopId: LOP, from: FROM, to: TO })

    const denied = await cancelPlannedSession(payload, coachKL, {
      classId: LOP,
      date: '2026-06-01',
      reason: 'x',
    })
    expect(denied.ok).toBe(false)

    const res = await cancelPlannedSession(payload, manager, {
      classId: LOP,
      date: '2026-06-01',
      reason: 'Nghỉ lễ',
    })
    expect(res.ok).toBe(true)
    const cancelled = sessions.find((s) => s.khoaBuoi === sessionKey(LOP, '2026-06-01'))
    expect(cancelled?.trangThai).toBe('huy')
    expect(cancelled?.ghiChuBuoi).toBe('Nghỉ lễ')
  })

  it('tạo bù: ngày trống ⇒ buổi "bu" trỏ buoiGoc; ngày đã có buổi ⇒ invalid_input', async () => {
    const { payload, sessions } = makeFakePayload()
    await generatePlan(payload, manager, { lopId: LOP, from: FROM, to: TO })
    const original = sessions.find((s) => s.khoaBuoi === sessionKey(LOP, '2026-06-01'))!

    // Ngày bù trống (15/06) ⇒ tạo buổi bù.
    const ok = await createPlannedMakeup(payload, manager, {
      classId: LOP,
      originalSessionId: original.id as number,
      date: '2026-06-15',
    })
    expect(ok.ok).toBe(true)
    const makeup = sessions.find((s) => s.khoaBuoi === sessionKey(LOP, '2026-06-15'))
    expect(makeup?.trangThai).toBe('bu')
    expect(makeup?.buoiGoc).toBe(original.id)

    // Ngày đã có buổi thường (08/06) ⇒ chặn ghi đè.
    const dup = await createPlannedMakeup(payload, manager, {
      classId: LOP,
      originalSessionId: original.id as number,
      date: '2026-06-08',
    })
    expect(dup.ok).toBe(false)
    if (dup.ok) return
    expect(dup.error).toBe('invalid_input')
  })

  it('tạo bù: coach ⇒ forbidden', async () => {
    const { payload } = makeFakePayload()
    const res = await createPlannedMakeup(payload, coachKL, {
      classId: LOP,
      originalSessionId: 1,
      date: '2026-06-15',
    })
    expect(res.ok).toBe(false)
  })
})
