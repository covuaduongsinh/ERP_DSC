import type { CollectionConfig } from 'payload';
import { staffOnly, readStudentForParent, staffOnlyFieldWrite } from '../access/parents';
import { DATE_ONLY } from '../lib/admin-date';
import { withBranchScope } from '../access/branch';
import { buildAuditHooks } from '../lib/audit/log';
import { codeField, STUDENT_CODE_SPEC } from '../lib/codes/field';
import { makeCodeHook } from '../lib/codes/makeCodeHook';
import { lockCodeHook } from '../lib/codes/lockCodeHook';

/**
 * Học viên — schema GĐ4 (access control: Claude Code).
 */
export const Students: CollectionConfig = {
  slug: 'students',
  labels: {
    singular: 'Học viên',
    plural: 'Học viên',
  },
  admin: {
    group: 'Học viên & Phụ huynh',
    useAsTitle: 'fullName',
    defaultColumns: [
      'code',
      'fullName',
      'capChinh',
      'location',
      'enrollmentStatus',
    ],
    components: {
      beforeListTable: ['/components/admin/export/ExportButtons#ExportButtons'],
    },
  },
  // Phân quyền theo cơ sở 🔒: vai trò bị-khóa (coach/receptionist) chỉ đọc/sửa
  // Học viên cùng `location`; vai trò global (admin/manager/accountant) xem tất.
  // `read` giữ luồng phụ huynh (lọc theo con) qua readStudentForParent.
  // `create` KHÔNG scope theo cơ sở (importer/chuyển-đổi-lead chạy overrideAccess;
  // ràng buộc branch lúc tạo sẽ phá các luồng đó) — chỉ chặn ghi chéo ở update/delete.
  access: {
    create: staffOnly,
    read: withBranchScope(readStudentForParent),
    update: withBranchScope(staffOnly),
    delete: withBranchScope(staffOnly),
  },
  hooks: {
    ...buildAuditHooks('students'),
    beforeValidate: [lockCodeHook],
    beforeChange: [makeCodeHook(STUDENT_CODE_SPEC)],
  },
  fields: [
    codeField,
    {
      name: 'fullName',
      type: 'text',
      label: 'Họ tên học viên',
      required: true,
    },
    {
      name: 'nickname',
      type: 'text',
      label: 'Tên gọi / ghi chú nhận diện',
      admin: {
        description:
          'Biệt danh hoặc ghi chú nhận diện từ sổ gốc (cột "nick"): tuổi, tên phụ huynh, quan hệ anh/em… Không hiển thị cho phụ huynh.',
      },
    },
    {
      name: 'dob',
      type: 'date',
      label: 'Ngày sinh',
      admin: { date: DATE_ONLY },
    },
    {
      name: 'capChinh',
      type: 'relationship',
      label: 'Cấp chính',
      relationTo: 'levels',
      admin: {
        description:
          'Cấp độ hiện tại của học viên (quan hệ tới Levels). Lịch sử qua cấp lưu ở StudentLevels.',
      },
    },
    {
      name: 'location',
      type: 'relationship',
      label: 'Cơ sở',
      relationTo: 'locations',
    },
    {
      name: 'parents',
      type: 'relationship',
      label: 'Phụ huynh',
      relationTo: 'parents',
      hasMany: true,
      admin: {
        description:
          'Quan hệ nhiều–nhiều với Parents.children (nhân viên gán từ phía phụ huynh hoặc học viên).',
      },
    },
    {
      name: 'enrollmentStatus',
      type: 'select',
      label: 'Trạng thái học',
      required: true,
      defaultValue: 'dang_hoc',
      options: [
        { label: 'Đang học', value: 'dang_hoc' },
        { label: 'Tạm nghỉ', value: 'tam_nghi' },
        { label: 'Đã nghỉ', value: 'da_nghi' },
      ],
    },
    {
      name: 'note',
      type: 'textarea',
      label: 'Ghi chú nội bộ',
      admin: {
        description: 'Chỉ nhân viên xem, không hiển thị cho phụ huynh.',
      },
    },
    // Số dư đầu kỳ (đối soát số buổi tồn) 🔒 — ghi chỉ nhân viên.
    // Khi CẢ HAI field được điền, màn "Số buổi tồn" tính tồn theo công thức
    // `opening`: số dư đầu + buổi nộp sau ngày chốt − buổi học sau ngày chốt
    // (ghi đè cách tính mặc định "theo lần nộp gần nhất"). Dùng để chốt con số
    // chuẩn cho HV mà dữ liệu phiếu thu lịch sử chưa đủ. Xem lib/operations/session-balance.ts.
    {
      name: 'soBuoiTonDauKy',
      type: 'number',
      label: 'Số buổi tồn đầu kỳ (chốt thủ công)',
      min: 0,
      admin: {
        description:
          'Số buổi còn tồn TÍNH ĐẾN HẾT "Ngày chốt số dư". Điền cùng "Ngày chốt số dư" để màn Số buổi tồn lấy đây làm mốc thay vì lần nộp gần nhất.',
      },
      access: {
        create: staffOnlyFieldWrite,
        update: staffOnlyFieldWrite,
      },
    },
    {
      name: 'ngayChotSoDu',
      type: 'date',
      label: 'Ngày chốt số dư đầu kỳ',
      admin: {
        description:
          'Mốc chốt "Số buổi tồn đầu kỳ". Sau ngày này, tồn = số dư đầu + buổi đã nộp − buổi đã học.',
        date: DATE_ONLY,
      },
      access: {
        create: staffOnlyFieldWrite,
        update: staffOnlyFieldWrite,
      },
    },
  ],
};
