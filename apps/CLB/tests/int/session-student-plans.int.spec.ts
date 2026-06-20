import type { Payload } from 'payload'
import { describe, it, expect, vi } from 'vitest'

import type { User } from '@/payload-types'
import {
  loadClassRosterForDate,
  loadSessionStudentPlans,
  updateStudentPlan,
  applyClassPlanToAll,
} from '@/lib/operations/session-student-plans'

// ─── Actors ───────────────────────────────────────────────────────────────────
const manager = { id: 2, collection: 'users', role: 'manager' } as unknown as User
const parentA = { id: 101, collection: 'parents', children: [1001] } as unknown as User
const anon = null

const LOP = 5001
const SESSION_ID = 7
const SESSION_DATE = '2026-06-10T00:00:00.000Z' // T4
const CLASS_CONTENT = {
  sachDangHoc: 'Sách lớp',
  kienThucMoi: 'KT lớp',
  giaoBTVN: null,
  khBuoiSau: null,
}

const SESSION_DOC = { id: SESSION_ID, lop: LOP, date: SESSION_DATE, ...CLASS_CONTENT }

// HV: A,B trong roster ngày 10/06; C ghi danh sau (20/06); D nghỉ trước (05/06).
const STUDENTS = [
  { id: 1001, fullName: 'An' },
  { id: 1002, fullName: 'Bình' },
  { id: 1003, fullName: 'Cường' },
  { id: 1004, fullName: 'Dũng' },
]
const ENROLLMENTS = [
  { student: 1001, class: LOP, dangHoc: true, ngayBatDau: '2026-05-01', ngayKetThuc: null },
  { student: 1002, class: LOP, dangHoc: true, ngayBatDau: null, ngayKetThuc: null }, // dung sai null
  { student: 1003, class: LOP, dangHoc: true, ngayBatDau: '2026-06-20', ngayKetThuc: null }, // vào sau
  {
    student: 1004,
    class: LOP,
    dangHoc: false,
    ngayBatDau: '2026-01-01',
    ngayKetThuc: '2026-06-05',
  }, // nghỉ trước
]

function t(v: string | null): number | null {
  return v == null ? null : new Date(v).getTime()
}

/** Fake payload: enrollments + students + class-sessions + session-student-plans.
 *  Đếm thao tác attendance để chứng minh KHÔNG đụng tính học phí. */
function makeFake(session: Record<string, unknown> = SESSION_DOC) {
  const plans: Array<Record<string, unknown>> = []
  let nextId = 1
  const attendanceOps = { create: 0, update: 0, delete: 0 }

  const find = vi.fn(
    async ({ collection, where }: { collection: string; where?: Record<string, unknown> }) => {
      if (collection === 'enrollments') {
        const and = (where as { and?: Array<Record<string, unknown>> }).and ?? []
        const classId = (and[0] as { class?: { equals?: number } })?.class?.equals
        const batDauLte = (
          (and[1] as { or?: Array<Record<string, unknown>> })?.or?.[1] as {
            ngayBatDau?: { less_than_equal?: string }
          }
        )?.ngayBatDau?.less_than_equal
        const ketThucGte = (
          (and[2] as { or?: Array<Record<string, unknown>> })?.or?.[2] as {
            ngayKetThuc?: { greater_than_equal?: string }
          }
        )?.ngayKetThuc?.greater_than_equal
        const docs = ENROLLMENTS.filter((e) => {
          if (e.class !== classId) return false
          if (e.ngayBatDau != null && batDauLte != null && t(e.ngayBatDau)! > t(batDauLte)!)
            return false
          const keepByEnd =
            e.dangHoc === true ||
            e.ngayKetThuc == null ||
            (ketThucGte != null && t(e.ngayKetThuc)! >= t(ketThucGte)!)
          return keepByEnd
        })
        return { docs, totalDocs: docs.length }
      }
      if (collection === 'students') {
        const ids = (where as { id?: { in?: number[] } }).id?.in ?? []
        const set = new Set(ids)
        const docs = STUDENTS.filter((s) => set.has(s.id))
        return { docs, totalDocs: docs.length }
      }
      if (collection === 'session-student-plans') {
        const w = (where ?? {}) as {
          session?: { equals?: number }
          khoaKeHoach?: { equals?: string }
        }
        let docs = plans.slice()
        if (w.khoaKeHoach?.equals != null)
          docs = docs.filter((p) => p.khoaKeHoach === w.khoaKeHoach!.equals)
        else if (w.session?.equals != null)
          docs = docs.filter((p) => p.session === w.session!.equals)
        return { docs, totalDocs: docs.length }
      }
      return { docs: [], totalDocs: 0 }
    },
  )

  const findByID = vi.fn(async ({ collection, id }: { collection: string; id: number }) =>
    collection === 'class-sessions' && id === (session.id as number) ? session : null,
  )

  const create = vi.fn(
    async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
      if (collection === 'attendance') {
        attendanceOps.create += 1
        return { id: nextId++, ...data }
      }
      if (data.khoaKeHoach && plans.some((p) => p.khoaKeHoach === data.khoaKeHoach)) {
        throw new Error(
          'duplicate key value violates unique constraint "session_student_plans_khoa_ke_hoach_idx"',
        )
      }
      const doc = { id: nextId++, ...data }
      plans.push(doc)
      return doc
    },
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
      const idx = plans.findIndex((p) => p.id === id)
      if (idx >= 0) plans[idx] = { ...plans[idx], ...data }
      return plans[idx]
    },
  )

  const del = vi.fn(async ({ collection }: { collection: string }) => {
    if (collection === 'attendance') attendanceOps.delete += 1
    return { docs: [] }
  })

  return {
    payload: { find, create, findByID, update, delete: del } as unknown as Payload,
    plans,
    attendanceOps,
  }
}

// ════════════════════════════════════════════════════════════════════════════════
describe('loadClassRosterForDate — cửa sổ ngày + dung sai null', () => {
  it('chỉ HV hợp lệ tại ngày buổi (vào sau / nghỉ trước → ẩn; thiếu ngày → hiện)', async () => {
    const { payload } = makeFake()
    const roster = await loadClassRosterForDate(payload, manager, LOP, SESSION_DATE)
    const ids = roster.map((r) => r.studentId).sort()
    expect(ids).toEqual([1001, 1002]) // An + Bình; KHÔNG có Cường(vào sau)/Dũng(nghỉ trước)
  })

  it('non-staff ⇒ rỗng', async () => {
    const { payload } = makeFake()
    expect(await loadClassRosterForDate(payload, parentA, LOP, SESSION_DATE)).toEqual([])
    expect(await loadClassRosterForDate(payload, anon, LOP, SESSION_DATE)).toEqual([])
  })
})

// ════════════════════════════════════════════════════════════════════════════════
describe('loadSessionStudentPlans — kế thừa cả lớp / ghi đè', () => {
  it('chưa có override ⇒ effective = nội dung cả lớp (kế thừa)', async () => {
    const { payload } = makeFake()
    const res = await loadSessionStudentPlans(payload, manager, SESSION_ID)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.classContent.sachDangHoc).toBe('Sách lớp')
    expect(res.rows).toHaveLength(2)
    const an = res.rows.find((r) => r.studentId === 1001)!
    expect(an.override.sachDangHoc).toBeNull()
    expect(an.effective.sachDangHoc).toBe('Sách lớp') // kế thừa
    expect(an.effective.kienThucMoi).toBe('KT lớp')
  })

  it('non-staff ⇒ forbidden', async () => {
    const { payload } = makeFake()
    expect((await loadSessionStudentPlans(payload, parentA, SESSION_ID)).ok).toBe(false)
    expect((await loadSessionStudentPlans(payload, anon, SESSION_ID)).ok).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════════
describe('updateStudentPlan — ghi đè idempotent + ranh giới tiền 🔒', () => {
  it('ghi đè 1 HV ⇒ effective = override; gọi 2 lần ⇒ 1 dòng; KHÔNG đụng attendance', async () => {
    const { payload, plans, attendanceOps } = makeFake()
    const a = await updateStudentPlan(payload, manager, {
      sessionId: SESSION_ID,
      studentId: 1001,
      patch: { sachDangHoc: 'Sách An' },
    })
    expect(a.ok).toBe(true)
    const b = await updateStudentPlan(payload, manager, {
      sessionId: SESSION_ID,
      studentId: 1001,
      patch: { sachDangHoc: 'Sách An (sửa)' },
    })
    expect(b.ok).toBe(true)
    expect(plans).toHaveLength(1) // idempotent qua khoaKeHoach

    const res = await loadSessionStudentPlans(payload, manager, SESSION_ID)
    if (!res.ok) throw new Error('load fail')
    const an = res.rows.find((r) => r.studentId === 1001)!
    expect(an.override.sachDangHoc).toBe('Sách An (sửa)')
    expect(an.effective.sachDangHoc).toBe('Sách An (sửa)')
    // Bình vẫn kế thừa.
    expect(res.rows.find((r) => r.studentId === 1002)!.effective.sachDangHoc).toBe('Sách lớp')

    expect(attendanceOps).toEqual({ create: 0, update: 0, delete: 0 })
  })

  it('HV ngoài roster (vào sau) ⇒ forbidden, không ghi', async () => {
    const { payload, plans } = makeFake()
    const res = await updateStudentPlan(payload, manager, {
      sessionId: SESSION_ID,
      studentId: 1003,
      patch: { sachDangHoc: 'x' },
    })
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('forbidden')
    expect(plans).toHaveLength(0)
  })

  it('non-staff ⇒ forbidden', async () => {
    const { payload } = makeFake()
    expect(
      (
        await updateStudentPlan(payload, parentA, {
          sessionId: SESSION_ID,
          studentId: 1001,
          patch: { sachDangHoc: 'x' },
        })
      ).ok,
    ).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════════
describe('applyClassPlanToAll — vật chất hóa nội dung cả lớp 🔒', () => {
  it('ghi 1 dòng/HV roster với nội dung cả lớp; KHÔNG đụng attendance', async () => {
    const { payload, plans, attendanceOps } = makeFake()
    const res = await applyClassPlanToAll(payload, manager, SESSION_ID)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.affected).toBe(2) // An + Bình
    expect(plans).toHaveLength(2)
    expect(plans.every((p) => p.sachDangHoc === 'Sách lớp' && p.kienThucMoi === 'KT lớp')).toBe(
      true,
    )
    expect(attendanceOps).toEqual({ create: 0, update: 0, delete: 0 })
  })
})
