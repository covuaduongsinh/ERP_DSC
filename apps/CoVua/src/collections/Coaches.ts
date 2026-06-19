import type { CollectionConfig, FieldAccess } from 'payload'
import { anyone, hasRole } from '../access'

/** Ghi nội dung website: chỉ nhân viên admin/manager/receptionist (đọc công khai). */
const canManageContent = hasRole('admin', 'manager', 'receptionist')

/**
 * Lương 🔒: `coaches.read = anyone` (website liệt kê GV) nên field lương PHẢI khóa
 * field-level — chỉ tài chính (admin/manager/accountant) ĐỌC, chỉ admin/manager GHI.
 * Nếu không, đơn giá lương sẽ lọt ra API công khai.
 */
const canSeeSalary: FieldAccess = ({ req }) =>
  hasRole('admin', 'manager', 'accountant')({ req }) === true
const canSetSalary: FieldAccess = ({ req }) =>
  hasRole('admin', 'manager')({ req }) === true

export const Coaches: CollectionConfig = {
  slug: 'coaches',
  access: {
    read: anyone,
    create: canManageContent,
    update: canManageContent,
    delete: canManageContent,
  },
  labels: {
    singular: 'Huấn luyện viên',
    plural: 'Huấn luyện viên',
  },
  admin: {
    group: 'Đào tạo',
    useAsTitle: 'name',
    defaultColumns: ['tenTat', 'name', 'vaiTro', 'trangThai', 'order'],
    components: {
      beforeListTable: ['/components/admin/export/ExportButtons#ExportButtons'],
    },
  },
  defaultSort: 'order',
  fields: [
    // ── Hồ sơ nhân sự (khớp file GiaoVien_da_chuan_hoa.csv) ──────────────
    {
      name: 'tenTat',
      type: 'text',
      label: 'Tên tắt',
      required: true,
      unique: true,
      index: true,
      admin: {
        description:
          'Khóa định danh để import khớp dòng (idempotent). Không trùng.',
      },
    },
    {
      name: 'tenTatAlias',
      type: 'text',
      label: 'Tên tắt (bí danh)',
      admin: {
        description:
          'Các cách viết tắt khác của GV, ngăn cách bởi dấu phẩy (vd "P.Anh, Panh, Phanh"). Import khớp cả bí danh để gom đúng một người.',
      },
    },
    {
      name: 'hoTen',
      type: 'text',
      label: 'Họ tên đầy đủ',
    },
    {
      name: 'vaiTro',
      type: 'select',
      label: 'Vai trò',
      options: [
        { label: 'GV', value: 'gv' },
        { label: 'Trợ giảng', value: 'tro_giang' },
        { label: 'Tập sự', value: 'tap_su' },
      ],
    },
    {
      name: 'sdt',
      type: 'text',
      label: 'Số điện thoại',
      admin: {
        description: 'Lưu dạng text để giữ số 0 đầu, không dùng number.',
      },
    },
    {
      name: 'email',
      type: 'text',
      label: 'Email',
    },
    {
      name: 'elo',
      type: 'number',
      label: 'Elo',
    },
    {
      name: 'trangThai',
      type: 'select',
      label: 'Trạng thái',
      options: [
        { label: 'Đang dạy', value: 'dang_day' },
        { label: 'Nghỉ', value: 'nghi' },
      ],
    },
    // ── Hồ sơ hiển thị công khai (trang Huấn luyện viên) ─────────────────
    {
      name: 'name',
      type: 'text',
      label: 'Tên hiển thị công khai',
      required: true,
      admin: {
        description:
          'Tên hiển thị trên website. Import sẽ tự điền từ Họ tên nếu để trống khi tạo mới.',
      },
    },
    {
      name: 'photo',
      type: 'upload',
      label: 'Ảnh đại diện',
      relationTo: 'media',
    },
    {
      name: 'titles',
      type: 'array',
      label: 'Học hàm / Chứng chỉ',
      labels: {
        singular: 'Học hàm / Chứng chỉ',
        plural: 'Học hàm / Chứng chỉ',
      },
      fields: [
        {
          name: 'title',
          type: 'text',
          label: 'Nội dung',
          required: true,
        },
      ],
    },
    {
      name: 'bio',
      type: 'richText',
      label: 'Tiểu sử',
    },
    {
      name: 'order',
      type: 'number',
      label: 'Thứ tự hiển thị',
      defaultValue: 0,
      admin: {
        description: 'Số nhỏ hơn hiển thị trước.',
      },
    },
    {
      name: 'luongMoiBuoi',
      type: 'number',
      label: 'Lương mỗi buổi (VNĐ)',
      min: 0,
      admin: {
        description: 'Đơn giá/buổi đứng lớp — dùng tính bảng lương. 🔒 Chỉ tài chính xem.',
      },
      access: { read: canSeeSalary, update: canSetSalary },
    },
  ],
}
