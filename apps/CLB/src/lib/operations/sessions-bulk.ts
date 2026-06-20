import 'server-only'
import type { Payload } from 'payload'
import type { User } from '@/payload-types'

/**
 * THAO TÁC HÀNG LOẠT trên buổi học (`class-sessions`) cho trang "Nhận xét buổi học".
 *
 * Gán cơ sở / lớp / GV thực dạy, hoặc xóa buổi (kèm điểm danh). Chỉ ghi vào field
 * SẴN CÓ — KHÔNG đổi schema. Tuyến KHÔNG gán trực tiếp: suy từ lớp được gán.
 *
 * BẢO MẬT 🔒: mọi ghi `overrideAccess:false` + `actor` ⇒ branch-scope của
 * `class-sessions` (`withBranchScope(..., 'location')`) và `attendance`
 * (`withBranchScope(..., 'student.location')`) là hàng rào thật — nhân viên
 * bị-khóa-cơ-sở không sửa/xóa được buổi ngoài cơ sở mình. Audit-log tự ghi qua
 * hook trên `class-sessions`.
 */

function isStaff(actor: User | null): actor is User {
  return !!actor && (actor as { collection?: string }).collection === 'users'
}

function posInt(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : null
}

/** Lọc mảng id → số nguyên dương duy nhất. */
function cleanIds(ids: unknown): number[] {
  if (!Array.isArray(ids)) return []
  const set = new Set<number>()
  for (const v of ids) {
    const n = posInt(v)
    if (n !== null) set.add(n)
  }
  return Array.from(set)
}

/** Field được phép gán hàng loạt (id của relationship trên class-sessions). */
export interface BulkSessionPatch {
  /** Cơ sở (locations.id). */
  location?: number
  /** Lớp (classes.id) — tuyến/cấp độ suy từ đây. */
  lop?: number
  /** GV thực dạy (coaches.id). */
  coachThucTe?: number
  /** Trợ giảng thực tế (coaches.id). */
  troGiangThucTe?: number
}

const PATCH_FIELDS = ['location', 'lop', 'coachThucTe', 'troGiangThucTe'] as const

export type BulkOpResult =
  | { ok: true; affected: number; failed: number; deletedAttendance?: number; message: string }
  | { ok: false; error: 'forbidden' | 'invalid_input' | 'server'; message: string }

const FORBIDDEN: BulkOpResult = {
  ok: false,
  error: 'forbidden',
  message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.',
}

/**
 * Gán cơ sở / lớp / GV cho nhiều buổi cùng lúc (update-by-where, 1 truy vấn).
 * `failed = số id chọn − số buổi cập nhật được` (chênh do branch-scope loại bớt).
 */
export async function bulkUpdateSessions(
  payload: Payload,
  actor: User | null,
  input: { sessionIds: number[]; patch: BulkSessionPatch },
): Promise<BulkOpResult> {
  if (!isStaff(actor)) return FORBIDDEN

  const ids = cleanIds(input.sessionIds)
  if (ids.length === 0) {
    return { ok: false, error: 'invalid_input', message: 'Chưa chọn buổi hợp lệ.' }
  }

  const data: Record<string, number> = {}
  const patch = (input.patch ?? {}) as Record<string, unknown>
  for (const k of PATCH_FIELDS) {
    if (k in patch) {
      const val = posInt(patch[k])
      if (val === null) {
        return { ok: false, error: 'invalid_input', message: `Giá trị "${k}" không hợp lệ.` }
      }
      data[k] = val
    }
  }
  if (Object.keys(data).length === 0) {
    return { ok: false, error: 'invalid_input', message: 'Không có thay đổi để áp dụng.' }
  }

  try {
    const res = await payload.update({
      collection: 'class-sessions',
      where: { id: { in: ids } },
      data,
      user: actor,
      overrideAccess: false,
    })
    const affected = Array.isArray(res?.docs) ? res.docs.length : 0
    const failed = ids.length - affected
    const message =
      failed === 0
        ? `Đã cập nhật ${affected} buổi.`
        : `Đã cập nhật ${affected} buổi; ${failed} buổi không cập nhật được (có thể ngoài phạm vi cơ sở của bạn).`
    return { ok: true, affected, failed, message }
  } catch (err) {
    console.error('[bulkUpdateSessions] lỗi:', err)
    return { ok: false, error: 'server', message: 'Không cập nhật được các buổi đã chọn.' }
  }
}

/**
 * Xóa nhiều buổi kèm điểm danh thuộc buổi (đường phá hủy — yêu cầu `confirm`).
 * Xóa điểm danh trước (FK `session`), rồi xóa `class-sessions`.
 */
export async function bulkDeleteSessions(
  payload: Payload,
  actor: User | null,
  input: { sessionIds: number[]; confirm: boolean },
): Promise<BulkOpResult> {
  if (!isStaff(actor)) return FORBIDDEN
  if (input.confirm !== true) {
    return { ok: false, error: 'invalid_input', message: 'Cần xác nhận trước khi xóa.' }
  }

  const ids = cleanIds(input.sessionIds)
  if (ids.length === 0) {
    return { ok: false, error: 'invalid_input', message: 'Chưa chọn buổi hợp lệ.' }
  }

  try {
    const delAtt = await payload.delete({
      collection: 'attendance',
      where: { session: { in: ids } },
      user: actor,
      overrideAccess: false,
    })
    const deletedAttendance = Array.isArray(delAtt?.docs) ? delAtt.docs.length : 0

    const delSess = await payload.delete({
      collection: 'class-sessions',
      where: { id: { in: ids } },
      user: actor,
      overrideAccess: false,
    })
    const affected = Array.isArray(delSess?.docs) ? delSess.docs.length : 0
    const failed = ids.length - affected

    const message =
      failed === 0
        ? `Đã xóa ${affected} buổi (kèm ${deletedAttendance} bản ghi điểm danh).`
        : `Đã xóa ${affected} buổi (kèm ${deletedAttendance} điểm danh); ${failed} buổi không xóa được (có thể ngoài phạm vi cơ sở của bạn).`
    return { ok: true, affected, failed, deletedAttendance, message }
  } catch (err) {
    console.error('[bulkDeleteSessions] lỗi:', err)
    return {
      ok: false,
      error: 'server',
      message: 'Không xóa được (có thể buổi đang được tham chiếu hoặc ngoài phạm vi cơ sở).',
    }
  }
}
