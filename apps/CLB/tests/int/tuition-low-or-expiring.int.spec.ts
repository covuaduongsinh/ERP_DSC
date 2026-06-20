import type { TuitionCycle } from '@/payload-types'
import { describe, it, expect } from 'vitest'

import {
  isTuitionCycleLowOrExpiring,
  resolveTuitionCycleStatus,
  suggestExpectedEndDate,
  TUITION_EXPIRING_SOON_DAYS,
  TUITION_LOW_THRESHOLD,
} from '@/lib/tuition'

/**
 * Unit test (không cần DB) cho vị từ hàng đợi "chu kỳ sắp hết buổi/hạn" mà
 * `countLowTuitionCycles` lọc trong bộ nhớ (sessionsUsed là virtual ⇒ không lọc
 * được ở DB). `now` được tiêm cố định để mọi ca biên tất định.
 */

const NOW = new Date('2026-06-02T00:00:00.000Z')

/** Dựng một chu kỳ tối thiểu, mặc định KHÔNG low/không expiring. */
function cycle(overrides: Partial<TuitionCycle> = {}): TuitionCycle {
  return {
    id: 1,
    student: 1,
    package: '20',
    sessionsTotal: 20,
    sessionsUsed: 0,
    startDate: '2026-05-01',
    expectedEndDate: null,
    status: 'dang_hoc',
    updatedAt: '2026-05-01',
    createdAt: '2026-05-01',
    ...overrides,
  }
}

/** Ngày cách NOW `days` ngày (âm = quá khứ). */
function daysFromNow(days: number): string {
  const d = new Date(NOW)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

describe('isTuitionCycleLowOrExpiring — sắp hết BUỔI', () => {
  it('còn nhiều buổi, chưa tới hạn ⇒ false', () => {
    expect(isTuitionCycleLowOrExpiring(cycle({ sessionsUsed: 5 }), NOW)).toBe(false)
  })

  it('số buổi còn lại đúng bằng ngưỡng ⇒ true (≤)', () => {
    const used = 20 - TUITION_LOW_THRESHOLD // remaining === ngưỡng
    expect(isTuitionCycleLowOrExpiring(cycle({ sessionsUsed: used }), NOW)).toBe(true)
  })

  it('còn lại dưới ngưỡng ⇒ true', () => {
    expect(isTuitionCycleLowOrExpiring(cycle({ sessionsUsed: 19 }), NOW)).toBe(true)
  })

  it('status đánh dấu sap_het ⇒ true dù còn nhiều buổi', () => {
    expect(isTuitionCycleLowOrExpiring(cycle({ status: 'sap_het', sessionsUsed: 0 }), NOW)).toBe(
      true,
    )
  })
})

describe('isTuitionCycleLowOrExpiring — sắp hết HẠN', () => {
  it('hết hạn đúng trong cửa sổ N ngày tới ⇒ true', () => {
    const c = cycle({ expectedEndDate: daysFromNow(TUITION_EXPIRING_SOON_DAYS - 1) })
    expect(isTuitionCycleLowOrExpiring(c, NOW)).toBe(true)
  })

  it('đã quá hạn (ngày trong quá khứ) ⇒ vẫn true', () => {
    expect(isTuitionCycleLowOrExpiring(cycle({ expectedEndDate: daysFromNow(-3) }), NOW)).toBe(true)
  })

  it('còn xa hạn (ngoài cửa sổ) ⇒ false', () => {
    const c = cycle({ expectedEndDate: daysFromNow(TUITION_EXPIRING_SOON_DAYS + 5) })
    expect(isTuitionCycleLowOrExpiring(c, NOW)).toBe(false)
  })

  it('không có expectedEndDate ⇒ chỉ xét buổi (ở đây false)', () => {
    expect(
      isTuitionCycleLowOrExpiring(cycle({ expectedEndDate: null, sessionsUsed: 0 }), NOW),
    ).toBe(false)
  })

  it('expectedEndDate không hợp lệ ⇒ bỏ qua nhánh hạn, không throw', () => {
    const c = cycle({ expectedEndDate: 'không-phải-ngày', sessionsUsed: 0 })
    expect(() => isTuitionCycleLowOrExpiring(c, NOW)).not.toThrow()
    expect(isTuitionCycleLowOrExpiring(c, NOW)).toBe(false)
  })

  it('gói da_het ⇒ KHÔNG xét nhánh hạn (đã chốt), dù ngày rơi trong cửa sổ', () => {
    // Còn nguyên buổi (remaining cao) để cô lập nhánh hạn: chỉ `da_het` mới
    // quyết định kết quả. Ghi chú: thực tế countLowTuitionCycles không nạp gói
    // `da_het`, guard này chỉ là phòng thủ khi predicate dùng độc lập.
    const c = cycle({ status: 'da_het', expectedEndDate: daysFromNow(1), sessionsUsed: 0 })
    expect(isTuitionCycleLowOrExpiring(c, NOW)).toBe(false)
  })
})

describe('resolveTuitionCycleStatus — suy trạng thái TỪ DỮ LIỆU (job reconcile)', () => {
  it('còn nhiều buổi, chưa tới hạn ⇒ dang_hoc', () => {
    expect(resolveTuitionCycleStatus(cycle({ sessionsUsed: 5 }), NOW)).toBe('dang_hoc')
  })

  it('đã dùng hết buổi (remaining ≤ 0) ⇒ da_het', () => {
    expect(resolveTuitionCycleStatus(cycle({ sessionsUsed: 20 }), NOW)).toBe('da_het')
    expect(resolveTuitionCycleStatus(cycle({ sessionsUsed: 25 }), NOW)).toBe('da_het')
  })

  it('còn buổi nhưng ≤ ngưỡng ⇒ sap_het', () => {
    const used = 20 - TUITION_LOW_THRESHOLD // remaining === ngưỡng (>0)
    expect(resolveTuitionCycleStatus(cycle({ sessionsUsed: used }), NOW)).toBe('sap_het')
  })

  it('còn buổi nhưng sắp hết hạn ⇒ sap_het', () => {
    const c = cycle({
      sessionsUsed: 0,
      expectedEndDate: daysFromNow(TUITION_EXPIRING_SOON_DAYS - 1),
    })
    expect(resolveTuitionCycleStatus(c, NOW)).toBe('sap_het')
  })

  it('quá hạn NHƯNG còn buổi ⇒ sap_het (KHÔNG ẩn thành da_het)', () => {
    const c = cycle({ sessionsUsed: 0, expectedEndDate: daysFromNow(-10) })
    expect(resolveTuitionCycleStatus(c, NOW)).toBe('sap_het')
  })

  it('TẤT ĐỊNH theo dữ liệu: bỏ qua status cũ (sap_het cũ + dữ liệu tốt ⇒ dang_hoc)', () => {
    const c = cycle({ status: 'sap_het', sessionsUsed: 5, expectedEndDate: null })
    expect(resolveTuitionCycleStatus(c, NOW)).toBe('dang_hoc')
  })
})

describe('suggestExpectedEndDate (gợi ý mềm ngày hết gói)', () => {
  it('start + ⌈buổi/2⌉ tuần (UTC): 10→5 tuần, 20→10 tuần, 40→20 tuần', () => {
    expect(suggestExpectedEndDate('2026-06-02', '10')).toBe('2026-07-07') // +35 ngày
    expect(suggestExpectedEndDate('2026-06-02', '20')).toBe('2026-08-11') // +70 ngày
    expect(suggestExpectedEndDate('2026-06-02', '40')).toBe('2026-10-20') // +140 ngày
  })

  it('startDate rỗng/không hợp lệ ⇒ "" (không gợi ý)', () => {
    expect(suggestExpectedEndDate('', '20')).toBe('')
    expect(suggestExpectedEndDate('không-phải-ngày', '20')).toBe('')
  })
})
