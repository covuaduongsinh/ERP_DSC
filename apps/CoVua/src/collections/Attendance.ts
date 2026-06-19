import type { CollectionConfig } from 'payload';
import { staffOnly, readByStudentRelation } from '../access/parents';
import { withBranchScope } from '../access/branch';
import { DATE_ONLY } from '../lib/admin-date';

/**
 * Điểm danh (tùy chọn) — schema GĐ4 (access control: Claude Code).
 */
export const Attendance: CollectionConfig = {
  slug: 'attendance',
  labels: {
    singular: 'Điểm danh',
    plural: 'Điểm danh',
  },
  admin: {
    group: 'Đào tạo',
    useAsTitle: 'date',
    defaultColumns: ['date', 'student', 'status'],
    components: {
      beforeListTable: ['/components/admin/export/ExportButtons#ExportButtons'],
    },
  },
  timestamps: true,
  access: {
    create: staffOnly,
    // 🔒 Branch-scope theo `student.location`: nhân viên bị-khóa-cơ-sở chỉ
    // đọc/sửa/xóa bản ghi của HV cùng cơ sở; vai trò global xem/ghi tất. Luồng
    // phụ huynh giữ NGUYÊN (gate trả Where ⇒ withBranchScope trả nguyên).
    // `create` KHÔNG scope (importer/Server Action/nhập tay).
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
      name: 'date',
      type: 'date',
      label: 'Ngày học',
      required: true,
      admin: { date: DATE_ONLY },
    },
    {
      name: 'status',
      type: 'select',
      label: 'Trạng thái',
      required: true,
      options: [
        { label: 'Có mặt', value: 'co_mat' },
        { label: 'Vắng', value: 'vang' },
        { label: 'Phép', value: 'phep' },
      ],
    },
    {
      name: 'note',
      type: 'textarea',
      label: 'Ghi chú',
    },
    // ── Nhận xét buổi học (khớp file NhanXetBuoi_long.csv) ────────────────
    {
      name: 'buoi',
      type: 'text',
      label: 'Buổi',
      admin: {
        description: 'Mã buổi/khối học (vd B1_2025, C44). Thành phần khóa chống trùng.',
      },
    },
    {
      name: 'coach',
      type: 'relationship',
      label: 'GV phụ trách',
      relationTo: 'coaches',
      admin: {
        description: 'Khớp theo Tên tắt (tenTat) khi import. Để trống nếu không khớp.',
      },
    },
    {
      name: 'lop',
      type: 'relationship',
      label: 'Lớp',
      relationTo: 'classes',
    },
    {
      name: 'lamBTVN',
      type: 'number',
      label: 'Làm BTVN',
      admin: {
        description: 'Mức độ làm bài tập về nhà (số). Giá trị chữ trong file được bỏ qua.',
      },
    },
    {
      name: 'yThuc',
      type: 'number',
      label: 'Ý thức',
      min: 1,
      max: 10,
      admin: {
        description: 'Điểm ý thức 1–10. Giá trị ngoài khoảng được bỏ qua khi import.',
      },
    },
    {
      name: 'kienThucMoi',
      type: 'textarea',
      label: 'Kiến thức mới',
    },
    {
      name: 'nhanXet',
      type: 'textarea',
      label: 'Nhận xét',
    },
    {
      name: 'giaoBTVN',
      type: 'textarea',
      label: 'Giao BTVN',
    },
    {
      name: 'khBuoiSau',
      type: 'textarea',
      label: 'Kế hoạch buổi sau',
    },
    {
      name: 'sachDangHoc',
      type: 'text',
      label: 'Sách đang học',
    },
    {
      name: 'linkLichess',
      type: 'text',
      label: 'Link Lichess',
    },
    {
      name: 'session',
      type: 'relationship',
      label: 'Buổi học',
      relationTo: 'class-sessions',
      admin: {
        description:
          'Buổi học tương ứng (suy từ lớp + ngày qua ensureSession). Để trống với bản ghi cũ / không có lớp.',
      },
    },
    {
      name: 'khoa',
      type: 'text',
      label: 'Khóa chống trùng',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description:
          'Khóa định danh idempotent khi import nhận xét buổi: co_so|buoi|ten_hoc_vien. Để trống với điểm danh nhập tay.',
      },
    },
  ],
};
