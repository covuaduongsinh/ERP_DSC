import { describe, it, expect } from 'vitest'

import {
  clampWeeks,
  computeAttendanceRate,
  computeCashflow,
  computeExpenses,
  computeLeadKpis,
  computeRefunds,
  computeRenewalRate,
  computeRevenue,
  DEFAULT_WEEKS,
  resolveWindow,
  startOfUtcWeekMonday,
  type ExpenseRow,
  type LeadRow,
  type PaymentRow,
} from '@/lib/kpi/compute'
import { formatDateUtc, formatPercent, formatVnd, formatWeekLabel } from '@/lib/kpi/format'

/**
 * Unit test THUẦN (không DB) cho lớp tính KPI — mã hóa giá trị TÍNH TAY cho từng
 * chỉ số ⇒ đây chính là bằng chứng "số khớp query thủ công" của acceptance.
 *
 * `now` cố định = Thứ Ba 2026-06-02 (đầu tuần = Thứ Hai 2026-06-01). Với weeks=4,
 * cửa sổ là [2026-05-11, 2026-06-02T12:00] với 4 mốc tuần:
 *   bucket0=11/05, bucket1=18/05, bucket2=25/05, bucket3=01/06 (tuần hiện tại).
 */
const NOW = new Date('2026-06-02T12:00:00.000Z')

describe('resolveWindow / clampWeeks / startOfUtcWeekMonday', () => {
  it('mốc tuần (Thứ Hai, UTC) của 2026-06-02 (Thứ Ba) = 2026-06-01', () => {
    expect(startOfUtcWeekMonday(NOW).toISOString()).toBe('2026-06-01T00:00:00.000Z')
  })

  it('weeks=4 ⇒ from lùi 3 tuần từ đầu tuần hiện tại', () => {
    const w = resolveWindow(4, NOW)
    expect(w.weeks).toBe(4)
    expect(w.from.toISOString()).toBe('2026-05-11T00:00:00.000Z')
    expect(w.to.toISOString()).toBe(NOW.toISOString())
  })

  it('kẹp weeks về [1,52]; không hợp lệ ⇒ mặc định', () => {
    expect(clampWeeks(0)).toBe(1)
    expect(clampWeeks(100)).toBe(52)
    expect(clampWeeks(12.7)).toBe(12)
    expect(clampWeeks(Number.NaN)).toBe(DEFAULT_WEEKS)
  })
})

/** Lead tối thiểu với mặc định an toàn. */
function lead(overrides: Partial<LeadRow> & { createdAt: string }): LeadRow {
  return { source: 'khac', status: 'moi', ...overrides }
}

describe('computeLeadKpis — tuần, nguồn, funnel', () => {
  const window = resolveWindow(4, NOW)
  const rows: LeadRow[] = [
    lead({ createdAt: '2026-05-12T08:00:00Z', source: 'google', status: 'moi' }), // b0
    lead({ createdAt: '2026-05-19T08:00:00Z', source: 'facebook', status: 'da_lien_he' }), // b1
    lead({ createdAt: '2026-05-26T08:00:00Z', source: 'google', status: 'dang_ky_hoc_thu' }), // b2
    lead({ createdAt: '2026-06-01T08:00:00Z', source: 'gioi_thieu', status: 'da_chot' }), // b3
    lead({ createdAt: '2026-06-02T10:00:00Z', source: 'khac', status: 'khong_phu_hop' }), // b3
    lead({ createdAt: '2026-05-01T08:00:00Z', source: 'google', status: 'da_chot' }), // trước cửa sổ → loại
    lead({ createdAt: '2026-06-10T08:00:00Z', source: 'google', status: 'da_chot' }), // sau `to` → loại
  ]
  const kpis = computeLeadKpis(rows, window)

  it('weekly: đủ 4 bucket, đếm đúng tuần', () => {
    expect(kpis.weekly.map((b) => b.count)).toEqual([1, 1, 1, 2])
    expect(kpis.weekly[0].weekStart.toISOString()).toBe('2026-05-11T00:00:00.000Z')
    expect(kpis.weekly[3].weekStart.toISOString()).toBe('2026-06-01T00:00:00.000Z')
  })

  it('bySource: đủ 4 nguồn + tỉ trọng trên tổng 5 lead trong cửa sổ', () => {
    const map = Object.fromEntries(kpis.bySource.map((s) => [s.source, s]))
    expect(map.google.count).toBe(2)
    expect(map.facebook.count).toBe(1)
    expect(map.gioi_thieu.count).toBe(1)
    expect(map.khac.count).toBe(1)
    expect(map.google.pct).toBeCloseTo(0.4, 10)
    expect(map.facebook.pct).toBeCloseTo(0.2, 10)
  })

  it('funnel: phân loại theo trạng thái + tỉ lệ chuyển đổi', () => {
    expect(kpis.funnel.total).toBe(5)
    expect(kpis.funnel.contacted).toBe(3) // da_lien_he + dang_ky_hoc_thu + da_chot
    expect(kpis.funnel.trial).toBe(2) // dang_ky_hoc_thu + da_chot
    expect(kpis.funnel.official).toBe(1) // da_chot
    expect(kpis.funnel.unfit).toBe(1) // khong_phu_hop
    expect(kpis.funnel.rateLeadToTrial).toBeCloseTo(2 / 5, 10)
    expect(kpis.funnel.rateTrialToOfficial).toBeCloseTo(1 / 2, 10)
    expect(kpis.funnel.rateLeadToOfficial).toBeCloseTo(1 / 5, 10)
  })

  it('tập rỗng ⇒ tổng 0, mọi tỉ lệ null (chia 0)', () => {
    const empty = computeLeadKpis([], window)
    expect(empty.funnel.total).toBe(0)
    expect(empty.funnel.rateLeadToTrial).toBeNull()
    expect(empty.funnel.rateTrialToOfficial).toBeNull()
    expect(empty.bySource.every((s) => s.count === 0 && s.pct === null)).toBe(true)
  })
})

describe('computeRenewalRate — ≥2 chu kỳ / ≥1 chu kỳ', () => {
  it('đếm theo học viên: [1,1,2,3,3,3] ⇒ 2/3', () => {
    const r = computeRenewalRate([1, 1, 2, 3, 3, 3])
    expect(r.withCycle).toBe(3)
    expect(r.renewed).toBe(2) // HV 1 và 3
    expect(r.rate).toBeCloseTo(2 / 3, 10)
  })

  it('không có chu kỳ ⇒ rate null', () => {
    const r = computeRenewalRate([])
    expect(r).toEqual({ withCycle: 0, renewed: 0, rate: null })
  })
})

describe('computeAttendanceRate — co_mat / (co_mat+vang+phep)', () => {
  it('80/(80+15+5) = 0.8', () => {
    const a = computeAttendanceRate({ present: 80, absent: 15, excused: 5 })
    expect(a.total).toBe(100)
    expect(a.presentRate).toBeCloseTo(0.8, 10)
  })

  it('không có buổi nào ⇒ rate null', () => {
    const a = computeAttendanceRate({ present: 0, absent: 0, excused: 0 })
    expect(a.total).toBe(0)
    expect(a.presentRate).toBeNull()
  })
})

describe('computeRevenue — Σ(hocPhi+tienSach) loại muaKhac, theo tuần', () => {
  const window = resolveWindow(4, NOW)
  const rows: PaymentRow[] = [
    { ngayNop: '2026-05-12T08:00:00Z', hocPhi: 1_000_000, tienSach: 200_000, muaKhac: 50_000 }, // b0
    { ngayNop: '2026-06-01T08:00:00Z', hocPhi: 2_000_000, tienSach: 0, muaKhac: null }, // b3
    { ngayNop: '2026-05-01T08:00:00Z', hocPhi: 9_000_000, tienSach: 9_000_000 }, // trước cửa sổ → loại
  ]
  const rev = computeRevenue(rows, window)

  it('tổng = hocPhi + tienSach (muaKhac KHÔNG cộng)', () => {
    expect(rev.hocPhi).toBe(3_000_000)
    expect(rev.tienSach).toBe(200_000)
    expect(rev.muaKhac).toBe(50_000)
    expect(rev.total).toBe(3_200_000)
  })

  it('weekly amount theo bucket', () => {
    expect(rev.weekly.map((w) => w.amount)).toEqual([1_200_000, 0, 0, 2_000_000])
  })
})

describe('computeExpenses — Σ(amount) theo cửa sổ, theo tuần', () => {
  const window = resolveWindow(4, NOW)
  const rows: ExpenseRow[] = [
    { spentAt: '2026-05-12T08:00:00Z', amount: 500_000 }, // b0
    { spentAt: '2026-06-01T08:00:00Z', amount: 1_000_000 }, // b3
    { spentAt: '2026-06-02T09:00:00Z', amount: null }, // b3, null ⇒ 0
    { spentAt: '2026-05-01T08:00:00Z', amount: 9_000_000 }, // trước cửa sổ → loại
  ]
  const exp = computeExpenses(rows, window)

  it('tổng chi = Σ amount trong cửa sổ (null ⇒ 0)', () => {
    expect(exp.total).toBe(1_500_000)
  })

  it('weekly amount theo bucket', () => {
    expect(exp.weekly.map((w) => w.amount)).toEqual([500_000, 0, 0, 1_000_000])
  })
})

describe('computeCashflow — Thu − Chi tổng + theo tuần', () => {
  const window = resolveWindow(4, NOW)
  const revenue = computeRevenue(
    [
      { ngayNop: '2026-05-12T08:00:00Z', hocPhi: 1_000_000, tienSach: 200_000 }, // b0 = 1.2tr
      { ngayNop: '2026-06-01T08:00:00Z', hocPhi: 2_000_000, tienSach: 0 }, // b3 = 2tr
    ],
    window,
  )
  const expenses = computeExpenses(
    [
      { spentAt: '2026-05-12T08:00:00Z', amount: 500_000 }, // b0
      { spentAt: '2026-06-01T08:00:00Z', amount: 1_000_000 }, // b3
    ],
    window,
  )
  const cf = computeCashflow(revenue, expenses)

  it('tổng net = Thu − Chi', () => {
    expect(cf.revenue).toBe(3_200_000)
    expect(cf.expense).toBe(1_500_000)
    expect(cf.net).toBe(1_700_000)
  })

  it('weekly net = thu − chi từng tuần', () => {
    expect(cf.weekly.map((w) => w.net)).toEqual([700_000, 0, 0, 1_000_000])
    expect(cf.weekly[0]).toMatchObject({ revenue: 1_200_000, expense: 500_000, net: 700_000 })
  })
})

describe('computeRefunds + net (Thu − Hoàn − Chi)', () => {
  const window = resolveWindow(4, NOW)
  const revenue = computeRevenue(
    [{ ngayNop: '2026-05-12T08:00:00Z', hocPhi: 3_000_000, tienSach: 0 }],
    window,
  )
  const expenses = computeExpenses([{ spentAt: '2026-05-12T08:00:00Z', amount: 500_000 }], window)
  const refunds = computeRefunds(
    [
      { ngayHoan: '2026-05-12T08:00:00Z', soTien: 1_000_000 },
      { ngayHoan: '2026-05-01T08:00:00Z', soTien: 9_000_000 }, // trước cửa sổ → loại
    ],
    window,
  )

  it('refunds.total chỉ tính trong cửa sổ', () => {
    expect(refunds.total).toBe(1_000_000)
  })

  it('net = Thu − Hoàn − Chi', () => {
    const cf = computeCashflow(revenue, expenses, refunds)
    expect(cf.revenue).toBe(3_000_000)
    expect(cf.refunds).toBe(1_000_000)
    expect(cf.expense).toBe(500_000)
    expect(cf.net).toBe(1_500_000)
  })

  it('không truyền refunds ⇒ refunds=0 (tương thích cũ)', () => {
    const cf = computeCashflow(revenue, expenses)
    expect(cf.refunds).toBe(0)
    expect(cf.net).toBe(2_500_000)
  })
})

describe('format helpers', () => {
  it('formatPercent: tỉ lệ 1 chữ số thập phân; null ⇒ —', () => {
    expect(formatPercent(0.4)).toBe('40.0%')
    expect(formatPercent(0.125)).toBe('12.5%')
    expect(formatPercent(null)).toBe('—')
    expect(formatPercent(Number.NaN)).toBe('—')
  })

  it('formatVnd: chứa ₫ và đúng chữ số; không hợp lệ ⇒ 0', () => {
    const s = formatVnd(1_200_000)
    expect(s).toContain('₫')
    expect(s.replace(/\D/g, '')).toBe('1200000')
    expect(formatVnd(Number.NaN).replace(/\D/g, '')).toBe('0')
  })

  it('formatWeekLabel / formatDateUtc theo UTC', () => {
    const d = new Date('2026-05-11T00:00:00.000Z')
    expect(formatWeekLabel(d)).toBe('11/05')
    expect(formatDateUtc(d)).toBe('11/05/2026')
  })
})
