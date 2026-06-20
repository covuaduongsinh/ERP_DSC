import 'server-only'
import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import { ensureSession } from './sessions'

/**
 * Ghi ĐIỂM DANH NHANH cả lớp trong một ngày — lớp lõi (THUẦN nghiệp vụ + I/O qua
 * Local API, tách khỏi next/headers để unit-test được như renewals/payments).
 *
 * IDEMPOTENT theo `(student, ngày dương lịch)`: nếu HV đã có bản ghi điểm danh
 * trong NGÀY đó (bất kể nguồn — nhập tay hay import) thì CẬP NHẬT trạng thái,
 * KHÔNG tạo bản mới ⇒ không đếm trùng buổi vào `sessionsUsed`. Bấm lưu nhiều lần
 * an toàn. `khoa` (khóa import) để trống — chỉ importer nhận xét buổi dùng nó.
 *
 * Ghi với `overrideAccess:false + user` ⇒ collection access (attendance
 * create/update = staffOnly) là hàng rào DB-level; danh tính từ phiên server.
 */

export type QuickAttendanceStatus = 'co_mat' | 'vang' | 'phep'

export interface QuickAttendanceEntry {
  studentId: number
  status: QuickAttendanceStatus
  note?: string | null
}

export interface SubmitQuickAttendanceInput {
  classId: number
  /** Ngày học (ISO/yyyy-mm-dd). */
  date: string
  entries: QuickAttendanceEntry[]
}

export type SubmitQuickAttendanceResult =
  | { ok: true; created: number; updated: number }
  | {
      ok: false
      error: 'forbidden' | 'invalid_input' | 'server'
      message: string
    }

const VALID_STATUSES: QuickAttendanceStatus[] = ['co_mat', 'vang', 'phep']

export async function submitQuickAttendance(
  payload: Payload,
  actor: User | null,
  input: SubmitQuickAttendanceInput,
): Promise<SubmitQuickAttendanceResult> {
  if (!actor || (actor as { collection?: string }).collection !== 'users') {
    return {
      ok: false,
      error: 'forbidden',
      message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.',
    }
  }
  if (!Number.isInteger(input.classId) || input.classId <= 0) {
    return { ok: false, error: 'invalid_input', message: 'Chưa chọn lớp.' }
  }
  const d = input.date ? new Date(input.date) : null
  if (!d || Number.isNaN(d.getTime())) {
    return { ok: false, error: 'invalid_input', message: 'Ngày học không hợp lệ.' }
  }
  const entries = (input.entries ?? []).filter(
    (e) => Number.isInteger(e.studentId) && e.studentId > 0 && VALID_STATUSES.includes(e.status),
  )
  if (entries.length === 0) {
    return {
      ok: false,
      error: 'invalid_input',
      message: 'Chưa có học viên hợp lệ nào để ghi điểm danh.',
    }
  }

  // Cận ngày dương lịch (UTC) để dò bản ghi cùng ngày — đồng quy ước với
  // buildSessionsUsedWhere (đếm buổi theo ngày UTC).
  const dayStart = new Date(d)
  dayStart.setUTCHours(0, 0, 0, 0)
  const dayEnd = new Date(d)
  dayEnd.setUTCHours(23, 59, 59, 999)

  // Sinh/lấy buổi học cho (lớp, ngày) để liên kết attendance.session (GĐ3). Best-
  // effort: lỗi ensureSession KHÔNG được chặn ghi điểm danh (dữ liệu tính tiền).
  let sessionId: number | null = null
  try {
    const session = await ensureSession(payload, actor, { lopId: input.classId, date: dayStart })
    sessionId = session.id
  } catch (err) {
    console.error('[submitQuickAttendance] ensureSession lỗi (bỏ qua, vẫn ghi điểm danh):', err)
  }

  let created = 0
  let updated = 0
  try {
    for (const e of entries) {
      const note = e.note?.trim()
      // Type cụ thể (không Record<string, unknown>) để Payload nhận đúng overload
      // create — `status` phải là union literal, không phải unknown.
      const fields: {
        status: QuickAttendanceStatus
        lop: number
        note?: string
        session?: number
      } = {
        status: e.status,
        lop: input.classId,
      }
      if (note) fields.note = note
      if (sessionId) fields.session = sessionId

      // Lookup idempotent: `overrideAccess: true` CỐ Ý. Sau khi attendance.read
      // branch-scoped theo `student.location`, nếu HV có `location` NULL/khác cơ
      // sở của actor thì lookup (nếu lọc theo branch) sẽ trả 0 → rẽ nhánh CREATE
      // (create KHÔNG scope) → tạo bản ghi TRÙNG trong ngày, đếm trùng buổi vào
      // `sessionsUsed`. Idempotency KHÔNG được phụ thuộc branch-scope. An toàn vì
      // where đã khóa cứng theo `studentId + ngày` cụ thể (không leak chéo — cùng
      // lý do `TuitionCycles.countAttendedSessions`). Ghi (update/create) bên dưới
      // vẫn `overrideAccess:false` để collection access là hàng rào DB-level.
      const existing = await payload.find({
        collection: 'attendance',
        where: {
          and: [
            { student: { equals: e.studentId } },
            { date: { greater_than_equal: dayStart.toISOString() } },
            { date: { less_than_equal: dayEnd.toISOString() } },
          ],
        },
        user: actor,
        overrideAccess: true,
        depth: 0,
        limit: 1,
      })

      if (existing.totalDocs > 0) {
        await payload.update({
          collection: 'attendance',
          id: existing.docs[0].id,
          data: fields,
          user: actor,
          overrideAccess: false,
        })
        updated += 1
      } else {
        await payload.create({
          collection: 'attendance',
          data: { student: e.studentId, date: dayStart.toISOString(), ...fields },
          user: actor,
          overrideAccess: false,
        })
        created += 1
      }
    }
    return { ok: true, created, updated }
  } catch (err) {
    console.error('[submitQuickAttendance] Lỗi ghi điểm danh nhanh:', err)
    return {
      ok: false,
      error: 'server',
      message: 'Có lỗi khi ghi điểm danh. Vui lòng thử lại.',
    }
  }
}
