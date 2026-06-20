import type { Payload } from 'payload'
import { describe, it, expect, vi } from 'vitest'

import { importEnrollments } from '@/lib/imports/enrollments'

// ─── Fake payload ─────────────────────────────────────────────────────────────────
// classes nạp 1 lần (find không where); students khớp theo fullName; enrollments
// khớp theo (student,class). Đủ để kiểm match + idempotent upsert.
type Doc = Record<string, unknown>
function makePayload(opts: { students?: Doc[]; classes?: Doc[]; enrollments?: Doc[] }) {
  const create = vi.fn(async () => ({ id: 999 }))
  const update = vi.fn(async () => ({ id: 0 }))
  const find = vi.fn(async ({ collection, where }: { collection: string; where?: any }) => {
    if (collection === 'classes') {
      const docs = opts.classes ?? []
      return { docs, totalDocs: docs.length }
    }
    if (collection === 'students') {
      const name = where?.fullName?.equals ?? where?.fullName?.like
      const docs = (opts.students ?? []).filter((s) => s.fullName === name)
      return { docs, totalDocs: docs.length }
    }
    if (collection === 'enrollments') {
      const and = where?.and ?? []
      const sid = and[0]?.student?.equals
      const cid = and[1]?.class?.equals
      const docs = (opts.enrollments ?? []).filter((e) => e.student === sid && e.class === cid)
      return { docs, totalDocs: docs.length }
    }
    return { docs: [], totalDocs: 0 }
  })
  return { payload: { find, create, update } as unknown as Payload, create, update, find }
}

const STUDENTS = [
  { id: 1001, fullName: 'Nguyễn Văn An' },
  { id: 1002, fullName: 'Trần Bảo Minh' },
]
const CLASSES = [
  { id: 5, title: 'Lớp A' },
  { id: 6, title: 'Lớp B' },
]
const row = (r: Record<string, string>) => r

describe('importEnrollments — match + idempotent (student,class) 🔒', () => {
  it('hợp lệ ⇒ created (dangHoc mặc định true)', async () => {
    const { payload, create } = makePayload({ students: STUDENTS, classes: CLASSES })
    const r = await importEnrollments(payload, 'f.csv', [
      row({ ten_hoc_vien: 'Nguyễn Văn An', ten_lop: 'Lớp A' }),
    ])
    expect(r.created).toBe(1)
    expect(r.errors).toBe(0)
    const arg = create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(arg.data).toMatchObject({ student: 1001, class: 5, dangHoc: true })
  })

  it('dang_hoc "Không" ⇒ dangHoc false', async () => {
    const { payload, create } = makePayload({ students: STUDENTS, classes: CLASSES })
    await importEnrollments(payload, 'f.csv', [
      row({ ten_hoc_vien: 'Trần Bảo Minh', ten_lop: 'Lớp B', dang_hoc: 'Không' }),
    ])
    const arg = create.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(arg.data.dangHoc).toBe(false)
  })

  it('thiếu ten_lop ⇒ error; lớp không có ⇒ error; HV không có ⇒ error', async () => {
    const { payload } = makePayload({ students: STUDENTS, classes: CLASSES })
    const r = await importEnrollments(payload, 'f.csv', [
      row({ ten_hoc_vien: 'Nguyễn Văn An' }),
      row({ ten_hoc_vien: 'Nguyễn Văn An', ten_lop: 'Lớp Không Có' }),
      row({ ten_hoc_vien: 'Người Lạ', ten_lop: 'Lớp A' }),
    ])
    expect(r.errors).toBe(3)
    expect(r.created).toBe(0)
  })

  it('một ô NHIỀU lớp (ngăn ;) ⇒ tạo nhiều ghi danh cho 1 HV', async () => {
    const { payload, create } = makePayload({ students: STUDENTS, classes: CLASSES })
    const r = await importEnrollments(payload, 'f.csv', [
      row({ ten_hoc_vien: 'Nguyễn Văn An', ten_lop: 'Lớp A; Lớp B' }),
    ])
    expect(r.created).toBe(2)
    expect(r.errors).toBe(0)
    expect(create).toHaveBeenCalledTimes(2)
    const classesEnrolled = create.mock.calls
      .map((c) => (c[0] as { data: { class: number } }).data.class)
      .sort()
    expect(classesEnrolled).toEqual([5, 6])
  })

  it('một ô nhiều lớp, 1 lớp không khớp ⇒ lớp kia vẫn tạo, lớp sai báo error', async () => {
    const { payload } = makePayload({ students: STUDENTS, classes: CLASSES })
    const r = await importEnrollments(payload, 'f.csv', [
      row({ ten_hoc_vien: 'Nguyễn Văn An', ten_lop: 'Lớp A; Lớp Không Có' }),
    ])
    expect(r.created).toBe(1)
    expect(r.errors).toBe(1)
  })

  it('cặp (HV,lớp) đã có ⇒ updated (không create)', async () => {
    const { payload, create, update } = makePayload({
      students: STUDENTS,
      classes: CLASSES,
      enrollments: [{ id: 7, student: 1001, class: 5, dangHoc: false }],
    })
    const r = await importEnrollments(payload, 'f.csv', [
      row({ ten_hoc_vien: 'Nguyễn Văn An', ten_lop: 'Lớp A', dang_hoc: 'Có' }),
    ])
    expect(r.updated).toBe(1)
    expect(update).toHaveBeenCalledOnce()
    expect(create).not.toHaveBeenCalled()
  })

  it('trùng (HV,lớp) trong file ⇒ skipped', async () => {
    const { payload } = makePayload({ students: STUDENTS, classes: CLASSES })
    const r = await importEnrollments(payload, 'f.csv', [
      row({ ten_hoc_vien: 'Nguyễn Văn An', ten_lop: 'Lớp A' }),
      row({ ten_hoc_vien: 'Nguyễn Văn An', ten_lop: 'Lớp A' }),
    ])
    expect(r.created).toBe(1)
    expect(r.skipped).toBe(1)
  })

  it('dryRun ⇒ không ghi', async () => {
    const { payload, create } = makePayload({ students: STUDENTS, classes: CLASSES })
    const r = await importEnrollments(
      payload,
      'f.csv',
      [row({ ten_hoc_vien: 'Nguyễn Văn An', ten_lop: 'Lớp A' })],
      { dryRun: true },
    )
    expect(r.created).toBe(1)
    expect(create).not.toHaveBeenCalled()
  })
})
