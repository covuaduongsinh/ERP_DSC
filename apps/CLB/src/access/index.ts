import type { Access, FieldAccess } from 'payload'
import type { UserRole } from './roles'

export * from './roles'

/** Bất kỳ ai (kể cả chưa đăng nhập) */
export const anyone: Access = () => true

/** Chỉ nhân viên đã đăng nhập */
export const isAuthenticated: Access = ({ req }) => !!req.user

/**
 * `true` nếu req là nhân viên (collection `users`). Phụ huynh đăng nhập qua
 * collection `parents` KHÔNG được coi là staff — role chỉ có trên Users.
 */
const isStaffUser = (user: { collection?: string } | null | undefined): boolean =>
  !!user && user.collection === 'users'

/**
 * Đọc MẢNG vai trò của nhân viên (chỉ Users mới có role; hasMany ⇒ mảng).
 * Chấp nhận cả giá trị đơn (phòng dữ liệu cũ) ⇒ bọc thành mảng 1 phần tử.
 * Quyền = HỢP các vai trò.
 */
export const rolesOf = (
  user: { collection?: string; role?: UserRole | UserRole[] } | null | undefined,
): UserRole[] => {
  if (!isStaffUser(user)) return []
  const r = user?.role
  if (Array.isArray(r)) return r
  return r ? [r] : []
}

/**
 * Nhân viên có vai trò 'admin' (trong mảng role). Dùng cho thao tác cấp cao
 * (vd ma trận phân quyền, nhật ký kiểm toán).
 */
export const isAdmin: Access = ({ req }) => rolesOf(req.user).includes('admin')

/**
 * Factory: cho phép nếu nhân viên có BẤT KỲ vai trò nào nằm trong `roles` (union).
 * Ví dụ: `hasRole('admin', 'accountant')` cho Payments.
 */
export const hasRole =
  (...roles: UserRole[]): Access =>
  ({ req }) =>
    rolesOf(req.user).some((r) => roles.includes(r))

/**
 * Vai trò được DUYỆT/TỪ CHỐI yêu cầu gia hạn — đây là thao tác tài chính (chốt
 * gói mới ⇒ sinh chu kỳ học phí), nên CHẶT HƠN "staff bất kỳ": chỉ kế toán,
 * quản lý, admin. MỘT nguồn sự thật dùng chung cho cả access của collection
 * `renewal-requests` (DB-level), core `lib/renewals/process.ts` và Server Action.
 */
export const RENEWAL_PROCESSOR_ROLES = [
  'admin',
  'manager',
  'accountant',
] as const satisfies readonly UserRole[]

/** `true` nếu req là role được phép xử lý yêu cầu gia hạn. */
export const canProcessRenewals: Access = hasRole(...RENEWAL_PROCESSOR_ROLES)

/**
 * Vai trò được XEM báo cáo KPI tổng hợp (lead, tái tục, điểm danh, doanh thu).
 * CHỈ quản lý + admin: đây là số liệu vận hành/tài chính toàn trung tâm, không
 * mở cho lễ tân/giáo viên/kế toán. MỘT nguồn sự thật cho cả gate của admin view
 * `KpiReportView` lẫn (nếu cần sau này) endpoint số liệu.
 */
export const REPORT_VIEWER_ROLES = ['admin', 'manager'] as const satisfies readonly UserRole[]

/** `true` nếu req là role được xem trang Báo cáo KPI. */
export const canViewReports: Access = hasRole(...REPORT_VIEWER_ROLES)

/**
 * Vai trò được LẬP KẾ HOẠCH buổi học: sinh trước chuỗi buổi `du_kien` từ lịch
 * tuần, hủy buổi, tạo buổi bù trên trang "Lập kế hoạch buổi học". Đây là thao tác
 * QUẢN LÝ KHUNG LỊCH (khác việc ghi nội dung/điểm danh buổi hằng ngày mà mọi nhân
 * viên cùng cơ sở đều làm), nên chỉ quản lý + admin. MỘT nguồn sự thật cho core
 * `lib/operations/session-planning.ts` lẫn Server Action. Lưu ý: `class-sessions`
 * `create` access chỉ là `staffOnly` (DB-level), nên role gate này phải được kiểm
 * tra TRONG core/Server Action — không dựa vào collection access.
 */
export const SESSION_PLANNER_ROLES = ['admin', 'manager'] as const satisfies readonly UserRole[]

/** `true` nếu req là role được lập kế hoạch buổi học. */
export const canPlanSessions: Access = hasRole(...SESSION_PLANNER_ROLES)

/**
 * Vai trò được TẠO/SỬA/XÓA khung lộ trình (giáo trình mẫu theo cấp, V2). Khung là
 * TÀI SẢN DÙNG CHUNG toàn công ty (mục tiêu chuẩn hóa) ⇒ chỉ quản lý + admin được
 * biên soạn; mọi nhân viên ĐỌC được (để áp khung vào lớp). MỘT nguồn sự thật cho
 * cả access của collection `curriculum-templates` lẫn core `lib/operations/
 * curriculum-templates.ts` + Server Action. KHÔNG branch-scope (dùng chung).
 */
export const CURRICULUM_MANAGER_ROLES = ['admin', 'manager'] as const satisfies readonly UserRole[]

/** `true` nếu req là role được biên soạn khung lộ trình. */
export const canManageCurriculum: Access = hasRole(...CURRICULUM_MANAGER_ROLES)

/**
 * Chỉ thao tác trên CHÍNH record của mình. Trả về Where filter ở DB-level
 * (`id = user.id`) nên an toàn cho cả list endpoint. Dùng cho self-service
 * trên Users (đọc/sửa hồ sơ chính mình). CHƯA gắn vào collection nào.
 */
export const isSelf: Access = ({ req }) => {
  if (!req.user) return false
  return { id: { equals: req.user.id } }
}

/**
 * Field-level: CHỈ nhân viên (collection `users`) được ghi field này. Dùng cho
 * các field nội bộ trên collection mà `create` công khai (vd `Leads`): form web
 * (create = anyone) KHÔNG được tự gán pipeline/assignment/chuyển đổi; chỉ staff
 * (qua /admin hoặc Server Action) mới ghi được. Khác `hasRole(...)`: chỉ phân
 * biệt staff-vs-không, không lọc theo role cụ thể.
 */
export const staffOnlyField: FieldAccess = ({ req }) => isStaffUser(req.user)
