import type { CollectionConfig } from 'payload'
import { isAdmin } from '../access'

/**
 * Nhật ký kiểm toán (audit) 🔒 — mỗi thao tác ghi (create/update/delete) trên các
 * collection nhạy cảm (students, progress-reports, payments, users) sinh MỘT bản
 * ghi diff tối thiểu ở đây. Nguồn ghi: hook afterChange/afterDelete dùng chung ở
 * `lib/audit/log.ts` (ghi qua Local API `overrideAccess: true`).
 *
 * Access: CHỈ admin đọc. KHÔNG ai create qua API (chỉ hook hệ thống tạo). Chỉ
 * admin update/delete — để phục vụ retention/dọn rác; người dùng thường KHÔNG
 * sửa/xóa được audit. KHÔNG log secret/OTP (allowlist field ở lib/audit).
 */
export const AuditLogs: CollectionConfig = {
  slug: 'audit-logs',
  labels: {
    singular: 'Nhật ký kiểm toán',
    plural: 'Nhật ký kiểm toán',
  },
  admin: {
    useAsTitle: 'collectionSlug',
    defaultColumns: ['action', 'collectionSlug', 'documentId', 'actorLabel', 'user', 'createdAt'],
    group: 'Hệ thống',
  },
  timestamps: true,
  access: {
    // Bản ghi do hook hệ thống tạo (overrideAccess) — chặn create qua API.
    create: () => false,
    read: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'action',
      type: 'select',
      label: 'Thao tác',
      required: true,
      index: true,
      options: [
        { label: 'Tạo mới', value: 'create' },
        { label: 'Cập nhật', value: 'update' },
        { label: 'Xóa', value: 'delete' },
      ],
    },
    {
      name: 'collectionSlug',
      type: 'text',
      label: 'Collection',
      required: true,
      index: true,
      admin: {
        description: 'Slug collection bị tác động (students, payments, …).',
      },
    },
    {
      name: 'documentId',
      type: 'text',
      label: 'ID bản ghi',
      index: true,
    },
    {
      name: 'user',
      type: 'relationship',
      label: 'Nhân viên thực hiện',
      relationTo: 'users',
      admin: {
        description:
          'Chỉ gắn khi chủ thể là nhân viên (Users). Phụ huynh/hệ thống xem cột "Chủ thể".',
      },
    },
    {
      name: 'actorLabel',
      type: 'text',
      label: 'Chủ thể',
      admin: {
        description: 'Nhãn chủ thể: email nhân viên, parent:<id>, system hoặc unknown.',
      },
    },
    {
      name: 'diff',
      type: 'json',
      label: 'Diff',
      admin: {
        description:
          'create/update: { changes: { field: { from, to } } }. delete: { snapshot: { field } }. Giá trị đã nén (quan hệ→id, richText/chuỗi dài→cắt ngắn).',
      },
    },
  ],
}
