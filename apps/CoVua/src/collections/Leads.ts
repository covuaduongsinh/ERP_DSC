import type { CollectionConfig } from 'payload'
import { anyone, hasRole, staffOnlyField } from '../access'
import { DATE_TIME } from '../lib/admin-date'
import { normalizePhone } from '../lib/phone'

/** Quản lý lead: admin/manager/lễ tân (lễ tân chăm sóc & chốt lead). */
const canManageLeads = hasRole('admin', 'manager', 'receptionist')

/**
 * Field-level access cho các field PIPELINE (assignment, lịch follow-up, nhật ký,
 * chuyển đổi). `Leads.create` là public (form web) ⇒ phải khóa các field này ở
 * tầng field để một POST ẩn danh KHÔNG tự gán nhân viên/giai đoạn/chuyển đổi.
 * Chỉ staff ghi được (qua /admin hoặc Server Action convertLead). Xem
 * docs/security-access-control.md.
 */
const staffPipelineField = {
  create: staffOnlyField,
  update: staffOnlyField,
}

export const Leads: CollectionConfig = {
  slug: 'leads',
  // create: public (form web ghi vào); read/update/delete: chỉ nhân viên quản lý lead
  access: {
    create: anyone,
    read: canManageLeads,
    update: canManageLeads,
    delete: canManageLeads,
  },
  labels: {
    singular: 'Lead',
    plural: 'Leads',
  },
  admin: {
    group: 'Tuyển sinh & CRM',
    useAsTitle: 'fullName',
    defaultColumns: [
      'fullName',
      'phone',
      'status',
      'assignedTo',
      'nextFollowUpAt',
      'source',
      'createdAt',
    ],
  },
  timestamps: true,
  fields: [
    {
      name: 'fullName',
      type: 'text',
      label: 'Họ tên',
      required: true,
    },
    {
      name: 'phone',
      type: 'text',
      label: 'Số điện thoại',
      required: true,
      // Chuẩn hóa SĐT lúc ghi (bỏ khoảng trắng/dấu chấm/gạch/ngoặc) — kể cả khi
      // form web ẩn danh POST vào. Giúp dò lead trùng nhất quán với Parents.phone.
      hooks: {
        beforeValidate: [
          ({ value }) => (typeof value === 'string' ? normalizePhone(value) : value),
        ],
      },
    },
    {
      name: 'email',
      type: 'email',
      label: 'Email',
    },
    {
      name: 'childAge',
      type: 'text',
      label: 'Độ tuổi con',
    },
    {
      name: 'interestedLocation',
      type: 'relationship',
      label: 'Cơ sở quan tâm',
      relationTo: 'locations',
    },
    {
      // Lớp phụ huynh quan tâm (gắn từ form "Đăng ký học thử" trên website). Access
      // PUBLIC (không khóa field-level) vì form công khai gửi class id lúc create;
      // an toàn vì Server Action submitTrialRequest validate lớp tồn tại + đang mở,
      // và đặt interestedLocation theo class.location (server kiểm soát).
      name: 'interestedClass',
      type: 'relationship',
      label: 'Lớp quan tâm',
      relationTo: 'classes',
      admin: {
        description: 'Lớp phụ huynh đăng ký học thử (từ website).',
      },
    },
    {
      name: 'source',
      type: 'select',
      label: 'Nguồn',
      required: true,
      options: [
        { label: 'Google', value: 'google' },
        { label: 'Facebook', value: 'facebook' },
        { label: 'Giới thiệu', value: 'gioi_thieu' },
        { label: 'Khác', value: 'khac' },
      ],
    },
    {
      name: 'note',
      type: 'textarea',
      label: 'Ghi chú',
    },
    {
      // Giai đoạn pipeline của lead. Giữ tên field `status` (đã dùng ở
      // lib/staff-queues.ts UNCARED_LEAD_STATUSES và submitConsultation) — đây
      // CHÍNH là "stage" của pipeline, không tách field riêng để tránh trùng lặp.
      name: 'status',
      type: 'select',
      label: 'Giai đoạn',
      required: true,
      defaultValue: 'moi',
      options: [
        { label: 'Mới', value: 'moi' },
        { label: 'Đã liên hệ', value: 'da_lien_he' },
        { label: 'Đăng ký học thử', value: 'dang_ky_hoc_thu' },
        { label: 'Đã chốt', value: 'da_chot' },
        { label: 'Không phù hợp', value: 'khong_phu_hop' },
      ],
      admin: {
        description:
          'Giai đoạn trong pipeline chăm sóc lead. "Đã chốt" được đặt tự động khi chuyển đổi lead thành Phụ huynh + Học viên.',
      },
    },
    {
      name: 'assignedTo',
      type: 'relationship',
      label: 'Nhân viên phụ trách',
      relationTo: 'users',
      access: staffPipelineField,
      admin: {
        position: 'sidebar',
        description: 'Nhân viên chăm sóc lead này.',
      },
    },
    {
      name: 'nextFollowUpAt',
      type: 'date',
      label: 'Hẹn liên hệ lại',
      access: staffPipelineField,
      admin: {
        position: 'sidebar',
        date: DATE_TIME,
        description: 'Mốc cần liên hệ lại lần tới.',
      },
    },
    {
      name: 'activityLog',
      type: 'array',
      label: 'Nhật ký chăm sóc',
      labels: { singular: 'Hoạt động', plural: 'Hoạt động' },
      access: staffPipelineField,
      admin: {
        description:
          'Lịch sử tương tác với lead (cuộc gọi, ghi chú, đổi giai đoạn, chuyển đổi…). Entry "Chuyển đổi" được ghi tự động bởi action convertLead.',
        initCollapsed: true,
      },
      fields: [
        {
          name: 'type',
          type: 'select',
          label: 'Loại',
          required: true,
          defaultValue: 'ghi_chu',
          options: [
            { label: 'Liên hệ (gọi/nhắn)', value: 'lien_he' },
            { label: 'Ghi chú', value: 'ghi_chu' },
            { label: 'Đổi giai đoạn', value: 'doi_giai_doan' },
            { label: 'Hẹn lịch', value: 'hen_lich' },
            { label: 'Chuyển đổi', value: 'chuyen_doi' },
            { label: 'Khác', value: 'khac' },
          ],
        },
        {
          name: 'at',
          type: 'date',
          label: 'Thời điểm',
          defaultValue: () => new Date().toISOString(),
          admin: { date: DATE_TIME },
        },
        {
          name: 'note',
          type: 'textarea',
          label: 'Nội dung',
        },
        {
          name: 'by',
          type: 'relationship',
          label: 'Người thực hiện',
          relationTo: 'users',
        },
      ],
    },
    // --- Dấu vết chuyển đổi (đặt tự động bởi Server Action convertLead) ---
    {
      name: 'convertedAt',
      type: 'date',
      label: 'Đã chuyển đổi lúc',
      access: staffPipelineField,
      admin: {
        position: 'sidebar',
        readOnly: true,
        date: DATE_TIME,
        description: 'Thời điểm lead được chuyển thành Phụ huynh + Học viên.',
      },
    },
    {
      name: 'convertedParent',
      type: 'relationship',
      label: 'Phụ huynh đã tạo',
      relationTo: 'parents',
      access: staffPipelineField,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Bản ghi Phụ huynh sinh ra từ lead này (chống tạo trùng).',
      },
    },
    {
      name: 'convertedStudent',
      type: 'relationship',
      label: 'Học viên đã tạo',
      relationTo: 'students',
      access: staffPipelineField,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Bản ghi Học viên sinh ra từ lead này.',
      },
    },
  ],
}
