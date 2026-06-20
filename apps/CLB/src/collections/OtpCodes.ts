import type { CollectionConfig } from 'payload'
import { DATE_TIME } from '../lib/admin-date'

/**
 * Lưu OTP đã băm + metadata. KHÔNG ai (kể cả staff) đọc/sửa qua API —
 * chỉ Server Actions truy cập trực tiếp qua Payload Local API với
 * `overrideAccess: true`. Không phơi ra REST.
 *
 * Tại sao tách collection riêng thay vì cache in-memory:
 * - Sống sót khi serverless cold start / restart.
 * - Audit được số lần gửi/verify (debug khi anh chuyển sang provider thật).
 */
export const OtpCodes: CollectionConfig = {
  slug: 'otp-codes',
  labels: {
    singular: 'OTP',
    plural: 'OTP',
  },
  admin: {
    hidden: true, // Ẩn khỏi sidebar /admin
  },
  access: {
    create: () => false,
    read: () => false,
    update: () => false,
    delete: () => false,
  },
  fields: [
    {
      name: 'phone',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'codeHash',
      type: 'text',
      required: true,
    },
    {
      name: 'expiresAt',
      type: 'date',
      required: true,
      admin: { date: DATE_TIME },
    },
    {
      name: 'consumedAt',
      type: 'date',
      admin: { date: DATE_TIME },
    },
    {
      name: 'attempts',
      type: 'number',
      defaultValue: 0,
      min: 0,
    },
  ],
}
