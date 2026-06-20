import type { CollectionConfig } from 'payload'
import { hasRole } from '../access'
import { DATE_ONLY } from '../lib/admin-date'
import { buildAuditHooks } from '../lib/audit/log'
import { codeField, REFUND_CODE_SPEC } from '../lib/codes/field'
import { makeCodeHook } from '../lib/codes/makeCodeHook'
import { lockCodeHook } from '../lib/codes/lockCodeHook'

/**
 * Hoàn tiền — MỘT lần trả tiền lại cho học viên/phụ huynh (hủy lớp, nộp dư, đổi
 * lớp rẻ hơn…). Là vế "tiền ra" của doanh thu: KPI tính **doanh thu thuần =
 * Tổng Thu − Tổng Hoàn** (xem `lib/kpi/*`).
 *
 * Access (🔒 tài chính, GIỐNG expenses): đọc admin/manager/accountant; ghi
 * admin/accountant. KHÔNG dùng `readByStudentRelation` — đây là sổ tài chính nội
 * bộ (không mở cho cổng phụ huynh). Audit: `buildAuditHooks('refunds')`.
 */
const canReadFinance = hasRole('admin', 'manager', 'accountant')
const canWriteFinance = hasRole('admin', 'accountant')

export const Refunds: CollectionConfig = {
  slug: 'refunds',
  labels: {
    singular: 'Hoàn tiền',
    plural: 'Hoàn tiền',
  },
  admin: {
    group: 'Tài chính',
    useAsTitle: 'ngayHoan',
    defaultColumns: ['code', 'ngayHoan', 'student', 'soTien', 'coSo', 'lyDo'],
  },
  timestamps: true,
  access: {
    create: canWriteFinance,
    read: canReadFinance,
    update: canWriteFinance,
    delete: canWriteFinance,
  },
  hooks: {
    ...buildAuditHooks('refunds'),
    beforeValidate: [lockCodeHook],
    beforeChange: [makeCodeHook(REFUND_CODE_SPEC)],
  },
  fields: [
    codeField,
    {
      name: 'student',
      type: 'relationship',
      label: 'Học viên',
      relationTo: 'students',
      required: true,
    },
    {
      name: 'soTien',
      type: 'number',
      label: 'Số tiền hoàn (VNĐ)',
      required: true,
      min: 0,
    },
    {
      name: 'ngayHoan',
      type: 'date',
      label: 'Ngày hoàn',
      required: true,
      admin: { date: DATE_ONLY },
    },
    {
      name: 'lyDo',
      type: 'textarea',
      label: 'Lý do',
      required: true,
    },
    {
      name: 'coSo',
      type: 'select',
      label: 'Cơ sở',
      options: [
        { label: 'Kim Liên', value: 'kim_lien' },
        { label: 'Vĩnh Phúc', value: 'vinh_phuc' },
      ],
    },
    {
      name: 'phuongThuc',
      type: 'select',
      label: 'Hình thức',
      options: [
        { label: 'Tiền mặt', value: 'tien_mat' },
        { label: 'Chuyển khoản', value: 'ck' },
      ],
    },
    {
      name: 'note',
      type: 'textarea',
      label: 'Ghi chú',
    },
  ],
}
