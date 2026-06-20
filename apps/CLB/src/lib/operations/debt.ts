import 'server-only'
import type { Payload } from 'payload'
import type { Payment, User } from '@/payload-types'
import { loadSessionBalances } from './session-balance'

/**
 * Đọc "CÔNG NỢ HỌC PHÍ" cho màn vận hành /cong-no.
 *
 * Trung tâm thu theo GÓI BUỔI TRẢ TRƯỚC nên "nợ" gồm 2 nhóm:
 *  (a) Học viên SẮP HẾT buổi tồn (cần nhắc đóng tiếp). Lấy từ `loadSessionBalances`
 *      (cấp HV, tính từ Payments+Attendance — KHÔNG dùng TuitionCycles vốn rỗng)
 *      và lọc cờ `low` (0 ≤ tồn ≤ ngưỡng). HV có tồn ÂM / thiếu phiếu thu KHÔNG
 *      vào đây (đó là việc đối soát, xem màn /so-buoi-ton), tránh nhắc nhầm.
 *  (b) Phiếu thu trạng thái "Chờ" (`tinhTrang='cho'`) — tiền chưa thu đủ.
 *
 * PHẠM VI: đọc với `overrideAccess:false` ⇒ access control collection là hàng rào
 * (branch-scope HV theo cơ sở giữ trong `loadSessionBalances`).
 */

export interface DebtStudentRow {
  studentId: number
  studentName: string
  location: string | null
  /** Số buổi tồn còn lại (cửa sổ hiện tại). */
  balance: number
}

export interface PendingPaymentRow {
  paymentId: number
  studentName: string
  ngayNop: string | null
  hocPhi: number | null
  tienSach: number | null
  muaKhac: number | null
  coSo: Payment['coSo'] | null
}

export interface TuitionDebt {
  lowStudents: DebtStudentRow[]
  pendingPayments: PendingPaymentRow[]
}

function studentName(value: unknown): string {
  if (value && typeof value === 'object') {
    const s = value as { fullName?: string }
    return s.fullName?.trim() || '—'
  }
  if (typeof value === 'number') return `#${value}`
  return '—'
}

export async function loadTuitionDebt(payload: Payload, user: User): Promise<TuitionDebt> {
  // (a) HV sắp hết buổi tồn — đã sắp xếp tồn tăng dần trong loadSessionBalances.
  const balances = await loadSessionBalances(payload, user)
  const lowStudents: DebtStudentRow[] = balances
    .filter((r) => r.flag === 'low')
    .map((r) => ({
      studentId: r.studentId,
      studentName: r.studentName,
      location: r.location,
      balance: r.balance ?? 0,
    }))

  // (b) phiếu thu trạng thái "Chờ".
  const { docs: payDocs } = await payload.find({
    collection: 'payments',
    where: { tinhTrang: { equals: 'cho' } },
    user,
    overrideAccess: false,
    disableErrors: true,
    depth: 1,
    pagination: false,
    limit: 0,
    sort: '-ngayNop',
  })
  const pendingPayments: PendingPaymentRow[] = (payDocs as Payment[]).map((p) => ({
    paymentId: p.id,
    studentName: studentName(p.student),
    ngayNop: p.ngayNop ?? null,
    hocPhi: p.hocPhi ?? null,
    tienSach: p.tienSach ?? null,
    muaKhac: p.muaKhac ?? null,
    coSo: p.coSo ?? null,
  }))

  return { lowStudents, pendingPayments }
}
