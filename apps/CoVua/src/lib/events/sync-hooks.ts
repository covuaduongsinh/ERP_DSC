import type { CollectionAfterChangeHook } from 'payload'
import { publishCovuaEvent } from './nats'

/**
 * Hooks phát sự kiện đồng bộ ngược CoVua → CRM (view 360° trên Contact phụ huynh):
 *  - `covua.attendance.recorded`: mỗi lần điểm danh → cập nhật "hoạt động gần nhất".
 *  - `covua.student.updated`: học viên đổi cấp/trạng thái/số buổi tồn → cập nhật cache.
 *
 * Lỗi publish được nuốt trong publishCovuaEvent ⇒ không ảnh hưởng ghi dữ liệu.
 */
function relId(value: unknown): number | string | null {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id
    return typeof id === 'number' || typeof id === 'string' ? id : null
  }
  return null
}

function actorId(req: { user?: { id?: unknown } | null } | undefined): string {
  return req?.user && 'id' in req.user && req.user.id != null ? String(req.user.id) : 'system'
}

function relStr(value: unknown): string | undefined {
  const id = relId(value)
  return id != null ? String(id) : undefined
}

export const publishAttendanceRecorded: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  if (operation !== 'create') return doc
  const studentId = relStr(doc.student)
  if (!studentId) return doc

  await publishCovuaEvent(
    'covua.attendance.recorded',
    {
      attendanceId: String(doc.id),
      studentId,
      status: doc.status ? String(doc.status) : undefined,
      classId: relStr(doc.class),
      sessionId: relStr(doc.session),
      coachId: relStr(doc.coach),
      recordedAt: new Date().toISOString(),
    },
    { userId: actorId(req) },
  )
  return doc
}

export const publishStudentUpdated: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  // Chỉ phát trên update — bản tạo mới đã đi qua handoff CRM→CoVua.
  if (operation !== 'update') return doc

  await publishCovuaEvent(
    'covua.student.updated',
    {
      studentId: String(doc.id),
      fullName: doc.fullName ? String(doc.fullName) : undefined,
      enrollmentStatus: doc.enrollmentStatus ? String(doc.enrollmentStatus) : undefined,
      levelId: relStr(doc.capChinh),
      sessionBalance: doc.soBuoiTonDauKy != null ? Number(doc.soBuoiTonDauKy) : undefined,
      updatedAt: new Date().toISOString(),
    },
    { userId: actorId(req) },
  )
  return doc
}
