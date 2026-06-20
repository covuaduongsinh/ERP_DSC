import type { CollectionConfig } from 'payload'
import { anyone, hasRole } from '../access'

/** Ghi nội dung website: chỉ nhân viên admin/manager/receptionist (đọc công khai). */
const canManageContent = hasRole('admin', 'manager', 'receptionist')

export const Locations: CollectionConfig = {
  slug: 'locations',
  access: {
    read: anyone,
    create: canManageContent,
    update: canManageContent,
    delete: canManageContent,
  },
  labels: {
    singular: 'Cơ sở',
    plural: 'Cơ sở',
  },
  admin: {
    group: 'Đào tạo',
    useAsTitle: 'name',
    defaultColumns: ['code', 'name', 'address', 'phone', 'isHeadquarters'],
  },
  fields: [
    {
      // Mã cơ sở 2–3 ký tự HOA (KL/VP). KHÁC `code` tự sinh ở các collection khác:
      // đây là mã NHẬP TAY cho cơ sở GIẢNG DẠY, điều khiển sinh mã `LOP-{CS}-NNN`
      // cho Classes (resolveBranchCode đọc field này). KHÔNG `required`: cơ sở
      // không-giảng-dạy (vd trụ sở) có thể bỏ trống — chỉ cần khi tạo lớp ở đó.
      // unique + index chống trùng (Postgres cho phép nhiều NULL).
      name: 'code',
      type: 'text',
      label: 'Mã cơ sở',
      unique: true,
      index: true,
      admin: {
        description:
          'Mã cơ sở giảng dạy (KL/VP, 2–3 ký tự HOA) — dùng để sinh mã lớp. Bỏ trống nếu cơ sở không mở lớp.',
      },
    },
    {
      name: 'name',
      type: 'text',
      label: 'Tên cơ sở',
      required: true,
    },
    {
      name: 'address',
      type: 'textarea',
      label: 'Địa chỉ',
      required: true,
    },
    {
      type: 'row',
      fields: [
        {
          name: 'lat',
          type: 'number',
          label: 'Vĩ độ',
          admin: {
            width: '50%',
          },
        },
        {
          name: 'lng',
          type: 'number',
          label: 'Kinh độ',
          admin: {
            width: '50%',
          },
        },
      ],
    },
    {
      name: 'mapEmbedUrl',
      type: 'text',
      label: 'URL nhúng bản đồ',
      admin: {
        description: 'Dùng thay cho tọa độ lat/lng nếu cần nhúng Google Maps.',
      },
    },
    {
      name: 'phone',
      type: 'text',
      label: 'Số điện thoại',
    },
    {
      name: 'isHeadquarters',
      type: 'checkbox',
      label: 'Trụ sở chính',
      defaultValue: false,
    },
  ],
}
