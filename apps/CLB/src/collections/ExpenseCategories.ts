import type { CollectionConfig } from 'payload'
import { hasRole } from '../access'

/**
 * Danh mục khoản chi — phân loại phiếu chi (lương, mặt bằng, marketing, dụng cụ…).
 * Tách khỏi `expenses` để chuẩn hóa (1 danh mục dùng cho nhiều phiếu) — thay cho
 * bảng Lark `Khoản chi`.
 *
 * Access (🔒 tài chính, KHÔNG phải nội dung công khai):
 *  - đọc: kế toán + quản lý + admin.
 *  - ghi: kế toán + admin (quản lý chỉ xem).
 * Phụ huynh (collection `parents`) KHÔNG có role ⇒ mọi gate `hasRole` đều chặn.
 */
const canReadFinance = hasRole('admin', 'manager', 'accountant')
const canWriteFinance = hasRole('admin', 'accountant')

export const ExpenseCategories: CollectionConfig = {
  slug: 'expense-categories',
  labels: {
    singular: 'Danh mục chi',
    plural: 'Danh mục chi',
  },
  admin: {
    group: 'Tài chính',
    useAsTitle: 'name',
    defaultColumns: ['name', 'active', 'description'],
  },
  timestamps: true,
  access: {
    create: canWriteFinance,
    read: canReadFinance,
    update: canWriteFinance,
    delete: canWriteFinance,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Tên danh mục',
      required: true,
    },
    {
      name: 'active',
      type: 'checkbox',
      label: 'Đang dùng',
      defaultValue: true,
      admin: {
        description: 'Bỏ tick để ẩn danh mục không còn sử dụng (không xóa lịch sử).',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Mô tả',
    },
  ],
}
