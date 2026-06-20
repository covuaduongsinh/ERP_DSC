import type { CollectionConfig } from 'payload'
import { anyone, hasRole } from '../access'
import { chessLevelSelectOptions } from '../lib/roadmap'

/** Ghi nội dung website: chỉ nhân viên admin/manager/receptionist (đọc công khai). */
const canManageContent = hasRole('admin', 'manager', 'receptionist')

export const FeaturedBooks: CollectionConfig = {
  slug: 'featured-books',
  access: {
    read: anyone,
    create: canManageContent,
    update: canManageContent,
    delete: canManageContent,
  },
  labels: {
    singular: 'Sách nổi bật',
    plural: 'Sách nổi bật',
  },
  admin: {
    group: 'Sách',
    useAsTitle: 'title',
    defaultColumns: ['title', 'level'],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Tên sách',
      required: true,
    },
    {
      name: 'image',
      type: 'upload',
      label: 'Ảnh bìa',
      relationTo: 'media',
      required: true,
    },
    {
      name: 'shortDesc',
      type: 'textarea',
      label: 'Mô tả ngắn',
    },
    {
      name: 'level',
      type: 'select',
      label: 'Lộ trình',
      options: chessLevelSelectOptions(),
    },
    {
      name: 'sapoUrl',
      type: 'text',
      label: 'Link Sapo',
      required: true,
      admin: {
        description: 'Deep-link sang duongsinhbook.com (Sapo).',
      },
    },
  ],
}
