import type { CollectionConfig } from 'payload'
import { anyone, hasRole } from '../access'

/** Ghi nội dung website: chỉ nhân viên admin/manager/receptionist (đọc công khai). */
const canManageContent = hasRole('admin', 'manager', 'receptionist')

/**
 * @deprecated Tuyến lớp curated (Nhập môn / Cơ bản / Nâng cao). Website nay liệt kê
 * LỚP THẬT theo 6 cấp từ collection `classes` (xem `OpenClassesSection`), nên collection
 * này KHÔNG còn được render ở frontend. Giữ bảng (không drop để tránh mất dữ liệu) — gỡ
 * hẳn ở một dọn dẹp sau khi đã chắc không còn phụ thuộc.
 */
export const WebPrograms: CollectionConfig = {
  slug: 'web-programs',
  access: {
    read: anyone,
    create: canManageContent,
    update: canManageContent,
    delete: canManageContent,
  },
  labels: {
    singular: 'Lớp đang tuyển (cũ)',
    plural: 'Lớp đang tuyển (cũ)',
  },
  admin: {
    group: 'Nội dung website',
    useAsTitle: 'name',
    defaultColumns: ['name', 'order'],
    description:
      'Không còn hiển thị trên website (website nay dùng lớp thật theo 6 cấp). Giữ tạm để tham khảo.',
  },
  defaultSort: 'order',
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Tên tuyến lớp',
      required: true,
      admin: { description: 'Vd: "Nhập môn", "Cơ bản", "Nâng cao".' },
    },
    {
      name: 'shortDesc',
      type: 'textarea',
      label: 'Mô tả ngắn',
    },
    {
      name: 'order',
      type: 'number',
      label: 'Thứ tự hiển thị',
      defaultValue: 0,
      admin: { description: 'Số nhỏ hơn hiển thị trước.' },
    },
  ],
}
