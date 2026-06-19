import type { CollectionConfig } from 'payload';
import { staffOnly, readByStudentRelation } from '../access/parents';
import { withBranchScope } from '../access/branch';
import { DATE_ONLY } from '../lib/admin-date';

/**
 * Cấp độ của học viên (StudentLevels) — lịch sử học viên qua từng cấp.
 *
 * Access control (Claude Code 🔒): phụ huynh CHỈ đọc bản ghi của con mình
 * (lọc DB-level qua `readByStudentRelation` theo field `student`); ghi chỉ
 * nhân viên. Cùng access function với ProgressReports/Attendance để cách ly
 * dữ liệu chéo giữa các phụ huynh.
 */
export const StudentLevels: CollectionConfig = {
  slug: 'student-levels',
  labels: {
    singular: 'Cấp độ học viên',
    plural: 'Cấp độ học viên',
  },
  admin: {
    group: 'Học viên & Phụ huynh',
    useAsTitle: 'id',
    defaultColumns: ['student', 'level', 'trangThai', 'ngayBatDau'],
  },
  timestamps: true,
  access: {
    create: staffOnly,
    // 🔒 Branch-scope theo `student.location`: nhân viên bị-khóa-cơ-sở chỉ
    // đọc/sửa/xóa bản ghi của HV cùng cơ sở; vai trò global xem/ghi tất. Luồng
    // phụ huynh giữ NGUYÊN (gate trả Where ⇒ withBranchScope trả nguyên).
    // `create` KHÔNG scope.
    read: withBranchScope(readByStudentRelation(), 'student.location'),
    update: withBranchScope(staffOnly, 'student.location'),
    delete: withBranchScope(staffOnly, 'student.location'),
  },
  fields: [
    {
      name: 'student',
      type: 'relationship',
      label: 'Học viên',
      relationTo: 'students',
      required: true,
    },
    {
      name: 'level',
      type: 'relationship',
      label: 'Cấp độ',
      relationTo: 'levels',
      required: true,
    },
    {
      name: 'trangThai',
      type: 'select',
      label: 'Trạng thái',
      options: [
        { label: 'Đang học', value: 'dang_hoc' },
        { label: 'Đã hoàn thành', value: 'da_hoan_thanh' },
      ],
    },
    {
      name: 'ngayBatDau',
      type: 'date',
      label: 'Ngày bắt đầu',
      admin: { date: DATE_ONLY },
    },
  ],
};
