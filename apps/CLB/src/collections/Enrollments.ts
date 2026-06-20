import type { CollectionConfig } from 'payload'
import { staffOnly, readByStudentRelation } from '../access/parents'
import { withBranchScope } from '../access/branch'
import { buildAuditHooks } from '../lib/audit/log'
import { DATE_ONLY } from '../lib/admin-date'
import { codeField, ENROLLMENT_CODE_SPEC } from '../lib/codes/field'
import { makeCodeHook } from '../lib/codes/makeCodeHook'
import { lockCodeHook } from '../lib/codes/lockCodeHook'

/**
 * Ghi danh lớp (Enrollments) — học viên thuộc lớp nào, giai đoạn nào.
 *
 * Access control (Claude Code 🔒): phụ huynh CHỈ đọc bản ghi của con mình
 * (lọc DB-level qua `readByStudentRelation` theo field `student`); ghi chỉ
 * nhân viên. Thay thế field `class` đơn lẻ trên Students bằng quan hệ lịch sử.
 */
export const Enrollments: CollectionConfig = {
  slug: 'enrollments',
  labels: {
    singular: 'Ghi danh',
    plural: 'Ghi danh',
  },
  admin: {
    group: 'Học viên & Phụ huynh',
    useAsTitle: 'id',
    defaultColumns: ['code', 'student', 'class', 'dangHoc', 'ngayBatDau', 'ngayKetThuc'],
  },
  timestamps: true,
  hooks: {
    ...buildAuditHooks('enrollments'),
    beforeValidate: [lockCodeHook],
    beforeChange: [makeCodeHook(ENROLLMENT_CODE_SPEC)],
  },
  access: {
    create: staffOnly,
    // 🔒 Branch-scope theo `student.location`: nhân viên bị-khóa-cơ-sở chỉ
    // đọc/sửa/xóa ghi danh của HV cùng cơ sở; vai trò global xem/ghi tất. Luồng
    // phụ huynh giữ NGUYÊN (gate trả Where ⇒ withBranchScope trả nguyên).
    // `create` KHÔNG scope.
    read: withBranchScope(readByStudentRelation(), 'student.location'),
    update: withBranchScope(staffOnly, 'student.location'),
    delete: withBranchScope(staffOnly, 'student.location'),
  },
  fields: [
    codeField,
    {
      name: 'student',
      type: 'relationship',
      label: 'Học viên',
      relationTo: 'students',
      required: true,
    },
    {
      name: 'class',
      type: 'relationship',
      label: 'Lớp',
      relationTo: 'classes',
      required: true,
    },
    {
      name: 'ngayBatDau',
      type: 'date',
      label: 'Ngày bắt đầu',
      admin: { date: DATE_ONLY },
    },
    {
      name: 'ngayKetThuc',
      type: 'date',
      label: 'Ngày kết thúc',
      admin: { date: DATE_ONLY },
    },
    {
      name: 'dangHoc',
      type: 'checkbox',
      label: 'Đang học',
    },
  ],
}
