import type { CollectionConfig } from 'payload'
import { staffOnly } from '../access/parents'
import { withBranchScope } from '../access/branch'
import { buildAuditHooks } from '../lib/audit/log'

/**
 * Kế hoạch buổi học THEO TỪNG HỌC VIÊN (V1.1) — nội dung cá nhân hóa cho 1 HV
 * trong 1 buổi (`class-sessions`). MỘT dòng = (buổi × HV).
 *
 * MÔ HÌNH kế thừa + ghi đè: chỉ lưu OVERRIDE (field trống = kế thừa nội dung cả
 * lớp ở `class-sessions`). Hiển thị effective = `plan.field ?? session.field`.
 *
 * 🔒 RANH GIỚI TÍNH HỌC PHÍ: bảng này HOÀN TOÀN tách `attendance` — KHÔNG bao giờ
 * sinh điểm danh, KHÔNG nằm trong truy vấn đếm `co_mat`. Lập kế hoạch không trừ
 * buổi/không tính tiền (chỉ `attendance.status='co_mat'` trong cửa sổ chu kỳ mới
 * tính — `lib/operations/session-balance.ts`).
 *
 * Access (fail-closed, branch-scope qua `student.location` — mẫu Enrollments):
 *  - read/update/delete: staff bị-khóa-cơ-sở chỉ thao tác kế hoạch của HV cùng cơ
 *    sở; vai trò global thấy tất. `create` KHÔNG scope (giống attendance/enrollments;
 *    defense-in-depth: core kiểm buổi visible + HV thuộc roster trước khi ghi).
 */
export const SessionStudentPlans: CollectionConfig = {
  slug: 'session-student-plans',
  labels: {
    singular: 'Kế hoạch buổi theo HV',
    plural: 'Kế hoạch buổi theo HV',
  },
  admin: {
    group: 'Đào tạo',
    useAsTitle: 'khoaKeHoach',
    defaultColumns: ['session', 'student', 'sachDangHoc'],
    hidden: true, // thao tác qua trang /admin/lap-ke-hoach-lop, không vào nav
  },
  timestamps: true,
  access: {
    create: staffOnly,
    read: withBranchScope(staffOnly, 'student.location'),
    update: withBranchScope(staffOnly, 'student.location'),
    delete: withBranchScope(staffOnly, 'student.location'),
  },
  hooks: buildAuditHooks('session-student-plans'),
  fields: [
    {
      name: 'session',
      type: 'relationship',
      label: 'Buổi học',
      relationTo: 'class-sessions',
      required: true,
    },
    {
      name: 'student',
      type: 'relationship',
      label: 'Học viên',
      relationTo: 'students',
      required: true,
    },
    {
      name: 'mucTieu',
      type: 'textarea',
      label: 'Mục tiêu (riêng HV)',
    },
    {
      name: 'sachDangHoc',
      type: 'text',
      label: 'Sách đang học (riêng HV)',
    },
    {
      name: 'kienThucMoi',
      type: 'textarea',
      label: 'Kiến thức mới (riêng HV)',
    },
    {
      name: 'giaoBTVN',
      type: 'textarea',
      label: 'Giao BTVN (riêng HV)',
    },
    {
      name: 'khBuoiSau',
      type: 'textarea',
      label: 'Kế hoạch buổi sau (riêng HV)',
    },
    {
      name: 'khoaKeHoach',
      type: 'text',
      label: 'Khóa chống trùng',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Khóa idempotent: session|student.',
      },
    },
  ],
}
