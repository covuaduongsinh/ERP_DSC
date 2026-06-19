import type { Access, Where } from 'payload'
import type { UserRole } from './roles'

/**
 * Phân quyền theo cơ sở (branch) 🔒
 *
 * "Cơ sở" trong hệ thống = relationship `location` → collection `locations`
 * (đã có sẵn trên Students, Classes; thêm cho Users ở migration
 * `…_add_users_location`). KHÔNG nhầm với field select `coSo`
 * (kim_lien/vinh_phuc) trên Payments/Attendance/BookIssues — đó là bản
 * denormalize phục vụ nhập liệu CRM, KHÔNG dùng cho phân quyền.
 *
 * Mô hình:
 *  - Vai trò GLOBAL (`GLOBAL_BRANCH_ROLES`) xem/ghi TẤT CẢ cơ sở.
 *  - Vai trò còn lại (coach, receptionist) bị KHÓA theo `users.location` của
 *    chính nhân viên: chỉ thao tác trên record cùng `location`.
 *  - Nhân viên bị-khóa nhưng CHƯA được gán cơ sở (`location` trống) ⇒
 *    FAIL-CLOSED: không đọc/ghi gì (least-privilege — admin phải gán cơ sở).
 *
 * Lọc ở DB-level (trả `Where`) — KHÔNG post-filter — nên không leak qua list
 * endpoint. Đây là hàng rào ở tầng access, không chỉ ẩn UI.
 */

/**
 * Vai trò xem/ghi mọi cơ sở (không bị lọc theo branch). MỘT nguồn sự thật cho
 * mọi combinator branch-scope. Manager + accountant cần nhìn xuyên cơ sở
 * (giám sát vận hành / tài chính toàn trung tâm); admin đương nhiên global.
 */
export const GLOBAL_BRANCH_ROLES = [
  'admin',
  'manager',
  'accountant',
] as const satisfies readonly UserRole[]

const isStaffUser = (
  user: { collection?: string } | null | undefined,
): boolean => !!user && user.collection === 'users'

/** MẢNG vai trò nhân viên (hasMany ⇒ mảng; chấp nhận giá trị đơn cũ). */
const rolesOf = (
  user: { collection?: string; role?: UserRole | UserRole[] } | null | undefined,
): UserRole[] => {
  if (!isStaffUser(user)) return []
  const r = user?.role
  if (Array.isArray(r)) return r
  return r ? [r] : []
}

/** `true` nếu nhân viên có BẤT KỲ vai trò nào xem mọi cơ sở (union). */
export function isGlobalBranchUser(
  user: { collection?: string; role?: UserRole | UserRole[] } | null | undefined,
): boolean {
  const globals = GLOBAL_BRANCH_ROLES as readonly UserRole[]
  return rolesOf(user).some((r) => globals.includes(r))
}

/** Lấy id của relationship `location` dù được trả về dạng số hay {id}. */
function resolveRelationId(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id
    return typeof id === 'number' ? id : null
  }
  return null
}

/**
 * MẢNG cơ sở được gán cho nhân viên (`users.location` hasMany). Mảng rỗng nếu
 * chưa gán/không staff. Chấp nhận cả giá trị đơn (phòng dữ liệu cũ).
 */
export function resolveBranchIds(
  user: { collection?: string; location?: unknown } | null | undefined,
): number[] {
  if (!isStaffUser(user)) return []
  const loc = user?.location
  const arr = Array.isArray(loc) ? loc : loc != null ? [loc] : []
  return arr
    .map((v) => resolveRelationId(v))
    .filter((id): id is number => id != null)
}

/**
 * Bọc một Access "gate" thêm lọc theo cơ sở.
 *
 * `gate` quyết định CÓ được thao tác hay không (theo staff/role — vd `staffOnly`,
 * `hasRole(...)`, hay `readStudentForParent`). Hành vi sau khi gọi gate:
 *  - gate trả `false` hoặc một `Where` (vd phụ huynh lọc theo con) ⇒ TRẢ NGUYÊN
 *    (không áp branch — phụ huynh/anon không phải nhân viên nên không scope theo
 *    cơ sở; gate đã tự lọc).
 *  - gate trả `true` (nhân viên được phép) ⇒ áp branch: vai trò global → `true`;
 *    vai trò bị-khóa → `Where` lọc `field IN (các cơ sở của nhân viên)`; chưa gán
 *    cơ sở nào → `false` (fail-closed).
 *
 * @param gate  Access nền (phải đồng bộ — mọi gate trong repo đều sync).
 * @param field tên field relationship→locations trên collection (mặc định `location`).
 */
export const withBranchScope =
  (gate: Access, field = 'location'): Access =>
  (args) => {
    const gated = gate(args) as boolean | Where
    if (gated !== true) return gated

    const user = args.req.user as
      | { collection?: string; role?: UserRole | UserRole[]; location?: unknown }
      | null
      | undefined
    if (isGlobalBranchUser(user)) return true

    const branchIds = resolveBranchIds(user)
    if (branchIds.length === 0) return false // fail-closed: chưa gán cơ sở ⇒ cấm
    return { [field]: { in: branchIds } } as Where
  }

/**
 * Như `withBranchScope` nhưng GIỮ thêm record "toàn công ty" (`field` null).
 *
 * Dùng cho dữ liệu cấu hình vừa có bản dùng-chung (location trống) vừa có bản
 * riêng-cơ-sở — vd `Holidays`: ngày nghỉ toàn công ty PHẢI hiển thị cho mọi
 * nhân viên, đồng thời nhân viên bị-khóa chỉ thấy thêm ngày nghỉ của cơ sở mình.
 *
 * Khác biệt duy nhất với `withBranchScope`: vai trò bị-khóa trả `field IS NULL`
 * (chưa gán cơ sở) hoặc `field IS NULL OR field IN (...)` (đã gán) — không
 * fail-closed về `false` vì record toàn-công-ty luôn được phép đọc.
 */
export const withBranchScopeOrGlobal =
  (gate: Access, field = 'location'): Access =>
  (args) => {
    const gated = gate(args) as boolean | Where
    if (gated !== true) return gated

    const user = args.req.user as
      | { collection?: string; role?: UserRole | UserRole[]; location?: unknown }
      | null
      | undefined
    if (isGlobalBranchUser(user)) return true

    const branchIds = resolveBranchIds(user)
    if (branchIds.length === 0) return { [field]: { exists: false } } as Where
    return {
      or: [{ [field]: { exists: false } }, { [field]: { in: branchIds } }],
    } as Where
  }
