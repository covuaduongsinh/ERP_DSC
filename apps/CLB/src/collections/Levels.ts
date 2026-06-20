import type { CollectionConfig } from 'payload'
import { staffOnly } from '../access/parents'
import { anyone } from '../access'

/**
 * Cấp độ (Levels) — danh mục cấp trong lộ trình học.
 *
 * Reference data: đọc công khai (như Classes), ghi chỉ nhân viên.
 * Thay thế field enum `currentLevel` cũ trên Students bằng quan hệ tới bảng này
 * (Students.capChinh) + lịch sử qua StudentLevels.
 */
export const Levels: CollectionConfig = {
  slug: 'levels',
  labels: {
    singular: 'Cấp độ',
    plural: 'Cấp độ',
  },
  admin: {
    group: 'Đào tạo',
    useAsTitle: 'tenTat',
    defaultColumns: ['tenTat', 'tenDayDu', 'thuTu'],
  },
  access: {
    read: anyone,
    create: staffOnly,
    update: staffOnly,
    delete: staffOnly,
  },
  fields: [
    {
      name: 'tenTat',
      type: 'text',
      label: 'Tên tắt',
      required: true,
      unique: true,
    },
    {
      name: 'tenDayDu',
      type: 'text',
      label: 'Tên đầy đủ',
    },
    {
      name: 'thuTu',
      type: 'number',
      label: 'Thứ tự',
    },
  ],
}
