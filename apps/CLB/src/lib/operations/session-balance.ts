import 'server-only'
import type { Payload } from 'payload'
import type { Student, User } from '@/payload-types'
import { TUITION_LOW_THRESHOLD } from '../tuition'

/**
 * "SỐ BUỔI TỒN" cấp HỌC VIÊN — đối soát đã nộp ↔ đã học.
 *
 * Vì sao KHÔNG dùng TuitionCycles: collection đó gần như rỗng ở prod (1 bản ghi)
 * — luồng tạo chu kỳ chỉ chạy khi duyệt gia hạn, còn nhập phiếu thu KHÔNG sinh
 * chu kỳ. Dữ liệu thật nằm ở `Payments.soBuoiNop` (số buổi đã nộp) và
 * `Attendance.status='co_mat'` (số buổi đã học). Hàm này gom 2 nguồn đó theo
 * học viên và tính số buổi tồn.
 *
 * Mô hình anchor (xem `computeBalance`):
 *  - `opening`      : HV đã CHỐT số dư đầu kỳ (Students.soBuoiTonDauKy + ngayChotSoDu)
 *                     ⇒ tồn = số dư đầu + buổi nộp sau − buổi học sau ngày chốt.
 *  - `last_payment` : mặc định — tồn = buổi của lần nộp gần nhất − buổi học kể từ
 *                     ngày đó (≥). Phản ánh "kỳ hiện tại = từ lần nộp gần nhất".
 *  - `none`         : chưa có phiếu thu & chưa chốt số dư ⇒ không tính được (cờ).
 *
 * Luôn kèm "đối soát toàn bộ lịch sử" (lifetimePaid/Attended/Balance) để soi &
 * bổ sung phiếu thu thiếu. Số học THUẦN tách ở `computeBalance` (unit-test được).
 *
 * BẢO MẬT: mọi truy vấn `overrideAccess:false` + `user` ⇒ access control collection
 * là hàng rào (gồm branch-scope HV theo cơ sở — chỉ emit HV trong tập đọc được).
 */

export type SessionBalanceMode = 'opening' | 'last_payment' | 'none'

/**
 * Cờ trạng thái (ưu tiên trên xuống):
 *  - `none`     : thiếu phiếu thu / chưa chốt số dư → cần nhập liệu (đối soát).
 *  - `negative` : đã học vượt số nộp (tồn < 0) → cần soát/bổ sung phiếu thu.
 *  - `low`      : 0 ≤ tồn ≤ ngưỡng → cần nhắc gia hạn.
 *  - `ok`       : tồn > ngưỡng.
 */
export type SessionBalanceFlag = 'none' | 'negative' | 'low' | 'ok'

export interface SessionBalanceComputeInput {
  openingBalance?: number | null
  openingDate?: string | Date | null
  /** Phiếu thu `da_nop` của HV (chỉ cần ngày nộp + số buổi nộp). */
  payments: { ngayNop: string | Date | null | undefined; soBuoiNop: number | null | undefined }[]
  /** Ngày các buổi điểm danh `co_mat` của HV. */
  attendanceDates: (string | Date | null | undefined)[]
}

export interface SessionBalanceComputeResult {
  mode: SessionBalanceMode
  /** Ngày mốc (UTC, 'YYYY-MM-DD') hoặc null nếu mode='none'. */
  anchorDate: string | null
  /** Tín dụng buổi trong cửa sổ hiện tại (gồm số dư đầu nếu mode='opening'). */
  paid: number
  /** Buổi đã học trong cửa sổ hiện tại. */
  attended: number
  /** Số buổi tồn = paid − attended; null nếu mode='none'. */
  balance: number | null
  lifetimePaid: number
  lifetimeAttended: number
  lifetimeBalance: number
  flag: SessionBalanceFlag
}

/** Một dòng phiếu thu trong bảng đối soát chi tiết. */
export interface PaymentDetail {
  ngayNop: string | null
  soBuoiNop: number
  /** Có được tính vào cửa sổ hiện tại (theo anchor/mode) hay không. */
  counted: boolean
}

export interface SessionBalanceRow extends SessionBalanceComputeResult {
  studentId: number
  studentName: string
  location: string | null
  /** Phiếu thu `da_nop` của HV (sort ngày giảm dần) — cho mở rộng đối soát. */
  payments: PaymentDetail[]
  openingBalance: number | null
  openingDate: string | null
}

/** Mốc ngày theo UTC dạng 'YYYY-MM-DD' (so sánh chuỗi = so sánh thời gian). */
function utcDayKey(value: string | Date | null | undefined): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

/** Số buổi hợp lệ (≥ 0); null/NaN/âm ⇒ 0. */
function normSessions(v: number | null | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0
}

/**
 * Một phiếu thu CÓ được tính vào cửa sổ hiện tại không (THUẦN, unit-test):
 *  - `last_payment` : ngày nộp == anchor (lần nộp gần nhất).
 *  - `opening`      : ngày nộp > anchor (sau ngày chốt số dư).
 *  - `none`         : không tính.
 * Đồng bộ ĐÚNG cửa sổ của `computeBalance` để list & detail không lệch nhau.
 */
export function isPaymentCounted(
  ngayNop: string | Date | null | undefined,
  mode: SessionBalanceMode,
  anchorDate: string | null,
): boolean {
  if (anchorDate === null) return false
  const k = utcDayKey(ngayNop)
  if (k === null) return false
  if (mode === 'last_payment') return k === anchorDate
  if (mode === 'opening') return k > anchorDate
  return false
}

/** Dựng danh sách phiếu thu (đánh dấu counted) từ dữ liệu thô + kết quả tính. */
function buildPaymentDetails(
  raw: {
    ngayNop: string | Date | null | undefined
    soBuoiNop: number | null | undefined
  }[],
  result: SessionBalanceComputeResult,
): PaymentDetail[] {
  return raw
    .map((p) => ({
      ngayNop:
        typeof p.ngayNop === 'string'
          ? p.ngayNop
          : p.ngayNop
            ? new Date(p.ngayNop).toISOString()
            : null,
      soBuoiNop: normSessions(p.soBuoiNop),
      counted: isPaymentCounted(p.ngayNop, result.mode, result.anchorDate),
    }))
    .sort((a, b) => String(b.ngayNop ?? '').localeCompare(String(a.ngayNop ?? '')))
}

/**
 * Tính số buổi tồn THUẦN theo mô hình anchor (KHÔNG I/O). Tách ra để unit-test
 * mọi ca biên (opening / last_payment / none; tồn 0, ngưỡng, âm).
 */
export function computeBalance(input: SessionBalanceComputeInput): SessionBalanceComputeResult {
  const lifetimePaid = input.payments.reduce((s, p) => s + normSessions(p.soBuoiNop), 0)
  const lifetimeAttended = input.attendanceDates.reduce((n, d) => (utcDayKey(d) ? n + 1 : n), 0)
  const lifetimeBalance = lifetimePaid - lifetimeAttended

  const openingDay = utcDayKey(input.openingDate)
  const hasOpening =
    typeof input.openingBalance === 'number' &&
    Number.isFinite(input.openingBalance) &&
    openingDay !== null

  let mode: SessionBalanceMode
  let anchorDate: string | null
  let paid: number
  let attended: number
  let balance: number | null

  if (hasOpening) {
    // CHỐT SỐ DƯ: số dư đầu (đến HẾT ngày chốt) + nộp sau − học sau.
    const anchor = openingDay as string
    mode = 'opening'
    anchorDate = anchor
    const paidAfter = input.payments.reduce((s, p) => {
      const k = utcDayKey(p.ngayNop)
      return k !== null && k > anchor ? s + normSessions(p.soBuoiNop) : s
    }, 0)
    const attendedAfter = input.attendanceDates.reduce((n, d) => {
      const k = utcDayKey(d)
      return k !== null && k > anchor ? n + 1 : n
    }, 0)
    paid = (input.openingBalance as number) + paidAfter
    attended = attendedAfter
    balance = paid - attended
  } else {
    // LẦN NỘP GẦN NHẤT: anchor = ngày nộp mới nhất; học kể từ ngày đó (≥).
    let lastDay: string | null = null
    for (const p of input.payments) {
      const k = utcDayKey(p.ngayNop)
      if (k !== null && (lastDay === null || k > lastDay)) lastDay = k
    }
    if (lastDay !== null) {
      const anchor = lastDay
      mode = 'last_payment'
      anchorDate = anchor
      const lastPaySessions = input.payments.reduce((s, p) => {
        const k = utcDayKey(p.ngayNop)
        return k === anchor ? s + normSessions(p.soBuoiNop) : s
      }, 0)
      const attendedSince = input.attendanceDates.reduce((n, d) => {
        const k = utcDayKey(d)
        return k !== null && k >= anchor ? n + 1 : n
      }, 0)
      paid = lastPaySessions
      attended = attendedSince
      balance = paid - attended
    } else {
      // Không phiếu thu & không số dư ⇒ không tính được.
      mode = 'none'
      anchorDate = null
      paid = 0
      attended = lifetimeAttended
      balance = null
    }
  }

  const flag: SessionBalanceFlag =
    balance === null
      ? 'none'
      : balance < 0
        ? 'negative'
        : balance <= TUITION_LOW_THRESHOLD
          ? 'low'
          : 'ok'

  return {
    mode,
    anchorDate,
    paid,
    attended,
    balance,
    lifetimePaid,
    lifetimeAttended,
    lifetimeBalance,
    flag,
  }
}

/** Khóa sắp xếp: tồn tăng dần; 'none' (null) xuống cuối. */
function balanceSortKey(row: SessionBalanceComputeResult): number {
  return row.balance === null ? Number.POSITIVE_INFINITY : row.balance
}

function resolveLocationName(value: unknown): string | null {
  if (value && typeof value === 'object') {
    const v = value as { name?: unknown }
    return typeof v.name === 'string' ? v.name : null
  }
  return null
}

function resolveStudentId(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id
    return typeof id === 'number' ? id : null
  }
  return null
}

/**
 * Nạp số buổi tồn của TẤT CẢ học viên đang học (gom Payments + Attendance theo
 * HV trong bộ nhớ — tránh N+1). Mặc định sắp xếp tồn tăng dần (ít nhất lên đầu).
 */
export async function loadSessionBalances(
  payload: Payload,
  user: User,
): Promise<SessionBalanceRow[]> {
  const common = {
    user,
    overrideAccess: false,
    disableErrors: true,
    pagination: false as const,
    limit: 0,
  }

  const [studentsRes, paymentsRes, attendanceRes] = await Promise.all([
    payload.find({
      collection: 'students',
      where: { enrollmentStatus: { equals: 'dang_hoc' } },
      depth: 1, // populate location (useAsTitle: name)
      ...common,
    }),
    payload.find({
      collection: 'payments',
      where: { tinhTrang: { equals: 'da_nop' } },
      depth: 0,
      select: { student: true, ngayNop: true, soBuoiNop: true },
      ...common,
    }),
    payload.find({
      collection: 'attendance',
      where: { status: { equals: 'co_mat' } },
      depth: 0,
      select: { student: true, date: true },
      ...common,
    }),
  ])

  const paymentsByStudent = new Map<
    number,
    { ngayNop: string | null | undefined; soBuoiNop: number | null | undefined }[]
  >()
  for (const p of paymentsRes.docs) {
    const sid = resolveStudentId(p.student)
    if (sid === null) continue
    const arr = paymentsByStudent.get(sid) ?? []
    arr.push({ ngayNop: p.ngayNop, soBuoiNop: p.soBuoiNop })
    paymentsByStudent.set(sid, arr)
  }

  const attendanceByStudent = new Map<number, (string | null | undefined)[]>()
  for (const a of attendanceRes.docs) {
    const sid = resolveStudentId(a.student)
    if (sid === null) continue
    const arr = attendanceByStudent.get(sid) ?? []
    arr.push(a.date)
    attendanceByStudent.set(sid, arr)
  }

  const rows: SessionBalanceRow[] = studentsRes.docs.map((s) => {
    const sPayments = paymentsByStudent.get(s.id) ?? []
    const result = computeBalance({
      openingBalance: s.soBuoiTonDauKy ?? null,
      openingDate: s.ngayChotSoDu ?? null,
      payments: sPayments,
      attendanceDates: attendanceByStudent.get(s.id) ?? [],
    })
    return {
      studentId: s.id,
      studentName: s.fullName?.trim() || `#${s.id}`,
      location: resolveLocationName(s.location),
      payments: buildPaymentDetails(sPayments, result),
      openingBalance: s.soBuoiTonDauKy ?? null,
      openingDate: s.ngayChotSoDu ?? null,
      ...result,
    }
  })

  rows.sort((a, b) => balanceSortKey(a) - balanceSortKey(b))
  return rows
}

/** Đối soát CHI TIẾT 1 học viên (cho trang `/admin/so-buoi-ton?student=<id>`). */
export interface StudentSessionBreakdown {
  studentId: number
  studentName: string
  location: string | null
  result: SessionBalanceComputeResult
  /** Phiếu thu `da_nop` (đánh dấu counted), sort ngày giảm dần. */
  payments: PaymentDetail[]
  openingBalance: number | null
  openingDate: string | null
  /** Ngày các buổi `co_mat` ĐƯỢC TÍNH (kể từ anchor), sort giảm dần. */
  attendedSinceDates: string[]
}

/**
 * Nạp đối soát chi tiết của MỘT học viên: phiếu thu + danh sách buổi học trong
 * cửa sổ + công thức. `findByID overrideAccess:false` ⇒ branch-scope chặn xem
 * chéo cơ sở (HV ngoài quyền ⇒ trả null). `attendedSinceDates.length` khớp đúng
 * `result.attended` (cùng quy ước cửa sổ với `computeBalance`).
 */
export async function loadStudentSessionBreakdown(
  payload: Payload,
  user: User,
  studentId: number,
): Promise<StudentSessionBreakdown | null> {
  const common = { user, overrideAccess: false, disableErrors: true } as const

  let student: Student | null = null
  try {
    student = (await payload.findByID({
      collection: 'students',
      id: studentId,
      depth: 1,
      ...common,
    })) as Student
  } catch {
    return null
  }
  if (!student) return null

  const [paymentsRes, attendanceRes] = await Promise.all([
    payload.find({
      collection: 'payments',
      where: {
        and: [{ student: { equals: studentId } }, { tinhTrang: { equals: 'da_nop' } }],
      },
      depth: 0,
      pagination: false,
      limit: 0,
      select: { student: true, ngayNop: true, soBuoiNop: true },
      ...common,
    }),
    payload.find({
      collection: 'attendance',
      where: {
        and: [{ student: { equals: studentId } }, { status: { equals: 'co_mat' } }],
      },
      depth: 0,
      pagination: false,
      limit: 0,
      select: { student: true, date: true },
      ...common,
    }),
  ])

  const rawPayments = paymentsRes.docs.map((p) => ({
    ngayNop: p.ngayNop,
    soBuoiNop: p.soBuoiNop,
  }))
  const attendanceDates = attendanceRes.docs.map((a) => a.date)

  const result = computeBalance({
    openingBalance: student.soBuoiTonDauKy ?? null,
    openingDate: student.ngayChotSoDu ?? null,
    payments: rawPayments,
    attendanceDates,
  })

  // Buổi học ĐƯỢC TÍNH — cùng cửa sổ với computeBalance (none ⇒ toàn bộ).
  const anchor = result.anchorDate
  const inWindow = (d: string | null | undefined): boolean => {
    const k = utcDayKey(d)
    if (k === null) return false
    if (anchor === null) return true
    return result.mode === 'opening' ? k > anchor : k >= anchor
  }
  const attendedSinceDates = attendanceDates
    .filter((d) => inWindow(d))
    .map((d) => (typeof d === 'string' ? d : new Date(d).toISOString()))
    .sort((a, b) => b.localeCompare(a))

  return {
    studentId: student.id,
    studentName: student.fullName?.trim() || `#${student.id}`,
    location: resolveLocationName(student.location),
    result,
    payments: buildPaymentDetails(rawPayments, result),
    openingBalance: student.soBuoiTonDauKy ?? null,
    openingDate: student.ngayChotSoDu ?? null,
    attendedSinceDates,
  }
}
