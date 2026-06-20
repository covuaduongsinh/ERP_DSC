import { describe, it, expect } from 'vitest'

import { computeBalance, isPaymentCounted } from '@/lib/operations/session-balance'
import { TUITION_LOW_THRESHOLD } from '@/lib/tuition'

/**
 * Unit test (không cần DB) cho `computeBalance` — số học thuần của "số buổi tồn"
 * theo 3 mode anchor (last_payment / opening / none) và 4 cờ trạng thái.
 */

describe('computeBalance — mode last_payment (mặc định)', () => {
  it('tồn = buổi lần nộp gần nhất − buổi học kể từ ngày đó (≥)', () => {
    const r = computeBalance({
      payments: [{ ngayNop: '2026-05-01', soBuoiNop: 10 }],
      attendanceDates: ['2026-05-01', '2026-05-03', '2026-05-05'],
    })
    expect(r.mode).toBe('last_payment')
    expect(r.anchorDate).toBe('2026-05-01')
    expect(r.paid).toBe(10)
    expect(r.attended).toBe(3) // buổi đúng ngày nộp cũng tính (≥)
    expect(r.balance).toBe(7)
    expect(r.flag).toBe('ok')
  })

  it('chỉ tính buổi học TỪ lần nộp gần nhất, bỏ buổi trước đó', () => {
    const r = computeBalance({
      payments: [
        { ngayNop: '2026-04-01', soBuoiNop: 10 },
        { ngayNop: '2026-05-01', soBuoiNop: 10 },
      ],
      attendanceDates: ['2026-04-10', '2026-04-20', '2026-05-02'], // 2 buổi trước anchor bị bỏ
    })
    expect(r.anchorDate).toBe('2026-05-01')
    expect(r.paid).toBe(10)
    expect(r.attended).toBe(1)
    expect(r.balance).toBe(9)
  })

  it('gộp nhiều phiếu thu CÙNG ngày nộp gần nhất', () => {
    const r = computeBalance({
      payments: [
        { ngayNop: '2026-05-01', soBuoiNop: 10 },
        { ngayNop: '2026-05-01', soBuoiNop: 20 },
      ],
      attendanceDates: ['2026-05-02'],
    })
    expect(r.paid).toBe(30)
    expect(r.balance).toBe(29)
  })

  it('cờ low khi tồn đúng bằng ngưỡng', () => {
    const r = computeBalance({
      payments: [{ ngayNop: '2026-05-01', soBuoiNop: 10 }],
      attendanceDates: Array.from(
        { length: 10 - TUITION_LOW_THRESHOLD },
        (_, i) => `2026-05-${String(i + 2).padStart(2, '0')}`,
      ),
    })
    expect(r.balance).toBe(TUITION_LOW_THRESHOLD)
    expect(r.flag).toBe('low')
  })

  it('cờ low khi tồn = 0', () => {
    const r = computeBalance({
      payments: [{ ngayNop: '2026-05-01', soBuoiNop: 2 }],
      attendanceDates: ['2026-05-01', '2026-05-02'],
    })
    expect(r.balance).toBe(0)
    expect(r.flag).toBe('low')
  })

  it('cờ negative khi đã học vượt số nộp', () => {
    const r = computeBalance({
      payments: [{ ngayNop: '2026-05-01', soBuoiNop: 2 }],
      attendanceDates: ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04'],
    })
    expect(r.balance).toBe(-2)
    expect(r.flag).toBe('negative')
  })

  it('cờ ok khi tồn vượt ngưỡng (ngưỡng + 1)', () => {
    const r = computeBalance({
      payments: [{ ngayNop: '2026-05-01', soBuoiNop: TUITION_LOW_THRESHOLD + 1 }],
      attendanceDates: [],
    })
    expect(r.balance).toBe(TUITION_LOW_THRESHOLD + 1)
    expect(r.flag).toBe('ok')
  })
})

describe('computeBalance — mode opening (chốt số dư đầu kỳ)', () => {
  it('tồn = số dư đầu + nộp sau ngày chốt − học sau ngày chốt (>)', () => {
    const r = computeBalance({
      openingBalance: 5,
      openingDate: '2026-05-01',
      payments: [
        { ngayNop: '2026-05-01', soBuoiNop: 99 }, // ĐÚNG ngày chốt ⇒ bỏ (đã gộp vào số dư)
        { ngayNop: '2026-05-10', soBuoiNop: 10 },
      ],
      attendanceDates: ['2026-05-01', '2026-05-12', '2026-05-13'], // buổi ngày chốt bị bỏ (>)
    })
    expect(r.mode).toBe('opening')
    expect(r.anchorDate).toBe('2026-05-01')
    expect(r.paid).toBe(15) // 5 + 10
    expect(r.attended).toBe(2)
    expect(r.balance).toBe(13)
  })

  it('chỉ có số dư mà KHÔNG có ngày chốt ⇒ KHÔNG dùng opening (rơi về last_payment)', () => {
    const r = computeBalance({
      openingBalance: 5,
      openingDate: null,
      payments: [{ ngayNop: '2026-05-01', soBuoiNop: 8 }],
      attendanceDates: ['2026-05-02'],
    })
    expect(r.mode).toBe('last_payment')
    expect(r.balance).toBe(7)
  })

  it('opening có thể âm ⇒ cờ negative', () => {
    const r = computeBalance({
      openingBalance: 1,
      openingDate: '2026-05-01',
      payments: [],
      attendanceDates: ['2026-05-05', '2026-05-06', '2026-05-07'],
    })
    expect(r.balance).toBe(-2)
    expect(r.flag).toBe('negative')
  })
})

describe('computeBalance — mode none (chưa có phiếu thu)', () => {
  it('không phiếu thu & không số dư ⇒ balance null, cờ none', () => {
    const r = computeBalance({
      payments: [],
      attendanceDates: ['2026-05-01', '2026-05-02'],
    })
    expect(r.mode).toBe('none')
    expect(r.anchorDate).toBeNull()
    expect(r.balance).toBeNull()
    expect(r.flag).toBe('none')
    expect(r.attended).toBe(2)
  })

  it('phiếu thu có ngày không hợp lệ ⇒ vẫn none', () => {
    const r = computeBalance({
      payments: [{ ngayNop: 'không-phải-ngày', soBuoiNop: 10 }],
      attendanceDates: [],
    })
    expect(r.mode).toBe('none')
  })
})

describe('computeBalance — đối soát toàn bộ lịch sử', () => {
  it('lifetime = tổng mọi soBuoiNop − tổng buổi co_mat (độc lập anchor)', () => {
    const r = computeBalance({
      payments: [
        { ngayNop: '2026-04-01', soBuoiNop: 10 },
        { ngayNop: '2026-05-01', soBuoiNop: 10 },
      ],
      attendanceDates: ['2026-04-10', '2026-05-02', '2026-05-03'],
    })
    expect(r.lifetimePaid).toBe(20)
    expect(r.lifetimeAttended).toBe(3)
    expect(r.lifetimeBalance).toBe(17)
  })

  it('soBuoiNop null/âm ⇒ tính 0', () => {
    const r = computeBalance({
      payments: [
        { ngayNop: '2026-05-01', soBuoiNop: null },
        { ngayNop: '2026-05-01', soBuoiNop: -5 },
        { ngayNop: '2026-05-01', soBuoiNop: 4 },
      ],
      attendanceDates: [],
    })
    expect(r.lifetimePaid).toBe(4)
    expect(r.paid).toBe(4)
  })
})

describe('isPaymentCounted — đánh dấu phiếu được tính (đồng bộ cửa sổ)', () => {
  it('last_payment: chỉ ngày == anchor mới tính', () => {
    expect(isPaymentCounted('2026-05-01', 'last_payment', '2026-05-01')).toBe(true)
    expect(isPaymentCounted('2026-05-01T09:30:00Z', 'last_payment', '2026-05-01')).toBe(true)
    expect(isPaymentCounted('2026-04-30', 'last_payment', '2026-05-01')).toBe(false)
    expect(isPaymentCounted('2026-05-02', 'last_payment', '2026-05-01')).toBe(false)
  })

  it('opening: chỉ ngày > anchor mới tính (== không tính)', () => {
    expect(isPaymentCounted('2026-05-02', 'opening', '2026-05-01')).toBe(true)
    expect(isPaymentCounted('2026-05-01', 'opening', '2026-05-01')).toBe(false)
    expect(isPaymentCounted('2026-04-30', 'opening', '2026-05-01')).toBe(false)
  })

  it('none / anchor null / ngày không hợp lệ ⇒ false', () => {
    expect(isPaymentCounted('2026-05-01', 'none', '2026-05-01')).toBe(false)
    expect(isPaymentCounted('2026-05-01', 'last_payment', null)).toBe(false)
    expect(isPaymentCounted('không-phải-ngày', 'last_payment', '2026-05-01')).toBe(false)
    expect(isPaymentCounted(null, 'last_payment', '2026-05-01')).toBe(false)
  })
})
