import 'server-only'
import type { Payload } from 'payload'
import type { User } from '@/payload-types'
import { addStudentToClass, removeStudentFromClass } from './enrollment'

/**
 * Ghi danh THEO HỌC VIÊN (student-centric) — chọn 1 HV → đặt tập lớp đang học.
 * Tái dùng `addStudentToClass`/`removeStudentFromClass` (idempotent, branch-safe).
 * `diffEnrollment` THUẦN (test); `saveStudentClasses` là I/O mỏng.
 */

function isStaff(actor: User | null): actor is User {
  return !!actor && (actor as { collection?: string }).collection === 'users'
}

function relId(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id
    return typeof id === 'number' ? id : null
  }
  return null
}

/** Các lớp HV đang học (dangHoc=true), branch-scoped qua enrollments.read. */
export async function loadStudentClassIds(
  payload: Payload,
  user: User,
  studentId: number,
): Promise<number[]> {
  if (!Number.isInteger(studentId) || studentId <= 0) return []
  const { docs } = await payload.find({
    collection: 'enrollments',
    where: { and: [{ student: { equals: studentId } }, { dangHoc: { equals: true } }] },
    user,
    overrideAccess: false,
    disableErrors: true,
    depth: 0,
    pagination: false,
    limit: 0,
  })
  const ids = new Set<number>()
  for (const e of docs) {
    const cid = relId((e as { class?: unknown }).class)
    if (cid != null) ids.add(cid)
  }
  return [...ids]
}

/** THUẦN: so tập lớp hiện tại vs mong muốn → cần thêm / cần rút. */
export function diffEnrollment(
  current: number[],
  desired: number[],
): { toAdd: number[]; toRemove: number[] } {
  const cur = new Set(current)
  const des = new Set(desired)
  return {
    toAdd: [...des].filter((id) => !cur.has(id)),
    toRemove: [...cur].filter((id) => !des.has(id)),
  }
}

export type SaveStudentClassesResult =
  | { ok: true; added: number; removed: number; errors: string[] }
  | { ok: false; error: 'forbidden' | 'invalid_input' | 'server'; message: string }

/** Đặt tập lớp đang học của 1 HV = desiredClassIds (thêm/rút theo diff). */
export async function saveStudentClasses(
  payload: Payload,
  actor: User | null,
  studentId: number,
  desiredClassIds: number[],
): Promise<SaveStudentClassesResult> {
  if (!isStaff(actor)) {
    return { ok: false, error: 'forbidden', message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.' }
  }
  if (!Number.isInteger(studentId) || studentId <= 0) {
    return { ok: false, error: 'invalid_input', message: 'Học viên không hợp lệ.' }
  }
  const desired = [
    ...new Set((desiredClassIds ?? []).filter((id) => Number.isInteger(id) && id > 0)),
  ]

  try {
    const current = await loadStudentClassIds(payload, actor, studentId)
    const { toAdd, toRemove } = diffEnrollment(current, desired)
    let added = 0
    let removed = 0
    const errors: string[] = []

    for (const cid of toAdd) {
      const r = await addStudentToClass(payload, actor, cid, studentId)
      if (r.ok) added += 1
      else errors.push(`Thêm lớp #${cid}: ${r.message}`)
    }
    for (const cid of toRemove) {
      const r = await removeStudentFromClass(payload, actor, cid, studentId)
      if (r.ok) removed += 1
      else if (r.error !== 'not_found') errors.push(`Rút lớp #${cid}: ${r.message}`)
    }
    return { ok: true, added, removed, errors }
  } catch (err) {
    console.error('[saveStudentClasses] lỗi:', err)
    return { ok: false, error: 'server', message: 'Có lỗi khi lưu ghi danh. Vui lòng thử lại.' }
  }
}
