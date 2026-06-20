import type { CollectionAfterChangeHook } from 'payload'
import { publishClbEvent } from './nats'

/**
 * afterChange hook cho class-sessions: khi một buổi chuyển sang ĐÃ DẠY (`da_day`)
 * hoặc DẠY BÙ (`bu`) → phát `clb.coach.session.completed` để Accounting/HRM ghi
 * lương HLV theo buổi (`luongMoiBuoi`).
 *
 * Chỉ phát khi MỚI chuyển sang trạng thái đã dạy (so previousDoc) ⇒ KHÔNG trả lương
 * trùng khi sửa lại buổi. GV thực dạy = `coachThucTe`, fallback GV chính của lớp.
 */
const TAUGHT = new Set(['da_day', 'bu'])

function relId(value: unknown): number | string | null {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id
    return typeof id === 'number' || typeof id === 'string' ? id : null
  }
  return null
}

export const publishCoachSessionCompleted: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  const status = doc.trangThai ? String(doc.trangThai) : ''
  if (!TAUGHT.has(status)) return doc
  const prevStatus = previousDoc && previousDoc.trangThai ? String(previousDoc.trangThai) : ''
  if (operation === 'update' && TAUGHT.has(prevStatus)) return doc // đã trả lương trước đó

  // GV thực dạy: coachThucTe → nếu trống dùng coach chính của lớp.
  let coachId = relId(doc.coachThucTe)
  if (!coachId) {
    const classId = relId(doc.lop)
    if (classId != null) {
      try {
        const cls = await req.payload.findByID({
          collection: 'classes',
          id: classId,
          depth: 0,
          overrideAccess: true,
        })
        coachId = relId((cls as { coach?: unknown }).coach)
      } catch {
        /* lớp không tồn tại → bỏ qua */
      }
    }
  }
  if (coachId == null) return doc

  // Lương/buổi + employeeId (liên kết HRM) của GV.
  let pay = 0
  let employeeId: string | undefined
  try {
    const coach = (await req.payload.findByID({
      collection: 'coaches',
      id: coachId,
      depth: 0,
      overrideAccess: true,
    })) as { luongMoiBuoi?: unknown; employeeId?: unknown }
    pay = Number(coach.luongMoiBuoi) || 0
    employeeId = coach.employeeId ? String(coach.employeeId) : undefined
  } catch {
    return doc
  }
  if (pay <= 0) return doc

  const userId =
    req?.user && 'id' in req.user && req.user.id != null ? String(req.user.id) : 'system'

  await publishClbEvent(
    'clb.coach.session.completed',
    {
      sessionId: String(doc.id),
      coachId: String(coachId),
      employeeId,
      classId: relId(doc.lop) != null ? String(relId(doc.lop)) : undefined,
      pay,
      currency: 'VND',
      date: doc.date ? new Date(doc.date as string).toISOString() : new Date().toISOString(),
    },
    { userId },
  )
  return doc
}
