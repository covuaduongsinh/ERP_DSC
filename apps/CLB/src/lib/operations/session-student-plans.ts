import 'server-only'
import type { Payload } from 'payload'
import type { Student, User } from '@/payload-types'
import { toUtcDayStart } from './sessions'

/**
 * "KẾ HOẠCH BUỔI THEO TỪNG HỌC VIÊN" (V1.1) — nội dung cá nhân hóa cho 1 HV trong
 * 1 buổi, lưu ở collection `session-student-plans` (override; trống = kế thừa nội
 * dung cả lớp ở `class-sessions`). Hiển thị effective = `plan.field ?? session.field`.
 *
 * 🔒 RANH GIỚI TÍNH HỌC PHÍ: KHÔNG bao giờ chạm `attendance` → không sinh điểm
 * danh, không trừ buổi. Nguồn đếm buổi vẫn là `attendance(co_mat)` (giữ nguyên).
 *
 * BẢO MẬT: mọi đọc/ghi `overrideAccess:false + actor` ⇒ branch-scope của
 * `session-student-plans` (`student.location`) + `class-sessions` (`location`) là
 * hàng rào thật. Lookup idempotent theo `khoaKeHoach` (khóa cứng) dùng
 * overrideAccess:true — không leak chéo. `create` access không scope nên core
 * KIỂM buổi visible + HV thuộc roster trước khi ghi (defense-in-depth).
 */

export interface StudentPlanContent {
  mucTieu: string | null
  sachDangHoc: string | null
  kienThucMoi: string | null
  giaoBTVN: string | null
  khBuoiSau: string | null
}

const CONTENT_KEYS = ['mucTieu', 'sachDangHoc', 'kienThucMoi', 'giaoBTVN', 'khBuoiSau'] as const

export interface RosterForDateRow {
  studentId: number
  fullName: string
}

export interface StudentPlanRow {
  studentId: number
  fullName: string
  /** Giá trị ghi đè riêng HV (null = kế thừa cả lớp). */
  override: StudentPlanContent
  /** Hiển thị: override ?? nội dung cả lớp. */
  effective: StudentPlanContent
}

export type LoadSessionStudentPlansResult =
  | { ok: true; classContent: StudentPlanContent; rows: StudentPlanRow[]; note: string | null }
  | { ok: false; error: 'forbidden' | 'invalid_input' | 'server'; message: string }

export type PlanSimpleResult =
  | { ok: true }
  | { ok: false; error: 'forbidden' | 'invalid_input' | 'server'; message: string }

export type ApplyAllResult =
  | { ok: true; affected: number }
  | { ok: false; error: 'forbidden' | 'invalid_input' | 'server'; message: string }

function isStaff(actor: User | null): actor is User {
  return !!actor && (actor as { collection?: string }).collection === 'users'
}

function relId(v: unknown): number | null {
  if (typeof v === 'number') return v
  if (v && typeof v === 'object' && 'id' in v) {
    const id = (v as { id: unknown }).id
    return typeof id === 'number' ? id : null
  }
  return null
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null
}

function planKey(sessionId: number, studentId: number): string {
  return `${sessionId}|${studentId}`
}

function contentOf(doc: Record<string, unknown> | null | undefined): StudentPlanContent {
  return {
    mucTieu: strOrNull(doc?.mucTieu),
    sachDangHoc: strOrNull(doc?.sachDangHoc),
    kienThucMoi: strOrNull(doc?.kienThucMoi),
    giaoBTVN: strOrNull(doc?.giaoBTVN),
    khBuoiSau: strOrNull(doc?.khBuoiSau),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) ROSTER THEO NGÀY BUỔI — cửa sổ ngày + dung sai null
// ─────────────────────────────────────────────────────────────────────────────

/**
 * HV của lớp tính theo NGÀY buổi: hiện nếu `(ngayBatDau rỗng HOẶC ≤ ngày)` VÀ
 * `(dangHoc=true HOẶC ngayKetThuc rỗng HOẶC ≥ ngày)`. Xử lý vào/ra giữa kỳ; thiếu
 * ngày vẫn hiện. Branch-scope áp ở bước đọc students (mẫu `loadClassRoster`).
 */
export async function loadClassRosterForDate(
  payload: Payload,
  actor: User | null,
  classId: number,
  date: Date | string,
): Promise<RosterForDateRow[]> {
  if (!isStaff(actor)) return []
  if (!Number.isInteger(classId) || classId <= 0) return []

  const dayStart = toUtcDayStart(date)
  const dayEnd = new Date(dayStart)
  dayEnd.setUTCHours(23, 59, 59, 999)

  const { docs: enrollments } = await payload.find({
    collection: 'enrollments',
    where: {
      and: [
        { class: { equals: classId } },
        {
          or: [
            { ngayBatDau: { exists: false } },
            { ngayBatDau: { less_than_equal: dayEnd.toISOString() } },
          ],
        },
        {
          or: [
            { dangHoc: { equals: true } },
            { ngayKetThuc: { exists: false } },
            { ngayKetThuc: { greater_than_equal: dayStart.toISOString() } },
          ],
        },
      ],
    },
    user: actor,
    overrideAccess: false,
    disableErrors: true,
    depth: 0,
    pagination: false,
    limit: 0,
  })

  const studentIds = Array.from(
    new Set(
      enrollments
        .map((e) => relId((e as { student?: unknown }).student))
        .filter((id): id is number => id !== null),
    ),
  )
  if (studentIds.length === 0) return []

  // Branch-scope thật áp ở đây (students.read = withBranchScope).
  const { docs: studentDocs } = await payload.find({
    collection: 'students',
    where: { id: { in: studentIds } },
    user: actor,
    overrideAccess: false,
    disableErrors: true,
    depth: 0,
    pagination: false,
    limit: 0,
    sort: 'fullName',
  })

  return (studentDocs as Student[]).map((s) => ({ studentId: s.id, fullName: s.fullName }))
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) LOAD — roster + override + effective (kế thừa cả lớp)
// ─────────────────────────────────────────────────────────────────────────────

/** Đọc buổi branch-scoped → lấy lop/date + nội dung cả lớp. */
async function loadVisibleSession(
  payload: Payload,
  actor: User,
  sessionId: number,
): Promise<Record<string, unknown> | null> {
  const session = await payload.findByID({
    collection: 'class-sessions',
    id: sessionId,
    depth: 0,
    user: actor,
    overrideAccess: false,
    disableErrors: true,
  })
  return (session as unknown as Record<string, unknown>) ?? null
}

export async function loadSessionStudentPlans(
  payload: Payload,
  actor: User | null,
  sessionId: number,
): Promise<LoadSessionStudentPlansResult> {
  if (!isStaff(actor)) {
    return { ok: false, error: 'forbidden', message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.' }
  }
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return { ok: false, error: 'invalid_input', message: 'Buổi không hợp lệ.' }
  }

  try {
    const session = await loadVisibleSession(payload, actor, sessionId)
    if (!session) {
      return {
        ok: false,
        error: 'forbidden',
        message: 'Không tìm thấy buổi (hoặc ngoài phạm vi cơ sở).',
      }
    }
    const classContent = contentOf(session)
    const classId = relId(session.lop)
    if (classId === null) {
      return {
        ok: true,
        classContent,
        rows: [],
        note: 'Buổi không gắn lớp (buổi lịch sử) — không có danh sách học viên để lập kế hoạch.',
      }
    }

    const roster = await loadClassRosterForDate(payload, actor, classId, session.date as string)
    if (roster.length === 0) {
      return {
        ok: true,
        classContent,
        rows: [],
        note: 'Chưa có học viên ghi danh (đang hoạt động, cùng cơ sở) cho lớp tại ngày này.',
      }
    }

    const { docs: planDocs } = await payload.find({
      collection: 'session-student-plans',
      where: { session: { equals: sessionId } },
      user: actor,
      overrideAccess: false,
      disableErrors: true,
      depth: 0,
      pagination: false,
      limit: 0,
    })
    const byStudent = new Map<number, Record<string, unknown>>()
    for (const p of planDocs as unknown as Array<Record<string, unknown>>) {
      const sid = relId(p.student)
      if (sid !== null) byStudent.set(sid, p)
    }

    const rows: StudentPlanRow[] = roster.map((r) => {
      const override = contentOf(byStudent.get(r.studentId))
      const effective: StudentPlanContent = {
        mucTieu: override.mucTieu ?? classContent.mucTieu,
        sachDangHoc: override.sachDangHoc ?? classContent.sachDangHoc,
        kienThucMoi: override.kienThucMoi ?? classContent.kienThucMoi,
        giaoBTVN: override.giaoBTVN ?? classContent.giaoBTVN,
        khBuoiSau: override.khBuoiSau ?? classContent.khBuoiSau,
      }
      return { studentId: r.studentId, fullName: r.fullName, override, effective }
    })

    return { ok: true, classContent, rows, note: null }
  } catch (err) {
    console.error('[loadSessionStudentPlans] lỗi:', err)
    return { ok: false, error: 'server', message: 'Không tải được kế hoạch học viên.' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) UPSERT — ghi đè cá nhân (idempotent qua khoaKeHoach)
// ─────────────────────────────────────────────────────────────────────────────

/** Upsert thuần theo khóa (KHÔNG kiểm roster — caller đã kiểm). Race-safe. */
async function upsertPlan(
  payload: Payload,
  actor: User,
  sessionId: number,
  studentId: number,
  data: Partial<StudentPlanContent>,
): Promise<void> {
  const khoa = planKey(sessionId, studentId)
  const fields: Record<string, unknown> = {}
  for (const k of CONTENT_KEYS) if (k in data) fields[k] = strOrNull(data[k])

  const found = await payload.find({
    collection: 'session-student-plans',
    where: { khoaKeHoach: { equals: khoa } },
    overrideAccess: true,
    depth: 0,
    limit: 1,
  })
  if (found.docs.length > 0) {
    if (Object.keys(fields).length === 0) return
    await payload.update({
      collection: 'session-student-plans',
      id: found.docs[0].id,
      data: fields,
      user: actor,
      overrideAccess: false,
    })
    return
  }

  try {
    await payload.create({
      collection: 'session-student-plans',
      data: { session: sessionId, student: studentId, khoaKeHoach: khoa, ...fields } as never,
      user: actor,
      overrideAccess: false,
    })
  } catch (err) {
    // Đua tạo trùng khoaKeHoach (unique) → tìm lại & update.
    const retry = await payload.find({
      collection: 'session-student-plans',
      where: { khoaKeHoach: { equals: khoa } },
      overrideAccess: true,
      depth: 0,
      limit: 1,
    })
    if (retry.docs.length > 0) {
      if (Object.keys(fields).length === 0) return
      await payload.update({
        collection: 'session-student-plans',
        id: retry.docs[0].id,
        data: fields,
        user: actor,
        overrideAccess: false,
      })
      return
    }
    throw err
  }
}

export async function updateStudentPlan(
  payload: Payload,
  actor: User | null,
  input: { sessionId: number; studentId: number; patch: Partial<StudentPlanContent> },
): Promise<PlanSimpleResult> {
  if (!isStaff(actor)) {
    return { ok: false, error: 'forbidden', message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.' }
  }
  if (
    !Number.isInteger(input.sessionId) ||
    input.sessionId <= 0 ||
    !Number.isInteger(input.studentId) ||
    input.studentId <= 0
  ) {
    return { ok: false, error: 'invalid_input', message: 'Buổi hoặc học viên không hợp lệ.' }
  }

  try {
    const session = await loadVisibleSession(payload, actor, input.sessionId)
    if (!session) {
      return {
        ok: false,
        error: 'forbidden',
        message: 'Không tìm thấy buổi (hoặc ngoài phạm vi cơ sở).',
      }
    }
    const classId = relId(session.lop)
    if (classId === null) {
      return {
        ok: false,
        error: 'invalid_input',
        message: 'Buổi không gắn lớp — không lập kế hoạch theo HV được.',
      }
    }
    const roster = await loadClassRosterForDate(payload, actor, classId, session.date as string)
    if (!roster.some((r) => r.studentId === input.studentId)) {
      return {
        ok: false,
        error: 'forbidden',
        message: 'Học viên không thuộc lớp buổi này (hoặc ngoài cơ sở của bạn).',
      }
    }

    await upsertPlan(payload, actor, input.sessionId, input.studentId, input.patch)
    return { ok: true }
  } catch (err) {
    console.error('[updateStudentPlan] lỗi:', err)
    return {
      ok: false,
      error: 'server',
      message: 'Không lưu được kế hoạch học viên (có thể ngoài phạm vi cơ sở).',
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) ÁP NỘI DUNG CẢ LỚP XUỐNG TẤT CẢ HV (vật chất hóa override)
// ─────────────────────────────────────────────────────────────────────────────

export async function applyClassPlanToAll(
  payload: Payload,
  actor: User | null,
  sessionId: number,
): Promise<ApplyAllResult> {
  if (!isStaff(actor)) {
    return { ok: false, error: 'forbidden', message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.' }
  }
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return { ok: false, error: 'invalid_input', message: 'Buổi không hợp lệ.' }
  }

  try {
    const session = await loadVisibleSession(payload, actor, sessionId)
    if (!session) {
      return {
        ok: false,
        error: 'forbidden',
        message: 'Không tìm thấy buổi (hoặc ngoài phạm vi cơ sở).',
      }
    }
    const classId = relId(session.lop)
    if (classId === null) {
      return {
        ok: false,
        error: 'invalid_input',
        message: 'Buổi không gắn lớp — không lập kế hoạch theo HV được.',
      }
    }
    const classContent = contentOf(session)
    const roster = await loadClassRosterForDate(payload, actor, classId, session.date as string)

    let affected = 0
    for (const r of roster) {
      await upsertPlan(payload, actor, sessionId, r.studentId, classContent)
      affected += 1
    }
    return { ok: true, affected }
  } catch (err) {
    console.error('[applyClassPlanToAll] lỗi:', err)
    return { ok: false, error: 'server', message: 'Không áp được nội dung cả lớp xuống học viên.' }
  }
}
