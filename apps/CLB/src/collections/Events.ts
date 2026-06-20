import type { CollectionConfig } from 'payload'
import { anyone, hasRole } from '../access'
import { DATE_TIME } from '../lib/admin-date'
import { codeField, EVENT_CODE_SPEC } from '../lib/codes/field'
import { makeCodeHook } from '../lib/codes/makeCodeHook'
import { lockCodeHook } from '../lib/codes/lockCodeHook'

/** Ghi nội dung website: chỉ nhân viên admin/manager/receptionist (đọc công khai). */
const canManageContent = hasRole('admin', 'manager', 'receptionist')

export const Events: CollectionConfig = {
  slug: 'events',
  access: {
    read: anyone,
    create: canManageContent,
    update: canManageContent,
    delete: canManageContent,
  },
  labels: {
    singular: 'Sự kiện',
    plural: 'Sự kiện',
  },
  admin: {
    group: 'Nội dung web',
    useAsTitle: 'title',
    defaultColumns: ['code', 'title', 'date', 'type'],
  },
  // `beforeChange`: tự sinh `code` GIAI-YYYY-NN (reset/năm theo `date`).
  // `beforeValidate`: KHÓA `code` bất biến.
  hooks: {
    beforeValidate: [lockCodeHook],
    beforeChange: [makeCodeHook(EVENT_CODE_SPEC)],
  },
  fields: [
    codeField,
    {
      name: 'title',
      type: 'text',
      label: 'Tiêu đề',
      required: true,
    },
    {
      name: 'date',
      type: 'date',
      label: 'Ngày diễn ra',
      required: true,
      admin: {
        date: DATE_TIME,
      },
    },
    {
      name: 'summary',
      type: 'textarea',
      label: 'Tóm tắt',
    },
    {
      name: 'description',
      type: 'richText',
      label: 'Mô tả chi tiết',
    },
    {
      name: 'coverImage',
      type: 'upload',
      label: 'Ảnh bìa',
      relationTo: 'media',
    },
    {
      name: 'type',
      type: 'select',
      label: 'Loại sự kiện',
      required: true,
      options: [
        { label: 'Khai giảng', value: 'khai_giang' },
        { label: 'Giải đấu', value: 'giai_dau' },
        { label: 'Workshop', value: 'workshop' },
        { label: 'Sự kiện cộng đồng', value: 'su_kien_cong_dong' },
        { label: 'Khác', value: 'khac' },
      ],
    },
  ],
}
