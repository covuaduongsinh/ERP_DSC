import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Users,
  Grid2x2,
  ClipboardCheck,
  FileBarChart,
  Wallet,
  RefreshCw,
  ReceiptText,
  TrendingDown,
  Newspaper,
  CalendarDays,
  BookOpen,
  GraduationCap,
  MapPin,
  ShieldCheck,
  ScrollText,
  KeyRound,
  Send,
  Upload,
  CheckCheck,
  ClipboardList,
  FilePlus2,
  Layers,
  BarChart3,
  Hourglass,
  AlertTriangle,
  CalendarClock,
  Undo2,
  Banknote,
  Package,
  NotebookPen,
  MessageSquareText,
  CalendarOff,
  Settings,
} from 'lucide-react'
import type { UserRole } from '@/access/roles'

/**
 * Cấu hình điều hướng /admin (port từ design_handoff_admin_dsc/design/data.js).
 *
 * - `NAV_GROUPS`: nhóm + item → route THẬT trong admin (collection list hoặc
 *   custom view đã đăng ký ở payload.config.ts). Item chưa có đích (lead-pipeline,
 *   trials) tạm bỏ; "leads" trỏ list collection.
 * - `ROLE_NAV`: route id mỗi vai trò được THẤY (UX). Hàng rào THẬT vẫn ở
 *   access/* (server-side) — đây chỉ ẩn/hiện link.
 * - `badge`: khóa hàng đợi (getStaffQueueCounts) gắn lên item.
 */

export type NavItemId =
  | 'dashboard'
  | 'leads'
  | 'students'
  | 'classes'
  | 'attendance'
  | 'reports'
  | 'payments'
  | 'renewals'
  | 'debt'
  | 'expenses'
  | 'posts'
  | 'events'
  | 'books'
  | 'coaches'
  | 'locations'
  | 'users'
  | 'permissions'
  | 'audit'
  | 'roster'
  | 'enrollments'
  | 'levels'
  | 'kpi'
  | 'sessionBalance'
  | 'dataHygiene'
  | 'timetable'
  | 'refunds'
  | 'payroll'
  | 'tuitionPackages'
  | 'sessionEntry'
  | 'sessionPlanning'
  | 'holidays'
  | 'curriculumTemplates'
  | 'sessionFeedback'
  | 'teachingStats'
  | 'studentEnrollment'
  | 'webLocations'
  | 'webCoaches'
  | 'webPrograms'

export type NavBadgeKey = 'leads' | 'renewals' | 'reports'

export interface NavItem {
  id: NavItemId
  label: string
  href: string
  icon: LucideIcon
  badge?: NavBadgeKey
}

export interface NavGroup {
  group: string
  /** Icon nhóm — hiện trên header accordion (sidebar v2). */
  icon: LucideIcon
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    group: 'Tổng quan',
    icon: LayoutDashboard,
    items: [
      { id: 'dashboard', label: 'Bảng điều khiển', href: '/admin', icon: LayoutDashboard },
      { id: 'kpi', label: 'Báo cáo KPI', href: '/admin/bao-cao-kpi', icon: BarChart3 },
    ],
  },
  // Nhóm "Tuyển sinh" (Lead tư vấn) đã chuyển sang CRM (app CRM, /admissions) — nguồn
  // sự thật duy nhất cho phễu tuyển sinh. Ẩn khỏi nav CLB để tránh trùng lặp; dữ
  // liệu lead cũ + endpoint handoff (/api/internal/admissions/convert) vẫn giữ nguyên.
  {
    group: 'Đào tạo',
    icon: GraduationCap,
    items: [
      { id: 'students', label: 'Học viên', href: '/admin/collections/students', icon: Users },
      { id: 'classes', label: 'Lớp học', href: '/admin/collections/classes', icon: Grid2x2 },
      {
        id: 'enrollments',
        label: 'Ghi danh',
        href: '/admin/collections/enrollments',
        icon: FilePlus2,
      },
      { id: 'roster', label: 'Sĩ số lớp', href: '/admin/si-so-lop', icon: ClipboardList },
      {
        id: 'studentEnrollment',
        label: 'Ghi danh HV',
        href: '/admin/ghi-danh-hoc-vien',
        icon: FilePlus2,
      },
      {
        id: 'timetable',
        label: 'Thời khóa biểu',
        href: '/admin/thoi-khoa-bieu',
        icon: CalendarClock,
      },
      { id: 'levels', label: 'Cấp độ', href: '/admin/collections/levels', icon: Layers },
      {
        id: 'attendance',
        label: 'Điểm danh',
        href: '/admin/diem-danh-nhanh',
        icon: ClipboardCheck,
      },
      { id: 'sessionEntry', label: 'Buổi học', href: '/admin/buoi-hoc', icon: NotebookPen },
      {
        id: 'sessionPlanning',
        label: 'Lập kế hoạch buổi',
        href: '/admin/lap-ke-hoach-lop',
        icon: CalendarDays,
      },
      {
        id: 'holidays',
        label: 'Lịch nghỉ',
        href: '/admin/collections/holidays',
        icon: CalendarOff,
      },
      {
        id: 'curriculumTemplates',
        label: 'Soạn khung lộ trình',
        href: '/admin/soan-khung-lo-trinh',
        icon: BookOpen,
      },
      {
        id: 'sessionFeedback',
        label: 'Nhận xét buổi',
        href: '/admin/nhan-xet-buoi',
        icon: MessageSquareText,
      },
      { id: 'teachingStats', label: 'Thống kê dạy', href: '/admin/thong-ke-day', icon: BarChart3 },
      {
        id: 'reports',
        label: 'Báo cáo tiến độ',
        href: '/admin/phat-hanh-bao-cao',
        icon: FileBarChart,
        badge: 'reports',
      },
    ],
  },
  {
    group: 'Tài chính',
    icon: Wallet,
    items: [
      { id: 'payments', label: 'Học phí · Thu', href: '/admin/nhap-hoc-phi', icon: Wallet },
      {
        id: 'tuitionPackages',
        label: 'Gói học phí',
        href: '/admin/collections/tuition-packages',
        icon: Package,
      },
      {
        id: 'renewals',
        label: 'Gia hạn',
        href: '/admin/duyet-gia-han',
        icon: RefreshCw,
        badge: 'renewals',
      },
      { id: 'debt', label: 'Công nợ', href: '/admin/cong-no', icon: ReceiptText },
      { id: 'sessionBalance', label: 'Số buổi tồn', href: '/admin/so-buoi-ton', icon: Hourglass },
      {
        id: 'expenses',
        label: 'Phiếu chi',
        href: '/admin/collections/expenses',
        icon: TrendingDown,
      },
      { id: 'refunds', label: 'Hoàn tiền', href: '/admin/collections/refunds', icon: Undo2 },
      { id: 'payroll', label: 'Bảng lương GV', href: '/admin/bang-luong', icon: Banknote },
    ],
  },
  {
    group: 'Nội dung website',
    icon: Newspaper,
    items: [
      { id: 'posts', label: 'Bài viết', href: '/admin/collections/posts', icon: Newspaper },
      { id: 'events', label: 'Sự kiện', href: '/admin/collections/events', icon: CalendarDays },
      {
        id: 'books',
        label: 'Sách nổi bật',
        href: '/admin/collections/featured-books',
        icon: BookOpen,
      },
      {
        id: 'webLocations',
        label: 'Lịch học cơ sở',
        href: '/admin/collections/web-locations',
        icon: MapPin,
      },
      {
        id: 'webCoaches',
        label: 'Huấn luyện viên (web)',
        href: '/admin/collections/web-coaches',
        icon: GraduationCap,
      },
      {
        id: 'webPrograms',
        label: 'Lớp đang tuyển (cũ)',
        href: '/admin/collections/web-programs',
        icon: Layers,
      },
    ],
  },
  {
    group: 'Hệ thống',
    icon: Settings,
    items: [
      {
        id: 'coaches',
        label: 'Giáo viên',
        href: '/admin/collections/coaches',
        icon: GraduationCap,
      },
      { id: 'locations', label: 'Cơ sở', href: '/admin/collections/locations', icon: MapPin },
      {
        id: 'dataHygiene',
        label: 'Dữ liệu cần hoàn thiện',
        href: '/admin/du-lieu-can-hoan-thien',
        icon: AlertTriangle,
      },
      { id: 'users', label: 'Người dùng', href: '/admin/collections/users', icon: ShieldCheck },
      { id: 'permissions', label: 'Phân quyền', href: '/admin/phan-quyen', icon: KeyRound },
      {
        id: 'audit',
        label: 'Nhật ký kiểm toán',
        href: '/admin/collections/audit-logs',
        icon: ScrollText,
      },
    ],
  },
]

/** Nhãn + màu vai trò (footer sidebar) — màu khớp design ROLES. */
export const ROLE_META: Record<UserRole, { label: string; color: string }> = {
  admin: { label: 'Quản trị viên', color: '#2b3990' },
  manager: { label: 'Quản lý', color: '#2275b4' },
  accountant: { label: 'Kế toán', color: '#3dbb95' },
  receptionist: { label: 'Lễ tân', color: '#e08c2e' },
  coach: { label: 'Giáo viên', color: '#7a5af8' },
  assistant: { label: 'Trợ giảng', color: '#2da44a' },
}

/** Tất cả route id (admin thấy hết). */
const ALL_ROUTES: NavItemId[] = NAV_GROUPS.flatMap((g) => g.items.map((it) => it.id))

/**
 * Route id mỗi vai trò được THẤY trong nav (port ROLE_NAV từ data.js).
 * `assistant` = coach thu hẹp (chỉ dashboard/classes/attendance/students).
 */
export const ROLE_NAV: Record<UserRole, NavItemId[]> = {
  admin: ALL_ROUTES,
  // 'permissions' (ma trận phân quyền) + 'audit' chỉ admin (view gate isAdmin).
  manager: ALL_ROUTES.filter((r) => r !== 'audit' && r !== 'permissions'),
  accountant: [
    'dashboard',
    'students',
    'classes',
    'payments',
    'tuitionPackages',
    'renewals',
    'debt',
    'expenses',
    'refunds',
    'payroll',
    'reports',
    'roster',
    'sessionBalance',
  ],
  receptionist: [
    'dashboard',
    'students',
    'classes',
    'attendance',
    'sessionEntry',
    'sessionPlanning',
    'sessionFeedback',
    'reports',
    'posts',
    'events',
    'books',
    'webLocations',
    'webCoaches',
    'webPrograms',
    'roster',
    'enrollments',
    'studentEnrollment',
    'timetable',
    'tuitionPackages',
  ],
  coach: [
    'dashboard',
    'students',
    'classes',
    'attendance',
    'sessionEntry',
    'sessionPlanning',
    'sessionFeedback',
    'teachingStats',
    'reports',
    'roster',
    'timetable',
  ],
  assistant: [
    'dashboard',
    'classes',
    'attendance',
    'sessionEntry',
    'sessionPlanning',
    'sessionFeedback',
    'teachingStats',
    'students',
    'roster',
    'timetable',
  ],
}

/** Thứ tự ưu tiên vai trò (cao → thấp) — chọn KPI/avatar/màu khi đa-role. */
const ROLE_PRECEDENCE: UserRole[] = [
  'admin',
  'manager',
  'accountant',
  'receptionist',
  'coach',
  'assistant',
]

/** Vai trò ưu tiên cao nhất trong mảng (để chọn bộ KPI + màu avatar). */
export function primaryRole(roles: UserRole[]): UserRole {
  for (const r of ROLE_PRECEDENCE) if (roles.includes(r)) return r
  return roles[0] ?? 'receptionist'
}

/** HỢP các route nav của mọi vai trò (đa-role thấy hợp các quyền UX). */
export function navForRoles(roles: UserRole[]): Set<NavItemId> {
  const out = new Set<NavItemId>()
  for (const r of roles) for (const id of ROLE_NAV[r] ?? []) out.add(id)
  return out
}

/** Nhãn ghép các vai trò theo thứ tự ưu tiên, vd "Quản lý · Giáo viên". */
export function roleLabels(roles: UserRole[]): string {
  const ordered = ROLE_PRECEDENCE.filter((r) => roles.includes(r))
  return ordered.map((r) => ROLE_META[r].label).join(' · ') || 'Nhân viên'
}

export interface QuickAction {
  href: string
  label: string
  icon: LucideIcon
  /** route id để lọc theo ROLE_NAV (chỉ hiện lối tắt người dùng có quyền thấy). */
  requires?: NavItemId
}

/**
 * "Tác vụ nhanh" — gập từ QuickActionsNav cũ vào sidebar mới. Lối tắt nghiệp vụ
 * chính; import đầy đủ vẫn ở list collection / view import. Lọc theo ROLE_NAV.
 */
export const QUICK_ACTIONS: QuickAction[] = [
  {
    href: '/admin/diem-danh-nhanh',
    label: 'Điểm danh nhanh',
    icon: ClipboardCheck,
    requires: 'attendance',
  },
  { href: '/admin/nhap-hoc-phi', label: 'Nhập học phí (Thu)', icon: Wallet, requires: 'payments' },
  { href: '/admin/phat-hanh-bao-cao', label: 'Phát hành báo cáo', icon: Send, requires: 'reports' },
  { href: '/admin/duyet-gia-han', label: 'Duyệt gia hạn', icon: CheckCheck, requires: 'renewals' },
  { href: '/admin/nhap-hoc-vien', label: 'Import đầu kỳ', icon: Upload, requires: 'students' },
  { href: '/admin/nhap-lop', label: 'Import lớp', icon: Upload, requires: 'classes' },
  { href: '/admin/nhap-ghi-danh', label: 'Import ghi danh', icon: Upload, requires: 'enrollments' },
]
