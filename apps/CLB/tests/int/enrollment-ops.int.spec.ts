import type { Payload } from 'payload'
import { describe, it, expect, vi } from 'vitest'

import type { User } from '@/payload-types'
import {
  addStudentToClass,
  removeStudentFromClass,
  transferStudentClass,
} from '@/lib/operations/enrollment'

// ─── Actors ─────────────────────────────────────────────────────────────────────
const KIM_LIEN = 1
const VINH_PHUC = 2
const admin = { id: 1, collection: 'users', role: 'admin' } as unknown as User
const coachKL = {
  id: 10,
  collection: 'users',
  role: 'coach',
  location: KIM_LIEN,
} as unknown as User

// ─── Fake payload (kiểm soát find theo collection; ghi nhận create/update) ─────────
type Docs = Array<Record<string, unknown>>
function makePayload(opts: { classDocs?: Docs; studentDocs?: Docs; enrollmentDocs?: Docs }) {
  const create = vi.fn(async () => ({ id: 999 }))
  const update = vi.fn(async () => ({ id: 0 }))
  const find = vi.fn(async ({ collection }: { collection: string }) => {
    if (collection === 'classes') return { docs: opts.classDocs ?? [] }
    if (collection === 'students') return { docs: opts.studentDocs ?? [] }
    if (collection === 'enrollments') return { docs: opts.enrollmentDocs ?? [] }
    return { docs: [] }
  })
  return { payload: { find, create, update } as unknown as Payload, create, update, find }
}

// ════════════════════════════════════════════════════════════════════════════════
describe('addStudentToClass — branch-safe + idempotent 🔒', () => {
  it('non-staff (null) ⇒ forbidden', async () => {
    const { payload } = makePayload({})
    const res = await addStudentToClass(payload, null, 5, 10)
    expect(res).toEqual({
      ok: false,
      error: 'forbidden',
      message: expect.stringContaining('nhân viên'),
    })
  })

  it('id không hợp lệ ⇒ invalid_input', async () => {
    const { payload } = makePayload({})
    expect((await addStudentToClass(payload, admin, 0, 10)).ok).toBe(false)
    expect((await addStudentToClass(payload, admin, 5, -1)).ok).toBe(false)
  })

  it('admin (global) + chưa có ghi danh ⇒ created (gọi create)', async () => {
    const { payload, create } = makePayload({
      classDocs: [{ id: 5, location: VINH_PHUC }],
      studentDocs: [{ id: 10 }],
      enrollmentDocs: [],
    })
    const res = await addStudentToClass(payload, admin, 5, 10)
    expect(res).toMatchObject({ ok: true, action: 'created' })
    expect(create).toHaveBeenCalledOnce()
  })

  it('🔒 coach bị-khóa: lớp KHÁC cơ sở ⇒ forbidden (không create)', async () => {
    const { payload, create } = makePayload({
      classDocs: [{ id: 5, location: VINH_PHUC }], // coachKL thuộc KIM_LIEN
      studentDocs: [{ id: 10 }],
    })
    const res = await addStudentToClass(payload, coachKL, 5, 10)
    expect(res).toMatchObject({ ok: false, error: 'forbidden' })
    expect(create).not.toHaveBeenCalled()
  })

  it('🔒 coach bị-khóa: lớp cùng cơ sở nhưng HV ngoài cơ sở (read scoped trả rỗng) ⇒ forbidden', async () => {
    const { payload, create } = makePayload({
      classDocs: [{ id: 5, location: KIM_LIEN }],
      studentDocs: [], // students.read đã scope ⇒ HV ngoài cơ sở không trả về
    })
    const res = await addStudentToClass(payload, coachKL, 5, 10)
    expect(res).toMatchObject({ ok: false, error: 'forbidden' })
    expect(create).not.toHaveBeenCalled()
  })

  it('đã có ghi danh dangHoc=false ⇒ reactivated (update dangHoc:true)', async () => {
    const { payload, update, create } = makePayload({
      classDocs: [{ id: 5, location: KIM_LIEN }],
      studentDocs: [{ id: 10 }],
      enrollmentDocs: [{ id: 7, dangHoc: false }],
    })
    const res = await addStudentToClass(payload, coachKL, 5, 10)
    expect(res).toMatchObject({ ok: true, action: 'reactivated', enrollmentId: 7 })
    expect(update).toHaveBeenCalledOnce()
    expect(create).not.toHaveBeenCalled()
  })

  it('đã có ghi danh dangHoc=true ⇒ already (không create/update)', async () => {
    const { payload, update, create } = makePayload({
      classDocs: [{ id: 5, location: KIM_LIEN }],
      studentDocs: [{ id: 10 }],
      enrollmentDocs: [{ id: 7, dangHoc: true }],
    })
    const res = await addStudentToClass(payload, coachKL, 5, 10)
    expect(res).toMatchObject({ ok: true, action: 'already', enrollmentId: 7 })
    expect(update).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })
})

describe('removeStudentFromClass — giữ lịch sử (dangHoc=false) 🔒', () => {
  it('non-staff ⇒ forbidden', async () => {
    const { payload } = makePayload({})
    expect((await removeStudentFromClass(payload, null, 5, 10)).ok).toBe(false)
  })

  it('không có ghi danh đang học (hoặc ngoài cơ sở) ⇒ not_found', async () => {
    const { payload, update } = makePayload({ enrollmentDocs: [] })
    const res = await removeStudentFromClass(payload, coachKL, 5, 10)
    expect(res).toMatchObject({ ok: false, error: 'not_found' })
    expect(update).not.toHaveBeenCalled()
  })

  it('có ghi danh đang học ⇒ update dangHoc:false', async () => {
    const { payload, update } = makePayload({ enrollmentDocs: [{ id: 7, dangHoc: true }] })
    const res = await removeStudentFromClass(payload, coachKL, 5, 10)
    expect(res).toMatchObject({ ok: true, enrollmentId: 7 })
    expect(update).toHaveBeenCalledOnce()
    const arg = update.mock.calls[0][0] as { data: { dangHoc: boolean } }
    expect(arg.data.dangHoc).toBe(false)
  })
})

describe('transferStudentClass — chuyển lớp (thêm đích → rút nguồn) 🔒', () => {
  it('non-staff ⇒ forbidden', async () => {
    const { payload } = makePayload({})
    expect((await transferStudentClass(payload, null, 9, 10, 5)).ok).toBe(false)
  })

  it('lớp nguồn = lớp đích ⇒ invalid_input', async () => {
    const { payload } = makePayload({
      classDocs: [{ id: 5, location: KIM_LIEN }],
      studentDocs: [{ id: 10 }],
    })
    const res = await transferStudentClass(payload, coachKL, 5, 10, 5)
    expect(res).toMatchObject({ ok: false, error: 'invalid_input' })
  })

  it('🔒 lớp ĐÍCH ngoài cơ sở ⇒ forbidden, KHÔNG rút lớp nguồn', async () => {
    const { payload, update, create } = makePayload({
      classDocs: [{ id: 5, location: VINH_PHUC }], // coachKL ∈ KIM_LIEN
      studentDocs: [{ id: 10 }],
      enrollmentDocs: [{ id: 7, dangHoc: true }],
    })
    const res = await transferStudentClass(payload, coachKL, 9, 10, 5)
    expect(res).toMatchObject({ ok: false, error: 'forbidden' })
    expect(create).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled() // abort trước khi rút lớp nguồn
  })

  it('happy: thêm vào đích (đã có) + rút nguồn (update dangHoc:false) ⇒ ok', async () => {
    const { payload, update } = makePayload({
      classDocs: [{ id: 5, location: KIM_LIEN }],
      studentDocs: [{ id: 10 }],
      enrollmentDocs: [{ id: 7, dangHoc: true }],
    })
    const res = await transferStudentClass(payload, coachKL, 9, 10, 5)
    expect(res).toEqual({ ok: true })
    expect(update).toHaveBeenCalled() // rút lớp nguồn
  })
})
