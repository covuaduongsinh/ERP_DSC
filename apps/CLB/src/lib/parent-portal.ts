import 'server-only'
import { redirect } from 'next/navigation'
import type {
  Attendance,
  Class,
  Enrollment,
  Parent,
  Payment,
  ProgressReport,
  Student,
  TuitionCycle,
} from '@/payload-types'
import { getCurrentParent } from './parent-auth'
import { getPayloadClient } from './payload'

/** User object cho Payload Local API — access control đọc `collection: 'parents'`. */
export function toParentPayloadUser(parent: Parent): Parent {
  return { ...parent, collection: 'parents' }
}

export async function requireAuthenticatedParent(): Promise<{
  parent: Parent
  parentUser: Parent
}> {
  const parent = await getCurrentParent()
  if (!parent) {
    redirect('/cong-phu-huynh/dang-nhap')
  }
  return { parent, parentUser: toParentPayloadUser(parent) }
}

export async function fetchParentStudents(parentUser: Parent): Promise<Student[]> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'students',
    user: parentUser,
    // BẮT BUỘC: Local API mặc định overrideAccess=true (bỏ qua access
    // control). Phải đặt false để readStudentForParent thực sự lọc theo
    // parent.children — nếu không, phụ huynh A thấy học viên của phụ huynh B.
    overrideAccess: false,
    // Chỉ lấy field cần hiển thị; loại field nội bộ `note` (chỉ nhân viên).
    select: { note: false },
    depth: 2,
    limit: 20,
    sort: 'fullName',
  })
  return result.docs
}

export async function fetchStudentById(
  parentUser: Parent,
  studentId: number,
): Promise<Student | null> {
  const payload = await getPayloadClient()
  try {
    return await payload.findByID({
      collection: 'students',
      id: studentId,
      user: parentUser,
      // Bắt buộc — xem ghi chú ở fetchParentStudents. Nếu studentId không
      // thuộc con của phụ huynh này, access control làm findByID throw →
      // bắt ở catch → trả null → page gọi notFound().
      overrideAccess: false,
      select: { note: false },
      depth: 2,
    })
  } catch {
    return null
  }
}

export async function fetchActiveTuitionCycles(parentUser: Parent): Promise<TuitionCycle[]> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'tuition-cycles',
    user: parentUser,
    overrideAccess: false,
    where: {
      status: { in: ['dang_hoc', 'sap_het'] },
    },
    sort: '-startDate',
    limit: 50,
    depth: 0,
  })
  return result.docs
}

/** Tên lớp đang học của một enrollment (depth≥1 để class populate). */
function enrollmentClassTitle(enrollment: Enrollment): string | null {
  const cls = enrollment.class
  if (!cls || typeof cls === 'number') return null
  return (cls as Class).title
}

/**
 * Ghi danh đang học của phụ huynh (dangHoc=true). Thay cho field `class` cũ
 * trên Students. overrideAccess:false để chỉ trả bản ghi con mình.
 */
export async function fetchActiveEnrollments(parentUser: Parent): Promise<Enrollment[]> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'enrollments',
    user: parentUser,
    overrideAccess: false,
    where: { dangHoc: { equals: true } },
    sort: '-ngayBatDau',
    limit: 50,
    depth: 1,
  })
  return result.docs
}

/** Map studentId → tên lớp đang học (ưu tiên enrollment mới nhất). */
export function mapClassTitleByStudent(enrollments: Enrollment[]): Map<number, string> {
  const map = new Map<number, string>()
  for (const enrollment of enrollments) {
    const studentId =
      typeof enrollment.student === 'number' ? enrollment.student : enrollment.student.id
    const title = enrollmentClassTitle(enrollment)
    if (title && !map.has(studentId)) {
      map.set(studentId, title)
    }
  }
  return map
}

/** Map studentId → chu kỳ học phí đang hoạt động (ưu tiên mới nhất). */
export function mapTuitionByStudent(cycles: TuitionCycle[]): Map<number, TuitionCycle> {
  const map = new Map<number, TuitionCycle>()
  for (const cycle of cycles) {
    const studentId = typeof cycle.student === 'number' ? cycle.student : cycle.student.id
    if (!map.has(studentId)) {
      map.set(studentId, cycle)
    }
  }
  return map
}

// Phép tính thuần về chu kỳ học phí đã chuyển sang `./tuition` (không
// `server-only`) để tái dùng + unit-test. Re-export để các importer cũ
// (`@/lib/parent-portal`) không phải đổi.
export {
  sessionsRemaining,
  isTuitionLow,
  getTuitionWarningMessage,
  TUITION_LOW_THRESHOLD,
} from './tuition'

export async function fetchPendingRenewalStudentIds(parentUser: Parent): Promise<Set<number>> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'renewal-requests',
    user: parentUser,
    overrideAccess: false,
    where: {
      status: { in: ['moi', 'dang_xu_ly'] },
    },
    limit: 50,
    depth: 0,
  })

  const ids = new Set<number>()
  for (const doc of result.docs) {
    const studentId = typeof doc.student === 'number' ? doc.student : doc.student.id
    ids.add(studentId)
  }
  return ids
}

/**
 * Lịch sử nộp tiền của MỘT học viên cho cổng phụ huynh.
 *
 * 🔒 FIREWALL HỌC PHÍ: `overrideAccess:false` để Payments.read
 * (`readByStudentRelation`) lọc DB-level theo con của phụ huynh — phụ huynh A
 * KHÔNG bao giờ thấy payment con phụ huynh B (kể cả truyền studentId lạ: access
 * thêm điều kiện `student ∈ children` ⇒ trả rỗng). Field nhạy cảm (coSo,
 * tinhTrang, ghiChu, hp1Buoi, soBuoiNop, tuitionCycle, anhBill) bị field-level
 * `staffOnlyFieldRead` loại khỏi kết quả — phụ huynh chỉ thấy `code`, `ngayNop`,
 * và các khoản tiền tổng (hocPhi/tienSach/muaKhac).
 */
export async function fetchStudentPayments(
  parentUser: Parent,
  studentId: number,
): Promise<Payment[]> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'payments',
    user: parentUser,
    overrideAccess: false,
    where: { student: { equals: studentId } },
    sort: '-ngayNop',
    limit: 50,
    depth: 0,
  })
  return result.docs
}

export async function fetchStudentProgress(
  parentUser: Parent,
  studentId: number,
): Promise<{
  reports: ProgressReport[]
  attendance: Attendance[]
  tuition: TuitionCycle | null
  classTitle: string | null
}> {
  const payload = await getPayloadClient()

  const [reportsResult, attendanceResult, tuitionResult, enrollmentResult] = await Promise.all([
    payload.find({
      collection: 'progress-reports',
      user: parentUser,
      // overrideAccess:false → access control vừa lọc student∈children vừa
      // ép publishedAt!=null (báo cáo nháp không lọt ra cổng).
      overrideAccess: false,
      where: { student: { equals: studentId } },
      sort: '-publishedAt',
      limit: 24,
      depth: 1,
    }),
    payload.find({
      collection: 'attendance',
      user: parentUser,
      overrideAccess: false,
      where: { student: { equals: studentId } },
      sort: '-date',
      limit: 30,
      depth: 0,
    }),
    payload.find({
      collection: 'tuition-cycles',
      user: parentUser,
      overrideAccess: false,
      where: {
        and: [
          { student: { equals: studentId } },
          { status: { in: ['dang_hoc', 'sap_het', 'da_het'] } },
        ],
      },
      sort: '-startDate',
      limit: 1,
      depth: 0,
    }),
    payload.find({
      collection: 'enrollments',
      user: parentUser,
      overrideAccess: false,
      where: {
        and: [{ student: { equals: studentId } }, { dangHoc: { equals: true } }],
      },
      sort: '-ngayBatDau',
      limit: 1,
      depth: 1,
    }),
  ])

  const enrollment = enrollmentResult.docs[0]

  return {
    reports: reportsResult.docs,
    attendance: attendanceResult.docs,
    tuition: tuitionResult.docs[0] ?? null,
    classTitle: enrollment ? enrollmentClassTitle(enrollment) : null,
  }
}

export function resolveStudentIdParam(raw: string): number | null {
  const id = Number.parseInt(raw, 10)
  if (!Number.isFinite(id) || id <= 0) return null
  return id
}
