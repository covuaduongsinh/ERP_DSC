import type { CollectionConfig } from 'payload'
import { anyone, hasRole } from '../access'
import { DATE_TIME } from '../lib/admin-date'

/** Ghi nội dung website: chỉ nhân viên admin/manager/receptionist (đọc công khai). */
const canManageContent = hasRole('admin', 'manager', 'receptionist')

export const Posts: CollectionConfig = {
  slug: 'posts',
  access: {
    read: anyone,
    create: canManageContent,
    update: canManageContent,
    delete: canManageContent,
  },
  labels: {
    singular: 'Bài viết',
    plural: 'Blog',
  },
  admin: {
    group: 'Nội dung web',
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'publishedAt'],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Tiêu đề',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      label: 'Slug',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Đường dẫn URL, ví dụ: khai-giang-lop-ma-thang-3',
      },
    },
    {
      name: 'excerpt',
      type: 'textarea',
      label: 'Tóm tắt',
    },
    {
      name: 'content',
      type: 'richText',
      label: 'Nội dung',
      required: true,
    },
    {
      name: 'coverImage',
      type: 'upload',
      label: 'Ảnh bìa',
      relationTo: 'media',
    },
    {
      name: 'category',
      type: 'select',
      label: 'Danh mục',
      required: true,
      options: [
        { label: 'Tin tức', value: 'tin_tuc' },
        { label: 'Kiến thức cờ vua', value: 'kien_thuc_co_vua' },
        { label: 'Sự kiện', value: 'su_kien' },
        { label: 'Hoạt động', value: 'hoat_dong' },
        { label: 'Khác', value: 'khac' },
      ],
    },
    {
      name: 'author',
      type: 'relationship',
      label: 'Tác giả',
      relationTo: ['coaches', 'users'],
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'Ngày xuất bản',
      admin: {
        date: DATE_TIME,
      },
    },
    {
      name: 'seo',
      type: 'group',
      label: 'SEO',
      fields: [
        {
          name: 'metaTitle',
          type: 'text',
          label: 'Meta title',
        },
        {
          name: 'metaDescription',
          type: 'textarea',
          label: 'Meta description',
        },
      ],
    },
  ],
}
