import type { CollectionAfterChangeHook } from 'payload'
import { publishClbEvent } from './nats'

/**
 * afterChange hook cho renewal-requests: khi phụ huynh TẠO yêu cầu gia hạn → phát
 * `clb.renewal.requested` lên NATS để CRM kích hoạt chăm sóc giữ chân
 * (tạo task/lịch follow-up cho lễ tân + campaign nurture).
 *
 * Chỉ phát trên `create`. Lỗi publish được nuốt trong publishClbEvent ⇒ không
 * ảnh hưởng ghi renewal-requests.
 */
export const publishRenewalRequested: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  if (operation !== 'create') return doc

  const rel = (v: unknown): { id?: unknown; fullName?: unknown } | unknown =>
    v && typeof v === 'object' ? (v as Record<string, unknown>) : v
  const student = rel(doc.student) as { id?: unknown; fullName?: unknown } | unknown
  const parent = rel(doc.parent) as { id?: unknown } | unknown

  const studentId =
    student && typeof student === 'object' ? (student as { id?: unknown }).id : student
  const studentName =
    student && typeof student === 'object'
      ? ((student as { fullName?: unknown }).fullName as string | undefined)
      : undefined
  const parentId = parent && typeof parent === 'object' ? (parent as { id?: unknown }).id : parent

  const data = {
    requestId: String(doc.id),
    studentId: String(studentId ?? ''),
    studentName,
    parentId: parentId != null ? String(parentId) : undefined,
    sessionsRemaining: Number(doc.sessionsRemaining) || 0,
    status: doc.status ? String(doc.status) : undefined,
    requestedAt: new Date().toISOString(),
  }

  const userId =
    req?.user && 'id' in req.user && req.user.id != null ? String(req.user.id) : 'system'

  await publishClbEvent('clb.renewal.requested', data, { userId })
  return doc
}
