import type { Payload } from 'payload'
import type { User } from '@/payload-types'

/**
 * Tạo bản ghi THU học phí (`payments`) từ form nhập trên web — lớp lõi.
 *
 * Tách `validatePaymentInput` (THUẦN, unit-test được) khỏi `createPaymentRecord`
 * (I/O). Module KHÔNG `import 'server-only'` để test trực tiếp phần thuần.
 *
 * Bảo mật: `createPaymentRecord` ghi qua Payload Local API với `user = actor` +
 * `overrideAccess: false` ⇒ access control của collection `payments`
 * (create = staffOnly) là hàng rào DB-level; danh tính lấy từ phiên server, KHÔNG
 * nhận role từ client. Hook audit của Payments tự ghi nhật ký.
 */

export type CoSo = 'kim_lien' | 'vinh_phuc'
export type TinhTrang = 'da_nop' | 'cho'

export interface CreatePaymentInput {
  student: number
  ngayNop: string // YYYY-MM-DD
  hocPhi?: number | null
  tienSach?: number | null
  muaKhac?: number | null
  soBuoiNop?: number | null
  coSo?: CoSo | ''
  tinhTrang?: TinhTrang
  ghiChu?: string
}

export type CreatePaymentResult =
  | { ok: true; paymentId: number }
  | { ok: false; error: 'forbidden' | 'validation'; message: string }

/** Dữ liệu đã làm sạch, sẵn sàng ghi vào `payments`. */
export interface CleanPaymentData {
  student: number
  ngayNop: string
  hocPhi?: number
  tienSach?: number
  muaKhac?: number
  soBuoiNop?: number
  coSo?: CoSo
  tinhTrang: TinhTrang
  ghiChu?: string
}

const CO_SO_VALUES: CoSo[] = ['kim_lien', 'vinh_phuc']
const TINH_TRANG_VALUES: TinhTrang[] = ['da_nop', 'cho']

/**
 * Phiếu thu hợp lệ phải có ÍT NHẤT một khoản > 0 (học phí | tiền sách | mua khác).
 * THUẦN — dùng chung cho `validatePaymentInput` (đường form/Server Action) lẫn hook
 * `beforeValidate` của collection `payments` (chặn nhập tay rỗng ở /admin).
 */
export function hasPositivePaymentAmount(input: {
  hocPhi?: number | null
  tienSach?: number | null
  muaKhac?: number | null
}): boolean {
  return [input.hocPhi, input.tienSach, input.muaKhac].some(
    (v) => typeof v === 'number' && Number.isFinite(v) && v > 0,
  )
}

/** Số tiền/buổi không âm hữu hạn; trống → undefined; sai → null (lỗi). */
function normAmount(v: number | null | undefined): number | null | undefined {
  if (v === null || v === undefined) return undefined
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  if (v < 0) return null
  return v
}

/**
 * Kiểm hợp lệ input form THU (THUẦN). Quy tắc:
 *  - `student` là số nguyên dương (bắt buộc).
 *  - `ngayNop` parse được thành ngày (bắt buộc) ⇒ chuẩn hóa YYYY-MM-DD.
 *  - các số tiền/buổi nếu có phải ≥ 0.
 *  - PHẢI có ít nhất một khoản tiền > 0 (học phí | tiền sách | mua khác) — tránh
 *    ghi phiếu thu rỗng.
 */
export function validatePaymentInput(
  input: CreatePaymentInput,
): { ok: true; data: CleanPaymentData } | { ok: false; message: string } {
  if (!Number.isInteger(input.student) || input.student <= 0) {
    return { ok: false, message: 'Chưa chọn học viên.' }
  }

  const rawDate = (input.ngayNop ?? '').trim()
  const d = rawDate ? new Date(rawDate) : null
  if (!d || Number.isNaN(d.getTime())) {
    return { ok: false, message: 'Ngày nộp trống hoặc không hợp lệ.' }
  }
  const ngayNop = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`

  // Kiểm tường minh từng khoản để TypeScript narrow null → number | undefined.
  const hocPhi = normAmount(input.hocPhi)
  if (hocPhi === null) return { ok: false, message: 'Học phí không phải số hợp lệ (≥ 0).' }
  const tienSach = normAmount(input.tienSach)
  if (tienSach === null) return { ok: false, message: 'Tiền sách không phải số hợp lệ (≥ 0).' }
  const muaKhac = normAmount(input.muaKhac)
  if (muaKhac === null) return { ok: false, message: 'Mua khác không phải số hợp lệ (≥ 0).' }
  const soBuoiNop = normAmount(input.soBuoiNop)
  if (soBuoiNop === null) return { ok: false, message: 'Số buổi nộp không phải số hợp lệ (≥ 0).' }

  if (!hasPositivePaymentAmount({ hocPhi, tienSach, muaKhac })) {
    return {
      ok: false,
      message: 'Phải nhập ít nhất một khoản tiền > 0 (học phí / tiền sách / mua khác).',
    }
  }

  let coSo: CoSo | undefined
  if (input.coSo) {
    if (!CO_SO_VALUES.includes(input.coSo as CoSo)) {
      return { ok: false, message: 'Cơ sở không hợp lệ.' }
    }
    coSo = input.coSo as CoSo
  }

  const tinhTrang: TinhTrang =
    input.tinhTrang && TINH_TRANG_VALUES.includes(input.tinhTrang) ? input.tinhTrang : 'da_nop'

  const data: CleanPaymentData = { student: input.student, ngayNop, tinhTrang }
  if (hocPhi !== undefined) data.hocPhi = hocPhi
  if (tienSach !== undefined) data.tienSach = tienSach
  if (muaKhac !== undefined) data.muaKhac = muaKhac
  if (soBuoiNop !== undefined) data.soBuoiNop = soBuoiNop
  if (coSo !== undefined) data.coSo = coSo
  const ghiChu = (input.ghiChu ?? '').trim()
  if (ghiChu) data.ghiChu = ghiChu

  return { ok: true, data }
}

/**
 * Tạo bản ghi `payments`. `actor` phải là nhân viên (collection `users`); ghi với
 * `overrideAccess: false` để collection access (staffOnly) là hàng rào.
 */
export async function createPaymentRecord(
  payload: Payload,
  actor: User | null,
  input: CreatePaymentInput,
): Promise<CreatePaymentResult> {
  if (!actor || (actor as { collection?: string }).collection !== 'users') {
    return { ok: false, error: 'forbidden', message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.' }
  }
  const validated = validatePaymentInput(input)
  if (!validated.ok) {
    return { ok: false, error: 'validation', message: validated.message }
  }
  try {
    const created = await payload.create({
      collection: 'payments',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: validated.data as any,
      user: actor,
      overrideAccess: false,
    })
    return { ok: true, paymentId: created.id as number }
  } catch (err) {
    return {
      ok: false,
      error: 'validation',
      message: err instanceof Error ? err.message : 'Lỗi không xác định khi ghi phiếu thu.',
    }
  }
}
