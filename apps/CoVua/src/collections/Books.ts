import type { CollectionConfig } from 'payload';
import { staffOnly } from '../access/parents';

/**
 * Sách — CATALOG NỘI BỘ (nguồn: bảng "Sách" trên Lark CRM).
 *
 * Khác `featured-books` (Sách nổi bật marketing website, cần ảnh bìa + link
 * Sapo). Đây là danh mục vận hành nội bộ có GIÁ (giá bìa / giá bán cho PH) +
 * ký hiệu, dùng để tham chiếu từ `book-issues` (mỗi lần phát sách cho HV).
 *
 * Access (🔒 Claude Code): chỉ nhân viên đọc/ghi — dữ liệu giá nội bộ, KHÔNG
 * công khai và KHÔNG lộ ra cổng phụ huynh.
 */
export const Books: CollectionConfig = {
  slug: 'books',
  labels: {
    singular: 'Sách (catalog)',
    plural: 'Sách (catalog)',
  },
  admin: {
    group: 'Sách',
    useAsTitle: 'title',
    defaultColumns: ['code', 'title', 'coverPrice', 'salePrice'],
    description: 'Danh mục sách nội bộ có giá. Khác với "Sách nổi bật" hiển thị trên website.',
  },
  access: {
    create: staffOnly,
    read: staffOnly,
    update: staffOnly,
    delete: staffOnly,
  },
  fields: [
    {
      name: 'code',
      type: 'text',
      label: 'Ký hiệu sách',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Mã định danh sách (vd TQ1, BTTH1). Khóa chống trùng khi import.' },
    },
    {
      name: 'title',
      type: 'text',
      label: 'Tên sách',
      required: true,
    },
    {
      name: 'coverPrice',
      type: 'number',
      label: 'Giá bìa',
      min: 0,
    },
    {
      name: 'salePrice',
      type: 'number',
      label: 'Giá bán cho phụ huynh',
      min: 0,
    },
    {
      name: 'levelSummary',
      type: 'textarea',
      label: 'Trình độ / nội dung tóm tắt',
    },
  ],
};
