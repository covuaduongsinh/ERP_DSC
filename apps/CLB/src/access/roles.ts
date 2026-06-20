/**
 * Vai trò nhân viên (collection Users) — MỘT nguồn sự thật duy nhất cho cả
 * field `role` trên Users lẫn các access helper (isAdmin, hasRole).
 *
 * Lưu ý: role CHỈ tồn tại trên Users (nhân viên). Phụ huynh đăng nhập qua
 * collection `parents` và KHÔNG có role — xem [[feedback_payload_overrideaccess]]
 * và access/parents.ts cho luồng phụ huynh.
 */
export const USER_ROLES = [
  'admin',
  'manager',
  'coach',
  'accountant',
  'receptionist',
  // Trợ giảng — quyền NGANG coach (nhân viên khoá-cơ-sở): thừa access staffOnly +
  // branch-scope (điểm danh, xem/sửa HV & soạn báo cáo cùng cơ sở). KHÔNG nằm trong
  // GLOBAL_BRANCH_ROLES/RENEWAL/REPORT… ⇒ bị loại khỏi leads/tài chính/KPI/nội dung/users
  // bằng cách KHÔNG thêm vào các list hasRole. Nav hẹp hơn coach chỉ là UX.
  'assistant',
] as const

export type UserRole = (typeof USER_ROLES)[number]

/** Vai trò mặc định khi tạo tài khoản mới (quyền thấp nhất). */
export const DEFAULT_USER_ROLE: UserRole = 'receptionist'

/** Options cho Payload select field — label tiếng Việt, value khớp enum DB. */
export const USER_ROLE_OPTIONS: { label: string; value: UserRole }[] = [
  { label: 'Quản trị viên (admin)', value: 'admin' },
  { label: 'Quản lý (manager)', value: 'manager' },
  { label: 'Giáo viên (coach)', value: 'coach' },
  { label: 'Kế toán (accountant)', value: 'accountant' },
  { label: 'Lễ tân (receptionist)', value: 'receptionist' },
  { label: 'Trợ giảng (assistant)', value: 'assistant' },
]
