import type { Access, FieldAccess, Where } from 'payload'

/**
 * Access control theo quan hệ — phụ huynh CHỈ đọc dữ liệu của con MÌNH.
 *
 * Quy ước: `req.user.collection === 'parents'` nghĩa là req đang là phụ huynh
 * đăng nhập (qua custom strategy). `req.user.collection === 'users'` là nhân
 * viên đăng nhập admin. Anonymous = không có user.
 *
 * Nhân viên: full access (đọc/ghi). Phụ huynh: chỉ đọc record liên quan con.
 * Anonymous: cấm.
 */

const isStaff = (user: { collection?: string } | null | undefined): boolean =>
  !!user && user.collection === 'users'

const isParent = (user: { collection?: string } | null | undefined): boolean =>
  !!user && user.collection === 'parents'

/** Staff đọc/ghi tất cả, không ai khác đọc/ghi. */
export const staffOnly: Access = ({ req }) => isStaff(req.user)

/**
 * Đọc Students: staff đọc tất cả; phụ huynh chỉ đọc Students nằm trong
 * `parent.children`. Cấp DB-level filter (không phải post-filter) để không
 * leak qua list endpoint.
 */
export const readStudentForParent: Access = ({ req }) => {
  if (isStaff(req.user)) return true
  if (!isParent(req.user)) return false

  const parent = req.user as { id: number; children?: Array<number | { id: number }> }
  const childIds = (parent.children ?? [])
    .map((c) => (typeof c === 'number' ? c : c?.id))
    .filter((id): id is number => typeof id === 'number')

  if (childIds.length === 0) return false

  return { id: { in: childIds } }
}

/**
 * Đọc record có field `student` (relation→students): staff đọc tất; phụ huynh
 * chỉ đọc khi `student` thuộc về con mình. Dùng cho ProgressReports, Attendance,
 * TuitionReminders.
 *
 * @param extraWhere optional — gộp thêm điều kiện (vd ProgressReports yêu cầu
 *                    isVisibleToParent=true cho phụ huynh).
 */
export const readByStudentRelation =
  (extraWhere?: Where): Access =>
  ({ req }) => {
    if (isStaff(req.user)) return true
    if (!isParent(req.user)) return false

    const parent = req.user as { id: number; children?: Array<number | { id: number }> }
    const childIds = (parent.children ?? [])
      .map((c) => (typeof c === 'number' ? c : c?.id))
      .filter((id): id is number => typeof id === 'number')

    if (childIds.length === 0) return false

    const base: Where = { student: { in: childIds } }
    if (extraWhere) return { and: [base, extraWhere] }
    return base
  }

/** Parents collection: staff đọc tất; phụ huynh chỉ đọc CHÍNH mình. */
export const readParentSelf: Access = ({ req }) => {
  if (isStaff(req.user)) return true
  if (!isParent(req.user)) return false
  const parent = req.user as { id: number }
  return { id: { equals: parent.id } }
}

/** Phụ huynh chỉ được sửa hồ sơ chính mình; staff sửa tất. */
export const updateParentSelf: Access = ({ req }) => {
  if (isStaff(req.user)) return true
  if (!isParent(req.user)) return false
  const parent = req.user as { id: number }
  return { id: { equals: parent.id } }
}

/**
 * Field-level: CHỈ staff được ghi. Dùng cho field nhạy cảm trên Parents như
 * `children` (quan hệ với học viên) và `phone` (định danh đăng nhập). Nếu
 * không khóa, phụ huynh PATCH chính hồ sơ mình có thể tự gán con người khác
 * vào `children`, sau đó readStudentForParent sẽ trả về dữ liệu con đó.
 */
export const staffOnlyFieldWrite: FieldAccess = ({ req }) => isStaff(req.user)

function getParentChildIds(parent: { children?: Array<number | { id: number }> }): number[] {
  return (parent.children ?? [])
    .map((c) => (typeof c === 'number' ? c : c?.id))
    .filter((id): id is number => typeof id === 'number')
}

function resolveRelationId(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id
    return typeof id === 'number' ? id : null
  }
  return null
}

/**
 * Yêu cầu gia hạn: phụ huynh chỉ tạo cho con mình và gắn đúng parent id.
 */
export const createRenewalForOwnChild: Access = ({ req, data }) => {
  if (isStaff(req.user)) return true
  if (!isParent(req.user)) return false

  const parent = req.user as {
    id: number
    children?: Array<number | { id: number }>
  }
  const childIds = getParentChildIds(parent)
  const studentId = resolveRelationId(data?.student)
  const parentId = resolveRelationId(data?.parent)

  if (studentId === null || parentId === null) return false
  if (parentId !== parent.id) return false
  return childIds.includes(studentId)
}

/** Phụ huynh chỉ đọc yêu cầu do chính mình gửi. */
export const readRenewalRequest: Access = ({ req }) => {
  if (isStaff(req.user)) return true
  if (!isParent(req.user)) return false
  const parent = req.user as { id: number }
  return { parent: { equals: parent.id } }
}
