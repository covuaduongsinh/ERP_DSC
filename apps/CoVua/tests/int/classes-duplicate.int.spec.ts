import { describe, expect, it } from 'vitest'
import type { Class } from '@/payload-types'
import {
  buildClassDuplicateData,
  DUPLICATE_TITLE_SUFFIX,
} from '@/lib/classes/duplicate'

const baseClass: Class = {
  id: 7,
  title: 'Nhập môn - Kim Liên - Thứ 3',
  level: ['tot'],
  track: ['nhap_mon'],
  ageGroup: ['mam_non_4_6', 'cap_1_cap_2'],
  description: null,
  schedule: 'T3 17:00-18:30',
  location: 3,
  coach: 5,
  troGiang: null,
  siSoToiDa: 20,
  trangThai: 'dang_mo',
  lichHoc: [
    { id: 'slot-1', thu: 't3', gioBatDau: '17:00', gioKetThuc: '18:30', phong: 'A1' },
  ],
  createdAt: '2026-06-05T00:00:00.000Z',
  updatedAt: '2026-06-05T00:00:00.000Z',
}

describe('buildClassDuplicateData', () => {
  it('thêm hậu tố (bản sao) vào tên', () => {
    const data = buildClassDuplicateData(baseClass)
    expect(data.title).toBe(
      `Nhập môn - Kim Liên - Thứ 3${DUPLICATE_TITLE_SUFFIX}`,
    )
  })

  it('không kèm id/createdAt/updatedAt', () => {
    const data = buildClassDuplicateData(baseClass) as Record<string, unknown>
    expect(data.id).toBeUndefined()
    expect(data.createdAt).toBeUndefined()
    expect(data.updatedAt).toBeUndefined()
  })

  it('strip id của từng buổi lichHoc nhưng giữ nội dung buổi', () => {
    const data = buildClassDuplicateData(baseClass)
    expect(data.lichHoc).toEqual([
      { thu: 't3', gioBatDau: '17:00', gioKetThuc: '18:30', phong: 'A1' },
    ])
  })

  it('copy đầy đủ cấp/tuyến/nhóm tuổi/cơ sở/GV', () => {
    const data = buildClassDuplicateData(baseClass)
    expect(data.level).toEqual(['tot'])
    expect(data.track).toEqual(['nhap_mon'])
    expect(data.ageGroup).toEqual(['mam_non_4_6', 'cap_1_cap_2'])
    expect(data.location).toBe(3)
    expect(data.coach).toBe(5)
    expect(data.siSoToiDa).toBe(20)
    expect(data.trangThai).toBe('dang_mo')
  })

  it('lấy id quan hệ khi nguồn được populate (object có id)', () => {
    const populated = {
      ...baseClass,
      location: { id: 9 },
      coach: { id: 4 },
    } as unknown as Class
    const data = buildClassDuplicateData(populated)
    expect(data.location).toBe(9)
    expect(data.coach).toBe(4)
  })

  it('lichHoc rỗng/null → bỏ qua (undefined)', () => {
    const data = buildClassDuplicateData({ ...baseClass, lichHoc: null })
    expect(data.lichHoc).toBeUndefined()
  })
})
