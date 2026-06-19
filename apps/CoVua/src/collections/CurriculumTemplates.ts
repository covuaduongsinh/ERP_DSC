import type { CollectionConfig } from 'payload';
import { staffOnly } from '../access/parents';
import { canManageCurriculum } from '../access';
import { buildAuditHooks } from '../lib/audit/log';
import { chessLevelSelectOptions, chessTrackSelectOptions } from '../lib/roadmap';

/**
 * KHUNG LỘ TRÌNH / giáo trình mẫu theo cấp (V2) — TÀI SẢN DÙNG CHUNG TOÀN CÔNG TY
 * để mọi cơ sở/HLV dạy đồng nhất. Mỗi khung gắn 1 cấp (Tốt…Vua), gồm danh sách
 * "bài mẫu" CÓ THỨ TỰ (`baiHoc` array — thứ tự = thứ tự dạy). HLV "Áp khung lộ
 * trình" vào lớp ⇒ bài thứ N điền sẵn nội dung buổi `du_kien` thứ N (cấp lớp).
 *
 * 🔒 KHÔNG branch-scope (mục tiêu chuẩn hóa): MỌI nhân viên ĐỌC được (để áp); chỉ
 * manager/admin (`canManageCurriculum`) được TẠO/SỬA/XÓA khung. Soạn qua trang
 * riêng `/admin/soan-khung-lo-trinh` (collection `hidden` khỏi nav).
 *
 * 🔒 KHÔNG đụng tính học phí: khung chỉ là nguồn nội dung text; việc áp khung ghi
 * `class-sessions` content fields qua `updateSessionContent` (đã branch-scope) —
 * không sinh `attendance`, không đổi nguồn đếm buổi.
 */
export const CurriculumTemplates: CollectionConfig = {
  slug: 'curriculum-templates',
  labels: {
    singular: 'Khung lộ trình',
    plural: 'Khung lộ trình',
  },
  admin: {
    group: 'Đào tạo',
    useAsTitle: 'tenKhung',
    defaultColumns: ['tenKhung', 'capDo', 'tuyen', 'trangThai'],
    hidden: true, // soạn qua trang /admin/soan-khung-lo-trinh
  },
  timestamps: true,
  access: {
    read: staffOnly,
    create: canManageCurriculum,
    update: canManageCurriculum,
    delete: canManageCurriculum,
  },
  hooks: buildAuditHooks('curriculum-templates'),
  fields: [
    {
      name: 'tenKhung',
      type: 'text',
      label: 'Tên khung',
      required: true,
    },
    {
      name: 'capDo',
      type: 'select',
      label: 'Cấp độ',
      required: true,
      options: chessLevelSelectOptions(),
      admin: { description: 'Cấp lộ trình khung này phục vụ (Tốt…Vua).' },
    },
    {
      name: 'tuyen',
      type: 'select',
      label: 'Tuyến',
      options: chessTrackSelectOptions(),
      admin: { description: 'Tùy chọn — tuyến trình độ (Nhập môn / Cơ bản / Nâng cao).' },
    },
    {
      name: 'moTa',
      type: 'textarea',
      label: 'Mô tả',
    },
    {
      name: 'trangThai',
      type: 'select',
      label: 'Trạng thái',
      defaultValue: 'dang_dung',
      options: [
        { label: 'Đang dùng', value: 'dang_dung' },
        { label: 'Lưu trữ', value: 'luu_tru' },
      ],
      admin: { description: 'Khung "Lưu trữ" ẩn khỏi danh sách chọn khi áp.' },
    },
    {
      name: 'baiHoc',
      type: 'array',
      label: 'Bài mẫu (theo thứ tự)',
      labels: { singular: 'Bài', plural: 'Bài' },
      admin: { description: 'Thứ tự bài = thứ tự dạy. Bài thứ N điền vào buổi thứ N khi áp.' },
      fields: [
        {
          name: 'tieuDe',
          type: 'text',
          label: 'Tiêu đề bài',
        },
        {
          name: 'mucTieu',
          type: 'textarea',
          label: 'Mục tiêu',
        },
        {
          name: 'kienThucMoi',
          type: 'textarea',
          label: 'Kiến thức mới',
        },
        {
          name: 'giaoBTVN',
          type: 'textarea',
          label: 'Giao BTVN',
        },
        {
          name: 'sachDangHoc',
          type: 'text',
          label: 'Sách đang học',
        },
        {
          name: 'ghiChu',
          type: 'textarea',
          label: 'Ghi chú soạn',
          admin: { description: 'Ghi chú nội bộ khi soạn — KHÔNG điền vào buổi khi áp.' },
        },
        {
          name: 'nguonRef',
          type: 'text',
          label: 'Tham chiếu nguồn',
          admin: {
            description:
              'Để trống — chỗ neo map nguồn giáo trình (Obsidian/giáo trình Nga) giai đoạn sau.',
          },
        },
      ],
    },
  ],
};

export default CurriculumTemplates;
