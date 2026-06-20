import { describe, it, expect } from 'vitest'
import { diffEnrollment } from '@/lib/operations/student-enrollment'
import { findTimeConflicts, type ClassSlots } from '@/lib/operations/schedule'

describe('diffEnrollment — so tập lớp (thuần)', () => {
  it('tính đúng thêm/rút; bỏ trùng thứ tự không ảnh hưởng', () => {
    expect(diffEnrollment([1, 2, 3], [2, 3, 4])).toEqual({ toAdd: [4], toRemove: [1] })
    expect(diffEnrollment([], [5, 6])).toEqual({ toAdd: [5, 6], toRemove: [] })
    expect(diffEnrollment([5, 6], [])).toEqual({ toAdd: [], toRemove: [5, 6] })
    expect(diffEnrollment([1, 2], [1, 2])).toEqual({ toAdd: [], toRemove: [] })
  })
})

describe('findTimeConflicts — trùng giờ cho 1 HV (thuần)', () => {
  const mk = (id: number, title: string, slots: ClassSlots['slots']): ClassSlots => ({
    id,
    title,
    slots,
  })

  it('hai lớp cùng thứ + giao giờ ⇒ 1 cặp trùng (1 lần/cặp)', () => {
    const a = mk(1, 'A', [
      { thu: 't2', gioBatDau: '17:00', gioKetThuc: '18:30' },
      { thu: 't4', gioBatDau: '17:00', gioKetThuc: '18:30' },
    ])
    const b = mk(2, 'B', [
      { thu: 't2', gioBatDau: '18:00', gioKetThuc: '19:00' },
      { thu: 't4', gioBatDau: '18:00', gioKetThuc: '19:00' },
    ])
    const c = findTimeConflicts([a, b])
    expect(c).toHaveLength(1)
    expect(c[0]).toMatchObject({ a: { id: 1 }, b: { id: 2 } })
  })

  it('khác thứ / kề giờ ⇒ không trùng', () => {
    const a = mk(1, 'A', [{ thu: 't2', gioBatDau: '17:00', gioKetThuc: '18:00' }])
    const b = mk(2, 'B', [{ thu: 't2', gioBatDau: '18:00', gioKetThuc: '19:00' }]) // kề, không giao
    const d = mk(3, 'D', [{ thu: 't4', gioBatDau: '17:00', gioKetThuc: '18:30' }]) // khác thứ
    expect(findTimeConflicts([a, b, d])).toHaveLength(0)
  })

  it('rỗng / 1 lớp ⇒ không trùng', () => {
    expect(findTimeConflicts([])).toEqual([])
    expect(
      findTimeConflicts([mk(1, 'A', [{ thu: 't2', gioBatDau: '17:00', gioKetThuc: '18:30' }])]),
    ).toEqual([])
  })
})
