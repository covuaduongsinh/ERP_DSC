import type { CollectionConfig } from 'payload';
import { DATE_TIME } from '../lib/admin-date';
import {
  staffOnly,
  readParentSelf,
  updateParentSelf,
  staffOnlyFieldWrite,
} from '../access/parents';
import { parentAuthStrategy } from '../lib/parent-auth-strategy';
import { normalizePhone } from '../lib/phone';

/**
 * Phụ huynh — schema GĐ4.
 * Auth (OTP): Claude Code. Access control quan hệ: Claude Code.
 */
export const Parents: CollectionConfig = {
  slug: 'parents',
  auth: {
    disableLocalStrategy: true,
    strategies: [parentAuthStrategy],
    useAPIKey: false,
  },
  labels: {
    singular: 'Phụ huynh',
    plural: 'Phụ huynh',
  },
  admin: {
    group: 'Học viên & Phụ huynh',
    useAsTitle: 'fullName',
    defaultColumns: ['fullName', 'phone', 'children'],
    description:
      'Tài khoản phụ huynh đăng nhập cổng /cong-phu-huynh bằng SĐT + OTP. Khác hoàn toàn với Users (nhân viên CMS).',
  },
  access: {
    create: staffOnly,
    read: readParentSelf,
    update: updateParentSelf,
    delete: staffOnly,
    admin: ({ req }) => !!req.user && req.user.collection === 'users',
  },
  fields: [
    {
      name: 'fullName',
      type: 'text',
      label: 'Họ tên phụ huynh',
      required: true,
    },
    {
      name: 'phone',
      type: 'text',
      label: 'Số điện thoại',
      required: true,
      unique: true,
      index: true,
      admin: {
        description:
          'Định danh đăng nhập. Lưu dạng chuẩn hóa, không khoảng trắng/dấu.',
      },
      access: {
        create: staffOnlyFieldWrite,
        update: staffOnlyFieldWrite,
      },
      hooks: {
        beforeValidate: [
          ({ value }) =>
            typeof value === 'string' ? normalizePhone(value) : value,
        ],
      },
    },
    {
      name: 'email',
      type: 'email',
      label: 'Email (tùy chọn)',
    },
    {
      name: 'zaloId',
      type: 'text',
      label: 'Zalo ID (tùy chọn)',
      admin: {
        description: 'Dùng khi tích hợp Zalo OA ở giai đoạn sau.',
      },
    },
    {
      name: 'children',
      type: 'relationship',
      label: 'Con đang học',
      relationTo: 'students',
      hasMany: true,
      admin: {
        description:
          'Học viên mà phụ huynh này theo dõi. Đồng bộ với Students.parents khi gán.',
      },
      access: {
        create: staffOnlyFieldWrite,
        update: staffOnlyFieldWrite,
      },
    },
    {
      name: 'lastLoginAt',
      type: 'date',
      label: 'Lần đăng nhập gần nhất',
      admin: {
        readOnly: true,
        position: 'sidebar',
        date: DATE_TIME,
      },
    },
  ],
};
