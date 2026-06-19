import type { CollectionConfig } from 'payload'
import { hasRole } from '../access'
import { staffOnly } from '../access/parents'

/**
 * Gói học phí — DANH MỤC dùng chung (tách khỏi `classes`, trước đây là array nhúng
 * `tuitionTiers`). Mỗi gói (vd "Gói 10 buổi") định nghĩa MỘT lần, rồi gắn (tùy chọn)
 * tới một/nhiều LỚP và/hoặc GÁN cho từng HỌC SINH.
 *
 * Phạm vi (🔒): thuần BACK-OFFICE — KHÔNG hiển thị học phí trên website công khai và
 * KHÔNG còn `read` public (khác `classes`). KHÔNG nối luồng tài chính (Payments/
 * TuitionCycles) — chỉ là danh mục + bản ghi gán. KHÔNG branch-scope (catalog toàn cục).
 *
 * Access: đọc = mọi nhân viên đăng nhập (`staffOnly`); ghi = admin/manager/receptionist
 * (giống quản trị nội dung lớp). Quan hệ đặt TRÊN gói (không thêm gì lên form lớp).
 */
const canManagePackages = hasRole('admin', 'manager', 'receptionist')

export const TuitionPackages: CollectionConfig = {
  slug: 'tuition-packages',
  labels: {
    singular: 'Gói học phí',
    plural: 'Gói học phí',
  },
  admin: {
    group: 'Tài chính',
    useAsTitle: 'tierName',
    defaultColumns: ['tierName', 'sessionCount', 'tuition'],
  },
  timestamps: true,
  access: {
    read: staffOnly,
    create: canManagePackages,
    update: canManagePackages,
    delete: canManagePackages,
  },
  fields: [
    {
      name: 'tierName',
      type: 'text',
      label: 'Tên gói',
      required: true,
    },
    {
      name: 'sessionCount',
      type: 'number',
      label: 'Số buổi',
      required: true,
      min: 1,
    },
    {
      name: 'tuition',
      type: 'number',
      label: 'Học phí (VNĐ)',
      required: true,
      min: 0,
    },
    {
      name: 'benefits',
      type: 'textarea',
      label: 'Quyền lợi',
    },
    {
      name: 'classes',
      type: 'relationship',
      label: 'Áp dụng cho lớp',
      relationTo: 'classes',
      hasMany: true,
      admin: {
        description: 'Các lớp áp dụng gói này (để trống = gói chung, không gắn lớp).',
      },
    },
    {
      name: 'students',
      type: 'relationship',
      label: 'Gán cho học sinh',
      relationTo: 'students',
      hasMany: true,
      admin: {
        description: 'Học viên được gán gói này (tùy chọn).',
      },
    },
  ],
}
