import { describe, it, expect } from 'vitest'

import {
  parseHm,
  slotsConflict,
  formatLichHoc,
  findScheduleConflicts,
  type TimetableClass,
} from '@/lib/operations/schedule'

describe('parseHm', () => {
  it('parse "HH:MM" → phút; sai định dạng → null', () => {
    expect(parseHm('17:30')).toBe(17 * 60 + 30)
    expect(parseHm('9:05')).toBe(9 * 60 + 5)
    expect(parseHm('00:00')).toBe(0)
    expect(parseHm('24:00')).toBe(null)
    expect(parseHm('17:60')).toBe(null)
    expect(parseHm('abc')).toBe(null)
    expect(parseHm('')).toBe(null)
    expect(parseHm(null)).toBe(null)
  })
})

describe('slotsConflict', () => {
  const slot = (thu: string, a: string, b: string) => ({ thu, gioBatDau: a, gioKetThuc: b })
  it('cùng thứ + giao giờ ⇒ trùng', () => {
    expect(slotsConflict(slot('t2', '17:00', '18:30'), slot('t2', '18:00', '19:00'))).toBe(true)
  })
  it('khác thứ ⇒ không trùng', () => {
    expect(slotsConflict(slot('t2', '17:00', '18:30'), slot('t4', '17:00', '18:30'))).toBe(false)
  })
  it('cùng thứ nhưng giờ kề nhau (không giao) ⇒ không trùng', () => {
    expect(slotsConflict(slot('t2', '17:00', '18:00'), slot('t2', '18:00', '19:00'))).toBe(false)
  })
  it('giờ sai định dạng ⇒ không kết luận trùng', () => {
    expect(slotsConflict(slot('t2', 'xx', '18:00'), slot('t2', '17:00', '19:00'))).toBe(false)
  })
})

describe('formatLichHoc', () => {
  it('sắp theo thứ rồi giờ; kèm phòng', () => {
    const out = formatLichHoc([
      { thu: 't4', gioBatDau: '17:00', gioKetThuc: '18:30' },
      { thu: 't2', gioBatDau: '17:00', gioKetThuc: '18:30', phong: 'A1' },
    ])
    expect(out).toBe('T2 17:00–18:30 (A1) · T4 17:00–18:30')
  })
  it('rỗng ⇒ chuỗi rỗng', () => {
    expect(formatLichHoc([])).toBe('')
    expect(formatLichHoc(null)).toBe('')
  })
})

describe('findScheduleConflicts', () => {
  const mk = (
    id: number,
    title: string,
    coaches: Array<{ id: number; name: string }>,
    locationId: number | null,
    slots: TimetableClass['slots'],
  ): TimetableClass => ({
    id,
    title,
    coaches,
    locationId,
    locationName: null,
    trangThai: 'dang_mo',
    slots,
  })

  it('trùng GV (chung 1 người, buổi giao giờ)', () => {
    const gv = [{ id: 1, name: 'Cô A' }]
    const a = mk(10, 'Lớp X', gv, 1, [{ thu: 't2', gioBatDau: '17:00', gioKetThuc: '18:30' }])
    const b = mk(11, 'Lớp Y', gv, 2, [{ thu: 't2', gioBatDau: '18:00', gioKetThuc: '19:00' }])
    const c = findScheduleConflicts([a, b])
    expect(c).toHaveLength(1)
    expect(c[0]).toMatchObject({ kind: 'coach', thu: 't2', detail: 'Cô A' })
  })

  it('trùng phòng (cùng cơ sở + cùng phòng, giao giờ)', () => {
    const a = mk(10, 'Lớp X', [{ id: 1, name: 'A' }], 1, [
      { thu: 't3', gioBatDau: '17:00', gioKetThuc: '18:30', phong: 'P1' },
    ])
    const b = mk(11, 'Lớp Y', [{ id: 2, name: 'B' }], 1, [
      { thu: 't3', gioBatDau: '18:00', gioKetThuc: '19:00', phong: 'P1' },
    ])
    const c = findScheduleConflicts([a, b])
    expect(c).toHaveLength(1)
    expect(c[0]).toMatchObject({ kind: 'room', detail: 'P1' })
  })

  it('cùng phòng nhưng KHÁC cơ sở ⇒ không trùng phòng', () => {
    const a = mk(10, 'X', [{ id: 1, name: 'A' }], 1, [
      { thu: 't3', gioBatDau: '17:00', gioKetThuc: '18:30', phong: 'P1' },
    ])
    const b = mk(11, 'Y', [{ id: 2, name: 'B' }], 2, [
      { thu: 't3', gioBatDau: '17:00', gioKetThuc: '18:30', phong: 'P1' },
    ])
    expect(findScheduleConflicts([a, b])).toHaveLength(0)
  })

  it('khác GV + khác phòng ⇒ không trùng', () => {
    const a = mk(10, 'X', [{ id: 1, name: 'A' }], 1, [
      { thu: 't2', gioBatDau: '17:00', gioKetThuc: '18:30' },
    ])
    const b = mk(11, 'Y', [{ id: 2, name: 'B' }], 1, [
      { thu: 't2', gioBatDau: '17:00', gioKetThuc: '18:30' },
    ])
    expect(findScheduleConflicts([a, b])).toHaveLength(0)
  })
})
