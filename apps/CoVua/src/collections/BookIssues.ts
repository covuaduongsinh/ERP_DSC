import type { CollectionConfig } from 'payload';
import { staffOnly } from '../access/parents';
import { DATE_ONLY } from '../lib/admin-date';
import { codeField, BOOK_ISSUE_CODE_SPEC } from '../lib/codes/field';
import { makeCodeHook } from '../lib/codes/makeCodeHook';
import { lockCodeHook } from '../lib/codes/lockCodeHook';

/**
 * Phát sách — SỔ TỪNG LẦN PHÁT/BÁN SÁCH cho học viên (nguồn: bảng "Từng lần
 * phát sách" trên Lark CRM).
 *
 * Mỗi bản ghi = một lần một học viên nhận một cuốn sách (có giá, ưu đãi, ngày).
 * Đây là dữ liệu "thanh toán sách" — NGOÀI phạm vi GĐ1 như tính năng cổng phụ
 * huynh, nên import để lưu trữ/vận hành nội bộ.
 *
 * Access (🔒 Claude Code): chỉ nhân viên đọc/ghi (sổ nội bộ; KHÔNG lộ ra cổng
 * phụ huynh ở giai đoạn này — tiền sách tổng đã có trong `payments`).
 */
export const BookIssues: CollectionConfig = {
  slug: 'book-issues',
  labels: {
    singular: 'Phát sách',
    plural: 'Phát sách',
  },
  admin: {
    group: 'Sách',
    useAsTitle: 'ngayDung',
    defaultColumns: ['code', 'ngayDung', 'student', 'book', 'tienSach', 'coSo'],
  },
  timestamps: true,
  access: {
    create: staffOnly,
    read: staffOnly,
    update: staffOnly,
    delete: staffOnly,
  },
  // `beforeChange`: tự sinh `code` XS-YYYYMM-NNNN (reset/tháng theo `ngayDung`).
  // `beforeValidate`: KHÓA `code` bất biến. `larkCode` (truy vết Lark) giữ riêng.
  hooks: {
    beforeValidate: [lockCodeHook],
    beforeChange: [makeCodeHook(BOOK_ISSUE_CODE_SPEC)],
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
      name: 'book',
      type: 'relationship',
      label: 'Sách',
      relationTo: 'books',
    },
    {
      name: 'ngayDung',
      type: 'date',
      label: 'Ngày dùng/phát',
      admin: { date: DATE_ONLY },
    },
    {
      name: 'giaSach',
      type: 'number',
      label: 'Giá',
      min: 0,
    },
    {
      name: 'uuDai',
      type: 'number',
      label: 'Ưu đãi',
      min: 0,
    },
    {
      name: 'tienSach',
      type: 'number',
      label: 'Tiền sách (thực thu)',
      min: 0,
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
      name: 'larkCode',
      type: 'text',
      label: 'Ký hiệu lần phát (Lark)',
      index: true,
      admin: { description: 'Ký hiệu lần phát sách từ Lark — truy vết + chống trùng.' },
    },
    {
      name: 'ghiChu',
      type: 'textarea',
      label: 'Ghi chú',
    },
  ],
};
