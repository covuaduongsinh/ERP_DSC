import type { CollectionConfig } from 'payload';
import { canProcessRenewals } from '../access';
import {
  createRenewalForOwnChild,
  readRenewalRequest,
  staffOnly,
} from '../access/parents';
import { withBranchScope } from '../access/branch';
import { codeField, RENEWAL_REQUEST_CODE_SPEC } from '../lib/codes/field';
import { makeCodeHook } from '../lib/codes/makeCodeHook';
import { lockCodeHook } from '../lib/codes/lockCodeHook';

/**
 * Yêu cầu gia hạn học phí — phụ huynh gửi từ cổng, nhân viên xử lý tại /admin.
 * CHƯA thu tiền online (GĐ3 mới có thanh toán).
 */
export const RenewalRequests: CollectionConfig = {
  slug: 'renewal-requests',
  labels: {
    singular: 'Yêu cầu gia hạn',
    plural: 'Yêu cầu gia hạn',
  },
  admin: {
    useAsTitle: 'student',
    defaultColumns: [
      'code',
      'student',
      'parent',
      'sessionsRemaining',
      'status',
      'createdAt',
    ],
    group: 'Cổng phụ huynh',
  },
  timestamps: true,
  hooks: {
    beforeValidate: [lockCodeHook],
    beforeChange: [makeCodeHook(RENEWAL_REQUEST_CODE_SPEC)],
  },
  access: {
    create: createRenewalForOwnChild,
    // 🔒 Branch-scope theo `student.location`. read: nhân viên bị-khóa chỉ thấy
    // yêu cầu của HV cùng cơ sở (luồng phụ huynh `readRenewalRequest` lọc theo
    // `parent` ⇒ trả nguyên, không chồng branch).
    read: withBranchScope(readRenewalRequest, 'student.location'),
    // Duyệt/từ chối (cập nhật trạng thái + sinh chu kỳ) là thao tác tài chính ⇒
    // chỉ kế toán/quản lý/admin, CHẶT HƠN "staff bất kỳ". Là hàng rào DB-level
    // cho cả core `lib/renewals/process.ts` (ghi với overrideAccess:false). Các
    // role này đều global ⇒ branch-scope là no-op (giữ để nhất quán + phòng mở rộng).
    update: withBranchScope(canProcessRenewals, 'student.location'),
    delete: withBranchScope(staffOnly, 'student.location'),
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
      name: 'parent',
      type: 'relationship',
      label: 'Phụ huynh',
      relationTo: 'parents',
      required: true,
    },
    {
      name: 'tuitionCycle',
      type: 'relationship',
      label: 'Chu kỳ học phí',
      relationTo: 'tuition-cycles',
    },
    {
      name: 'sessionsRemaining',
      type: 'number',
      label: 'Buổi còn lại lúc gửi',
      required: true,
      min: 0,
    },
    {
      name: 'parentNote',
      type: 'textarea',
      label: 'Ghi chú phụ huynh',
    },
    {
      name: 'status',
      type: 'select',
      label: 'Trạng thái',
      required: true,
      defaultValue: 'moi',
      options: [
        { label: 'Mới', value: 'moi' },
        { label: 'Đang xử lý', value: 'dang_xu_ly' },
        { label: 'Đã chốt', value: 'da_chot' },
        { label: 'Đã hủy', value: 'da_huy' },
      ],
    },
    {
      name: 'staffNote',
      type: 'textarea',
      label: 'Ghi chú nhân viên',
    },
  ],
};
