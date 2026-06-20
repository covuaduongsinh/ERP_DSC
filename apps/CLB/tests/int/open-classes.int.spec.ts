import { describe, it, expect } from 'vitest'

import { getTracksForLevels, type ChessLevel } from '@/lib/roadmap'
import { groupOpenClassesByLevel, type OpenClassCard } from '@/lib/open-classes'

const card = (id: number, ...level: ChessLevel[]): OpenClassCard => ({
  id,
  level,
  track: getTracksForLevels(level),
  ageGroup: ['cap_1_cap_2'],
  title: `Lớp ${id}`,
  locationName: 'Cơ sở A',
  schedule: [{ thu: 't2', gioBatDau: '18:00', gioKetThuc: '19:15' }],
})

describe('groupOpenClassesByLevel', () => {
  it('gom theo cấp và sắp theo thứ tự lộ trình (Tốt→…→Vua) bất kể thứ tự đầu vào', () => {
    const groups = groupOpenClassesByLevel([
      card(1, 'hau'),
      card(2, 'tot'),
      card(3, 'tot'),
      card(4, 'vua'),
    ])

    expect(groups.map((g) => g.level)).toEqual(['tot', 'hau', 'vua'])
    // Cấp "tot" giữ đủ 2 lớp.
    expect(groups[0].classes.map((c) => c.id)).toEqual([2, 3])
  })

  it('bỏ nhóm rỗng', () => {
    const groups = groupOpenClassesByLevel([card(1, 'ma')])
    expect(groups).toHaveLength(1)
    expect(groups[0].level).toBe('ma')
  })

  it('danh sách rỗng → mảng rỗng', () => {
    expect(groupOpenClassesByLevel([])).toEqual([])
  })

  it('lớp NHIỀU cấp xuất hiện ở mỗi bucket cấp tương ứng', () => {
    const groups = groupOpenClassesByLevel([card(1, 'tot', 'hau')])
    expect(groups.map((g) => g.level)).toEqual(['tot', 'hau'])
    expect(groups[0].classes.map((c) => c.id)).toEqual([1])
    expect(groups[1].classes.map((c) => c.id)).toEqual([1])
  })

  it('DTO thẻ lớp KHÔNG chứa field vận hành nhạy cảm (GV/phòng/sĩ số)', () => {
    const keys = Object.keys(card(1, 'tot'))
    expect(keys).not.toContain('coach')
    expect(keys).not.toContain('troGiang')
    expect(keys).not.toContain('phong')
    expect(keys).not.toContain('siSoToiDa')
  })
})
