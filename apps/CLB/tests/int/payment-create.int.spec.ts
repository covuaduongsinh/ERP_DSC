import { describe, it, expect } from 'vitest'
import { validatePaymentInput, hasPositivePaymentAmount } from '@/lib/payments/create'

/**
 * Unit test THUẦN cho validate form Nhập học phí — mã hóa quy tắc hợp lệ
 * (bắt buộc học viên + ngày + ít nhất 1 khoản tiền > 0; cơ sở/tình trạng enum).
 */

const base = { student: 5, ngayNop: '2026-06-02', hocPhi: 1_200_000 } as const

describe('validatePaymentInput', () => {
  it('hợp lệ tối thiểu (student + ngày + học phí) ⇒ ok, mặc định tinhTrang=da_nop', () => {
    const r = validatePaymentInput({ ...base })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.student).toBe(5)
      expect(r.data.ngayNop).toBe('2026-06-02')
      expect(r.data.hocPhi).toBe(1_200_000)
      expect(r.data.tinhTrang).toBe('da_nop')
      expect('coSo' in r.data).toBe(false)
    }
  })

  it('chưa chọn học viên (0/âm/không nguyên) ⇒ lỗi', () => {
    expect(validatePaymentInput({ ...base, student: 0 }).ok).toBe(false)
    expect(validatePaymentInput({ ...base, student: -1 }).ok).toBe(false)
    expect(validatePaymentInput({ ...base, student: 1.5 }).ok).toBe(false)
  })

  it('ngày trống/không hợp lệ ⇒ lỗi', () => {
    expect(validatePaymentInput({ ...base, ngayNop: '' }).ok).toBe(false)
    expect(validatePaymentInput({ ...base, ngayNop: 'không-phải-ngày' }).ok).toBe(false)
  })

  it('không có khoản tiền > 0 ⇒ lỗi (chống phiếu rỗng)', () => {
    const r = validatePaymentInput({ student: 5, ngayNop: '2026-06-02' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/ít nhất một khoản tiền/)
    // soBuoiNop > 0 nhưng không có tiền ⇒ vẫn lỗi
    expect(validatePaymentInput({ student: 5, ngayNop: '2026-06-02', soBuoiNop: 10 }).ok).toBe(
      false,
    )
  })

  it('số tiền âm ⇒ lỗi', () => {
    expect(validatePaymentInput({ ...base, tienSach: -1 }).ok).toBe(false)
  })

  it('tiền sách/mua khác cũng tính là khoản tiền hợp lệ', () => {
    expect(validatePaymentInput({ student: 5, ngayNop: '2026-06-02', tienSach: 200_000 }).ok).toBe(
      true,
    )
    expect(validatePaymentInput({ student: 5, ngayNop: '2026-06-02', muaKhac: 50_000 }).ok).toBe(
      true,
    )
  })

  it('coSo: rỗng bỏ qua; hợp lệ giữ; sai ⇒ lỗi', () => {
    const empty = validatePaymentInput({ ...base, coSo: '' })
    expect(empty.ok).toBe(true)
    const kl = validatePaymentInput({ ...base, coSo: 'kim_lien' })
    expect(kl.ok && kl.data.coSo).toBe('kim_lien')
    // @ts-expect-error giá trị ngoài enum để test nhánh lỗi
    expect(validatePaymentInput({ ...base, coSo: 'sai' }).ok).toBe(false)
  })

  it('tinhTrang cho được giữ; soBuoiNop + ghiChu đưa vào data', () => {
    const r = validatePaymentInput({
      ...base,
      tinhTrang: 'cho',
      soBuoiNop: 20,
      ghiChu: '  CK Vietcombank  ',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.tinhTrang).toBe('cho')
      expect(r.data.soBuoiNop).toBe(20)
      expect(r.data.ghiChu).toBe('CK Vietcombank')
    }
  })
})

/**
 * Helper dùng chung cho hook `beforeValidate` của collection Payments (chặn nhập
 * tay rỗng ở /admin). Phải đồng bộ với quy tắc của validatePaymentInput.
 */
describe('hasPositivePaymentAmount', () => {
  it('có ít nhất một khoản > 0 ⇒ true', () => {
    expect(hasPositivePaymentAmount({ hocPhi: 1 })).toBe(true)
    expect(hasPositivePaymentAmount({ tienSach: 200_000 })).toBe(true)
    expect(hasPositivePaymentAmount({ muaKhac: 50_000 })).toBe(true)
    expect(hasPositivePaymentAmount({ hocPhi: 0, tienSach: 0, muaKhac: 10 })).toBe(true)
  })

  it('tất cả 0/trống/null/âm/NaN ⇒ false (phiếu rỗng)', () => {
    expect(hasPositivePaymentAmount({})).toBe(false)
    expect(hasPositivePaymentAmount({ hocPhi: 0, tienSach: 0, muaKhac: 0 })).toBe(false)
    expect(hasPositivePaymentAmount({ hocPhi: null, tienSach: undefined })).toBe(false)
    expect(hasPositivePaymentAmount({ hocPhi: -5 })).toBe(false)
    expect(hasPositivePaymentAmount({ hocPhi: Number.NaN })).toBe(false)
  })
})
