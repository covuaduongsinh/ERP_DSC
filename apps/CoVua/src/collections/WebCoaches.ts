import type { CollectionConfig } from 'payload'
import { anyone, hasRole } from '../access'

/** Ghi nội dung website: chỉ nhân viên admin/manager/receptionist (đọc công khai). */
const canManageContent = hasRole('admin', 'manager', 'receptionist')

/**
 * Huấn luyện viên HIỂN THỊ WEBSITE — curated, tách hẳn collection `coaches` vận hành
 * (nhập hồ sơ sạch riêng: ảnh/tiểu sử upload tại đây). Trang Huấn luyện viên chỉ hiện
 * các bản ghi trong collection này (vd 4 HLV chính), không phải toàn bộ GV nội bộ.
 */
export const WebCoaches: CollectionConfig = {
  slug: 'web-coaches',
  access: {
    read: anyone,
    create: canManageContent,
    update: canManageContent,
    delete: canManageContent,
  },
  labels: {
    singular: 'Huấn luyện viên (web)',
    plural: 'Huấn luyện viên (web)',
  },
  admin: {
    group: 'Nội dung website',
    useAsTitle: 'name',
    defaultColumns: ['name', 'role', 'order'],
  },
  defaultSort: 'order',
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Tên hiển thị',
      required: true,
    },
    {
      name: 'photo',
      type: 'upload',
      label: 'Ảnh đại diện',
      relationTo: 'media',
    },
    {
      name: 'role',
      type: 'text',
      label: 'Vai trò',
      admin: { description: 'Vd: "Huấn luyện viên trưởng", "Huấn luyện viên".' },
    },
    {
      name: 'titles',
      type: 'array',
      label: 'Danh hiệu / Chứng chỉ',
      labels: { singular: 'Danh hiệu', plural: 'Danh hiệu' },
      fields: [
        {
          name: 'title',
          type: 'text',
          label: 'Nội dung',
          required: true,
        },
      ],
    },
    {
      name: 'bio',
      type: 'richText',
      label: 'Tiểu sử',
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
