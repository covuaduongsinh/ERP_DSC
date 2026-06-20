import type { CollectionConfig } from 'payload'
import { anyone, hasRole } from '../access'

/** Ghi nội dung website: chỉ nhân viên admin/manager/receptionist (đọc công khai). */
const canManageContent = hasRole('admin', 'manager', 'receptionist')

/**
 * Lịch học theo cơ sở — NỘI DUNG WEBSITE curated, tách hẳn collection `locations`
 * vận hành. Frontend (trang chủ + Lịch khai giảng) đọc collection này; sửa lịch chỉ
 * cần đổi ở đây, không đụng code, không lộ dữ liệu vận hành.
 */
export const WebLocations: CollectionConfig = {
  slug: 'web-locations',
  access: {
    read: anyone,
    create: canManageContent,
    update: canManageContent,
    delete: canManageContent,
  },
  labels: {
    singular: 'Lịch học cơ sở',
    plural: 'Lịch học cơ sở',
  },
  admin: {
    group: 'Nội dung website',
    useAsTitle: 'name',
    defaultColumns: ['name', 'lichHocNgay', 'order'],
  },
  defaultSort: 'order',
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Tên cơ sở',
      required: true,
      admin: { description: 'Vd: "Cơ sở Vĩnh Phúc".' },
    },
    {
      name: 'address',
      type: 'textarea',
      label: 'Địa chỉ',
      required: true,
    },
    {
      name: 'mapUrl',
      type: 'text',
      label: 'Link bản đồ',
      admin: { description: 'Link Google Maps (mở tab mới khi bấm "Xem bản đồ").' },
    },
    {
      name: 'lichHocNgay',
      type: 'text',
      label: 'Ngày học',
      admin: { description: 'Vd: "Thứ 2 · Thứ 6" hoặc "Tối Thứ 3 · Thứ 5 · Thứ 7".' },
    },
    {
      name: 'lichHocGio',
      type: 'array',
      label: 'Khung giờ',
      labels: { singular: 'Ca', plural: 'Ca' },
      admin: { description: 'Mỗi dòng một ca. Vd: "Ca 1: 18h00–19h15".' },
      fields: [
        {
          name: 'gio',
          type: 'text',
          label: 'Giờ',
          required: true,
        },
      ],
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
