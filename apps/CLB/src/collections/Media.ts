import type { CollectionConfig } from 'payload'
import { anyone, hasRole } from '../access'

/**
 * Media là kho upload dùng chung: ảnh nội dung (admin/manager/receptionist) +
 * ảnh bill thanh toán `anhBill` (accountant). Đọc công khai; ghi cần một trong
 * các role này. (Phụ huynh đăng nhập KHÔNG ghi được.)
 */
const canManageMedia = hasRole('admin', 'manager', 'receptionist', 'accountant')

const sanitizeFilename = (name: string): string => {
  const lastDot = name.lastIndexOf('.')
  const ext = lastDot > -1 ? name.slice(lastDot) : ''
  const base = lastDot > -1 ? name.slice(0, lastDot) : name
  const cleaned = base
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .toLowerCase()
  return `${cleaned || 'file'}${ext.toLowerCase()}`
}

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    group: 'Nội dung web',
  },
  access: {
    read: anyone,
    create: canManageMedia,
    update: canManageMedia,
    delete: canManageMedia,
  },
  hooks: {
    beforeOperation: [
      ({ req, operation }) => {
        if ((operation === 'create' || operation === 'update') && req.file?.name) {
          req.file.name = sanitizeFilename(req.file.name)
        }
      },
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  upload: {
    bulkUpload: false,
  },
}
