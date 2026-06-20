import type { CollectionConfig } from 'payload'
import { staffOnly } from '../access/parents'

/**
 * Nhật ký import — mỗi lần nhân viên XÁC NHẬN ghi (commit) một file import sẽ
 * sinh một bản ghi ở đây (loại, tên file, người thực hiện, số tạo/cập nhật/bỏ
 * qua/lỗi, ghi chú tổng kết, mẫu lỗi). Phục vụ truy vết: ai nhập gì, khi nào,
 * kết quả ra sao.
 *
 * Access: CHỈ nhân viên (staff) đọc/xóa. Bản ghi BẤT BIẾN (update bị chặn) để
 * nhật ký không bị sửa sau khi tạo. Bản ghi do Server Action tạo qua
 * overrideAccess — không phụ thuộc create access ở đây.
 */
export const ImportLogs: CollectionConfig = {
  slug: 'import-logs',
  labels: {
    singular: 'Nhật ký import',
    plural: 'Nhật ký import',
  },
  admin: {
    useAsTitle: 'fileName',
    defaultColumns: [
      'fileName',
      'kind',
      'user',
      'rowsCreated',
      'rowsUpdated',
      'rowsErrors',
      'createdAt',
    ],
    group: 'Nhập liệu',
  },
  timestamps: true,
  access: {
    read: staffOnly,
    create: staffOnly,
    update: () => false,
    delete: staffOnly,
  },
  fields: [
    {
      name: 'kind',
      type: 'select',
      label: 'Loại',
      required: true,
      options: [
        { label: 'Học viên', value: 'students' },
        { label: 'Điểm danh / nhận xét buổi', value: 'attendance' },
        { label: 'Đánh giá định kỳ', value: 'progress-reports' },
        { label: 'Giáo viên', value: 'coaches' },
        { label: 'Thanh toán', value: 'payments' },
        { label: 'Lớp học', value: 'classes' },
        { label: 'Ghi danh', value: 'enrollments' },
        { label: 'Lập kế hoạch buổi học', value: 'session-planning' },
        { label: 'Áp khung lộ trình', value: 'curriculum-apply' },
      ],
    },
    {
      name: 'fileName',
      type: 'text',
      label: 'Tên file',
      required: true,
    },
    {
      name: 'user',
      type: 'relationship',
      label: 'Người thực hiện',
      relationTo: 'users',
    },
    {
      name: 'rowsTotal',
      type: 'number',
      label: 'Tổng dòng',
    },
    {
      name: 'rowsCreated',
      type: 'number',
      label: 'Tạo mới',
    },
    {
      name: 'rowsUpdated',
      type: 'number',
      label: 'Cập nhật',
    },
    {
      name: 'rowsSkipped',
      type: 'number',
      label: 'Bỏ qua (trùng)',
    },
    {
      name: 'rowsErrors',
      type: 'number',
      label: 'Lỗi',
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'Ghi chú tổng kết',
    },
    {
      name: 'errorSample',
      type: 'textarea',
      label: 'Mẫu dòng lỗi',
      admin: {
        description: 'Một số dòng lỗi đầu tiên để truy vết nhanh.',
      },
    },
  ],
}
