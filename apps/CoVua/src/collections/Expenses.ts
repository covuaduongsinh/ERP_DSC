import type { CollectionConfig, CollectionBeforeChangeHook, FieldAccess } from 'payload'
import { hasRole } from '../access'
import { DATE_ONLY } from '../lib/admin-date'
import { buildAuditHooks } from '../lib/audit/log'

/**
 * Phiếu chi — MỘT khoản chi của trung tâm (lương, mặt bằng, marketing, mua dụng
 * cụ…). Thay cho bảng Lark `Tổng hợp Chi`. Cùng với `payments` (Thu), đây là vế
 * CHI để dựng dòng tiền Thu − Chi theo tháng/cơ sở.
 *
 * Access (🔒 tài chính):
 *  - đọc: kế toán + quản lý + admin; ghi: kế toán + admin.
 *  - Phụ huynh KHÔNG có role ⇒ bị chặn hoàn toàn (KHÔNG dùng readByStudentRelation
 *    như payments/tuition-cycles vì phiếu chi không gắn học viên).
 *
 * `coSo`: dùng select kim_lien/vinh_phuc GIỐNG `payments` để Thu và Chi cùng một
 * trục cơ sở (đối chiếu/báo cáo trực tiếp). KHÔNG dùng quan hệ `location` vì
 * collection này chỉ vai trò tài chính-global xem (không cần branch-scope).
 *
 * Audit: gắn `buildAuditHooks('expenses')` — thao tác tài chính cần truy vết.
 */
const canReadFinance = hasRole('admin', 'manager', 'accountant')
const canWriteFinance = hasRole('admin', 'accountant')

/**
 * Tách trách nhiệm 🔒: kế toán TẠO phiếu chi (mặc định `cho_duyet`) nhưng KHÔNG tự
 * duyệt. Các field duyệt (`trangThai`/`duyetBoi`/`lyDoTuChoi`) chỉ admin/manager
 * ghi được (field-level) — chặn kế toán tự đổi trạng thái qua form.
 */
const onlyManagerApproves: FieldAccess = ({ req }) =>
  hasRole('admin', 'manager')({ req }) === true

/**
 * Tự đóng dấu NGƯỜI DUYỆT + NGÀY DUYỆT khi trạng thái chuyển sang đã duyệt / từ
 * chối (manager/admin mở phiếu, đổi trạng thái, lưu). Quay lại "chờ duyệt" ⇒ xóa
 * dấu. Field-level access đã chặn kế toán đổi các field này nên hook an toàn.
 */
const stampApproval: CollectionBeforeChangeHook = ({ data, originalDoc, req }) => {
  if (!data) return data
  const prev = originalDoc?.trangThai
  const next = data.trangThai
  if (next && next !== prev && (next === 'da_duyet' || next === 'tu_choi')) {
    data.duyetBoi = req.user?.id ?? data.duyetBoi
    data.ngayDuyet = new Date().toISOString()
  }
  if (next === 'cho_duyet') {
    data.duyetBoi = null
    data.ngayDuyet = null
    data.lyDoTuChoi = null
  }
  return data
}

export const Expenses: CollectionConfig = {
  slug: 'expenses',
  labels: {
    singular: 'Phiếu chi',
    plural: 'Phiếu chi',
  },
  admin: {
    group: 'Tài chính',
    useAsTitle: 'spentAt',
    defaultColumns: ['spentAt', 'category', 'amount', 'coSo', 'trangThai', 'payee'],
  },
  timestamps: true,
  access: {
    create: canWriteFinance,
    read: canReadFinance,
    update: canWriteFinance,
    delete: canWriteFinance,
  },
  hooks: { ...buildAuditHooks('expenses'), beforeChange: [stampApproval] },
  fields: [
    {
      name: 'category',
      type: 'relationship',
      label: 'Danh mục',
      relationTo: 'expense-categories',
      required: true,
    },
    {
      name: 'amount',
      type: 'number',
      label: 'Số tiền',
      required: true,
      min: 0,
    },
    {
      name: 'spentAt',
      type: 'date',
      label: 'Ngày chi',
      required: true,
      admin: { date: DATE_ONLY },
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
      name: 'method',
      type: 'select',
      label: 'Hình thức thanh toán',
      options: [
        { label: 'Tiền mặt', value: 'tien_mat' },
        { label: 'Chuyển khoản', value: 'ck' },
      ],
    },
    {
      name: 'payee',
      type: 'text',
      label: 'Người nhận / nội dung',
    },
    {
      name: 'attachment',
      type: 'upload',
      label: 'Chứng từ',
      relationTo: 'media',
      admin: {
        description: 'Ảnh hóa đơn/biên lai (tùy chọn).',
      },
    },
    {
      name: 'note',
      type: 'textarea',
      label: 'Ghi chú',
    },
    {
      name: 'trangThai',
      type: 'select',
      label: 'Trạng thái duyệt',
      defaultValue: 'cho_duyet',
      options: [
        { label: 'Chờ duyệt', value: 'cho_duyet' },
        { label: 'Đã duyệt', value: 'da_duyet' },
        { label: 'Từ chối', value: 'tu_choi' },
      ],
      access: { update: onlyManagerApproves },
    },
    {
      name: 'duyetBoi',
      type: 'relationship',
      label: 'Người duyệt',
      relationTo: 'users',
      admin: { readOnly: true },
      access: { update: onlyManagerApproves },
    },
    {
      name: 'ngayDuyet',
      type: 'date',
      label: 'Ngày duyệt',
      admin: { readOnly: true, date: DATE_ONLY },
      access: { update: onlyManagerApproves },
    },
    {
      name: 'lyDoTuChoi',
      type: 'textarea',
      label: 'Lý do từ chối',
      access: { update: onlyManagerApproves },
    },
  ],
}
