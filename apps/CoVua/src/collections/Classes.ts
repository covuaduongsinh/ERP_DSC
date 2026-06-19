import type { CollectionConfig } from 'payload'
import { anyone, hasRole } from '../access'
import { withBranchScope } from '../access/branch'
import { buildAuditHooks } from '../lib/audit/log'
import { countActiveEnrollments } from '../lib/classes/enrollment-count'
import { syncLevelTrack } from '../lib/classes/level-track'
import { chessLevelSelectOptions, chessTrackSelectOptions } from '../lib/roadmap'
import { codeField, CLASS_CODE_SPEC } from '../lib/codes/field'
import { makeCodeHook } from '../lib/codes/makeCodeHook'
import { lockCodeHook } from '../lib/codes/lockCodeHook'

const chessLevelOptions = chessLevelSelectOptions()
const chessTrackOptions = chessTrackSelectOptions()

/** Ghi nội dung website: chỉ nhân viên admin/manager/receptionist (đọc công khai). */
const canManageContent = hasRole('admin', 'manager', 'receptionist')

export const Classes: CollectionConfig = {
  slug: 'classes',
  // `read` công khai (website liệt kê lớp theo cơ sở) — KHÔNG scope.
  // Ghi: phân quyền theo cơ sở 🔒 — receptionist chỉ sửa/xóa lớp cùng `location`;
  // admin/manager (global) sửa mọi lớp. `create` giữ nguyên (chưa có doc để lọc
  // theo cơ sở; ràng buộc branch lúc tạo dễ vướng — chặn ghi chéo ở update/delete).
  access: {
    read: anyone,
    create: canManageContent,
    update: withBranchScope(canManageContent),
    delete: withBranchScope(canManageContent),
  },
  labels: {
    singular: 'Lớp học',
    plural: 'Lớp học',
  },
  admin: {
    group: 'Đào tạo',
    useAsTitle: 'title',
    defaultColumns: ['code', 'title', 'level', 'track', 'ageGroup', 'location', 'siSoHienTai', 'siSoToiDa', 'coach'],
    components: {
      // Nút "Tạo bản sao": tick chọn lớp ở danh sách → nhân bản nhanh.
      beforeListTable: [
        '/components/admin/classes/DuplicateClassButton#DuplicateClassButton',
      ],
    },
  },
  // `beforeValidate`: KHÓA `code` bất biến (lockCodeHook) + tự suy 2 chiều Cấp ↔
  // Tuyến (syncLevelTrack — điền ô trống từ ô kia; chặn nếu cả hai trống).
  // `beforeChange`: tự sinh `code` LOP-{CS}-NNN (cơ sở từ `location`). Gộp với
  // hook audit (afterChange/afterDelete) sẵn có.
  hooks: {
    ...buildAuditHooks('classes'),
    beforeValidate: [lockCodeHook, syncLevelTrack],
    beforeChange: [makeCodeHook(CLASS_CODE_SPEC)],
  },
  fields: [
    codeField,
    {
      name: 'title',
      type: 'text',
      label: 'Tên lớp',
      required: true,
      admin: {
        components: {
          // Tên lớp → link mở Hồ sơ lớp học (/admin/lop/:id).
          Cell: '/components/admin/classes/ClassDetailLinkCell#ClassDetailLinkCell',
        },
      },
    },
    {
      // Một lớp có thể gắn NHIỀU cấp (gộp lớp khi vắng). KHÔNG `required` ở field —
      // ràng buộc "ít nhất 1 Cấp hoặc 1 Tuyến" do hook `syncLevelTrack` đảm nhiệm.
      name: 'level',
      type: 'select',
      label: 'Cấp độ',
      hasMany: true,
      options: chessLevelOptions,
      admin: {
        description: 'Chọn 1+ cấp độ. Bỏ trống sẽ tự suy từ Tuyến đã chọn.',
      },
    },
    {
      // Tuyến trình độ (3 tuyến) — nay là field THẬT, chọn nhiều. Bỏ trống sẽ tự
      // suy từ Cấp độ (Nhập môn=Tốt; Cơ bản=Mã/Tượng/Xe; Nâng cao=Hậu/Vua) qua hook.
      name: 'track',
      type: 'select',
      label: 'Tuyến',
      hasMany: true,
      options: chessTrackOptions,
      admin: {
        description: 'Chọn 1+ tuyến. Bỏ trống sẽ tự suy từ Cấp độ đã chọn.',
      },
    },
    {
      name: 'ageGroup',
      type: 'select',
      label: 'Nhóm tuổi',
      required: true,
      hasMany: true,
      admin: {
        description: 'Có thể chọn cả hai để dùng chung một lớp cho nhiều lứa tuổi.',
      },
      options: [
        { label: 'Mầm non 4-6 tuổi', value: 'mam_non_4_6' },
        { label: 'Cấp 1 - Cấp 2', value: 'cap_1_cap_2' },
      ],
    },
    {
      name: 'description',
      type: 'richText',
      label: 'Mô tả',
    },
    {
      name: 'location',
      type: 'relationship',
      label: 'Cơ sở',
      relationTo: 'locations',
      required: true,
    },
    {
      name: 'coach',
      type: 'relationship',
      label: 'Giáo viên phụ trách',
      relationTo: 'coaches',
      // Tùy chọn: lớp có thể có GV chính, hoặc chỉ trợ giảng, hoặc cả hai.
    },
    {
      name: 'troGiang',
      type: 'relationship',
      label: 'Trợ giảng',
      relationTo: 'coaches',
    },
    {
      name: 'siSoHienTai',
      type: 'number',
      label: 'Sĩ số hiện tại',
      // Virtual: đếm Enrollments (dangHoc=true) lúc đọc — KHÔNG lưu DB, không nhập tay.
      virtual: true,
      admin: {
        readOnly: true,
        description:
          'Tự động đếm số học viên đang học (Ghi danh có "Đang học"). Không lưu, không nhập tay.',
        components: {
          // Bấm số sĩ số → mở trang "Sĩ số lớp" với lớp đã chọn sẵn.
          Cell: '/components/admin/classes/RosterLinkCell#RosterLinkCell',
        },
      },
      hooks: { afterRead: [countActiveEnrollments] },
    },
    {
      name: 'siSoToiDa',
      type: 'number',
      label: 'Sĩ số tối đa',
      min: 1,
      admin: { description: 'Để trống nếu không giới hạn.' },
    },
    {
      name: 'trangThai',
      type: 'select',
      label: 'Trạng thái lớp',
      defaultValue: 'dang_mo',
      options: [
        { label: 'Đang mở', value: 'dang_mo' },
        { label: 'Tạm dừng', value: 'tam_dung' },
        { label: 'Đã đóng', value: 'da_dong' },
      ],
    },
    {
      name: 'lichHoc',
      type: 'array',
      label: 'Lịch học',
      labels: { singular: 'Buổi', plural: 'Buổi' },
      admin: { description: 'Các buổi cố định hằng tuần.' },
      fields: [
        {
          name: 'thu',
          type: 'select',
          label: 'Thứ',
          required: true,
          options: [
            { label: 'Thứ 2', value: 't2' },
            { label: 'Thứ 3', value: 't3' },
            { label: 'Thứ 4', value: 't4' },
            { label: 'Thứ 5', value: 't5' },
            { label: 'Thứ 6', value: 't6' },
            { label: 'Thứ 7', value: 't7' },
            { label: 'Chủ nhật', value: 'cn' },
          ],
        },
        {
          name: 'gioBatDau',
          type: 'text',
          label: 'Giờ bắt đầu (HH:MM)',
          required: true,
        },
        {
          name: 'gioKetThuc',
          type: 'text',
          label: 'Giờ kết thúc (HH:MM)',
          required: true,
        },
        {
          name: 'phong',
          type: 'text',
          label: 'Phòng',
        },
      ],
    },
  ],
}
