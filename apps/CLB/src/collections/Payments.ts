import type { CollectionConfig, CollectionBeforeValidateHook, FieldAccess } from 'payload'
import { staffOnly, readByStudentRelation } from '../access/parents'
import { withBranchScope } from '../access/branch'
import { DATE_ONLY } from '../lib/admin-date'
import { buildAuditHooks } from '../lib/audit/log'
import { hasPositivePaymentAmount } from '../lib/payments/create'
import { codeField, PAYMENT_CODE_SPEC } from '../lib/codes/field'
import { makeCodeHook } from '../lib/codes/makeCodeHook'
import { lockCodeHook } from '../lib/codes/lockCodeHook'
import { publishPaymentReceived } from '../lib/events/payment-hooks'

// Audit hooks tách riêng để nối thêm publish vào afterChange mà KHÔNG đè audit.
const paymentsAuditHooks = buildAuditHooks('payments')

/**
 * 🔒 FIREWALL HỌC PHÍ — field-level read cho luồng MỞ Payments cho phụ huynh.
 *
 * Payments.read nay = staff (branch-scope) OR phụ huynh đọc payment của con mình
 * (readByStudentRelation, lọc DB-level). Để KHÔNG lộ chi tiết tài chính nội bộ,
 * field nhạy cảm chỉ cho STAFF đọc; phụ huynh chỉ thấy field an toàn (`code`,
 * `ngayNop`, tổng các khoản tiền). `staffOnlyFieldRead` trả `false` cho phụ
 * huynh ⇒ Payload loại field khỏi payload trả về (không leak qua REST/GraphQL/
 * Local API). Áp cho: tuitionCycle, hp1Buoi, soBuoiNop, coSo, tinhTrang,
 * anhBill, ghiChu. (`student` PHẢI đọc được để phụ huynh biết payment của con
 * nào, nhưng readByStudentRelation đã đảm bảo chỉ con mình.)
 */
const isStaffReq = (user: { collection?: string } | null | undefined): boolean =>
  !!user && user.collection === 'users'

export const staffOnlyFieldRead: FieldAccess = ({ req }) => isStaffReq(req.user)

/**
 * Chặn phiếu thu RỖNG (tất cả tiền = 0/trống) — đường form/Server Action đã chặn
 * qua `validatePaymentInput`; hook này phủ nốt đường nhập/sửa TAY ở /admin. Trên
 * UPDATE chỉ có field đổi trong `data` ⇒ hợp nhất với `originalDoc` trước khi xét
 * (`??` giữ nguyên giá trị 0 do nhân viên cố ý đặt).
 */
const requirePositivePaymentAmount: CollectionBeforeValidateHook = ({ data, originalDoc }) => {
  if (!data) return data
  const merged = {
    hocPhi: data.hocPhi ?? originalDoc?.hocPhi,
    tienSach: data.tienSach ?? originalDoc?.tienSach,
    muaKhac: data.muaKhac ?? originalDoc?.muaKhac,
  }
  if (!hasPositivePaymentAmount(merged)) {
    throw new Error('Phải nhập ít nhất một khoản tiền > 0 (học phí / tiền sách / mua khác).')
  }
  return data
}

/**
 * Thanh toán học phí — schema GĐ4 (access control: Claude Code).
 *
 * Mỗi bản ghi là MỘT lần nộp tiền cho MỘT học viên (học phí + tiền sách + mua
 * khác…). Access control quan hệ: phụ huynh CHỈ đọc payment của con mình (lọc
 * DB-level qua `student` ∈ parent.children — không phải post-filter, không leak
 * qua list endpoint). Ghi (create/update/delete): chỉ nhân viên đăng nhập.
 */
export const Payments: CollectionConfig = {
  slug: 'payments',
  labels: {
    singular: 'Thanh toán',
    plural: 'Thanh toán',
  },
  admin: {
    group: 'Tài chính',
    useAsTitle: 'ngayNop',
    defaultColumns: ['code', 'ngayNop', 'student', 'hocPhi', 'soBuoiNop', 'coSo', 'tinhTrang'],
    components: {
      beforeListTable: ['/components/admin/export/ExportButtons#ExportButtons'],
    },
  },
  timestamps: true,
  access: {
    create: staffOnly,
    // 🔒 Branch-scope theo `student.location`: nhân viên bị-khóa-cơ-sở chỉ
    // đọc/sửa/xóa payment của HV cùng cơ sở; vai trò global xem/ghi tất. Luồng
    // phụ huynh giữ NGUYÊN (gate trả Where ⇒ withBranchScope trả nguyên).
    // `create` KHÔNG scope (Server Action/nhập tay).
    read: withBranchScope(readByStudentRelation(), 'student.location'),
    update: withBranchScope(staffOnly, 'student.location'),
    delete: withBranchScope(staffOnly, 'student.location'),
  },
  hooks: {
    ...paymentsAuditHooks,
    beforeValidate: [lockCodeHook, requirePositivePaymentAmount],
    beforeChange: [makeCodeHook(PAYMENT_CODE_SPEC)],
    // Audit (ghi diff) + phát sự kiện đồng bộ doanh thu sang Accounting.
    afterChange: [...paymentsAuditHooks.afterChange, publishPaymentReceived],
  },
  fields: [
    // `code` an toàn cho phụ huynh (mã chứng từ, không lộ logic tài chính) ⇒
    // KHÔNG gắn staffOnlyFieldRead.
    codeField,
    {
      name: 'student',
      type: 'relationship',
      label: 'Học viên',
      relationTo: 'students',
      required: true,
    },
    {
      name: 'tuitionCycle',
      type: 'relationship',
      label: 'Chu kỳ học phí',
      relationTo: 'tuition-cycles',
      access: { read: staffOnlyFieldRead },
      admin: {
        description:
          'Chu kỳ/gói buổi mà lần nộp này thuộc về (truy vết Thu ↔ chu kỳ, phục vụ ghi nhận doanh thu & nhắc tái tục). Tùy chọn.',
      },
    },
    {
      name: 'ngayNop',
      type: 'date',
      label: 'Ngày nộp',
      required: true,
      admin: { date: DATE_ONLY },
    },
    {
      name: 'hocPhi',
      type: 'number',
      label: 'Học phí',
      min: 0,
    },
    {
      name: 'tienSach',
      type: 'number',
      label: 'Tiền sách',
      min: 0,
    },
    {
      name: 'muaKhac',
      type: 'number',
      label: 'Mua khác',
      min: 0,
    },
    {
      name: 'hp1Buoi',
      type: 'number',
      label: 'Học phí 1 buổi',
      min: 0,
      access: { read: staffOnlyFieldRead },
    },
    {
      name: 'soBuoiNop',
      type: 'number',
      label: 'Số buổi nộp',
      min: 0,
      access: { read: staffOnlyFieldRead },
    },
    {
      name: 'coSo',
      type: 'select',
      label: 'Cơ sở',
      access: { read: staffOnlyFieldRead },
      options: [
        { label: 'Kim Liên', value: 'kim_lien' },
        { label: 'Vĩnh Phúc', value: 'vinh_phuc' },
      ],
    },
    {
      name: 'tinhTrang',
      type: 'select',
      label: 'Tình trạng',
      defaultValue: 'da_nop',
      access: { read: staffOnlyFieldRead },
      options: [
        { label: 'Đã nộp', value: 'da_nop' },
        { label: 'Chờ', value: 'cho' },
      ],
    },
    {
      name: 'anhBill',
      type: 'upload',
      label: 'Ảnh bill',
      relationTo: 'media',
      access: { read: staffOnlyFieldRead },
      admin: {
        description: 'Ảnh chụp biên lai/bill (tùy chọn).',
      },
    },
    {
      name: 'ghiChu',
      type: 'textarea',
      label: 'Ghi chú',
      access: { read: staffOnlyFieldRead },
    },
  ],
}
