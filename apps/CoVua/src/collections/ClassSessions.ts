import type { CollectionConfig } from 'payload';
import { staffOnly } from '../access/parents';
import { withBranchScope } from '../access/branch';
import { buildAuditHooks } from '../lib/audit/log';
import { DATE_ONLY } from '../lib/admin-date';

/**
 * Buổi học (ClassSession) — MỘT lần MỘT lớp diễn ra vào MỘT ngày dương lịch.
 *
 * Xương sống vận hành lớp (Phase 2): nền cho nhập nhận xét buổi trong app, hủy/
 * dạy bù, lịch theo GV, thống kê. Buổi sinh THEO NHU CẦU từ `classes.lichHoc`
 * (mẫu lặp tuần) qua `ensureSession` — KHÔNG cron. Mỗi buổi snapshot slot theo
 * GIÁ TRỊ (thu/giờ/phòng) tại thời điểm sinh, nên sửa `lichHoc` không làm biến
 * đổi buổi cũ. Idempotent qua `khoaBuoi` (`lop|YYYY-MM-DD`, unique).
 *
 * Chuẩn hóa: trường CẤP BUỔI (kiến thức mới, BTVN giao, KH buổi sau, sách, GV
 * thực tế) ở đây; trường CẤP HV (điểm danh, ý thức, nhận xét cá nhân…) ở
 * `attendance` (FK `session`). KHÔNG đổi nguồn đếm buổi — "số buổi tồn" vẫn theo
 * `attendance(co_mat)`; buổi học là tầng vận hành/thống kê.
 *
 * Buổi có thể GẮN LỚP (đi-tới: `lop` + `location` từ lớp) hoặc KHÔNG-LỚP (lịch sử:
 * `lop` null, `buoi` = mã khối, `location` từ HV) — xem GĐ2 backfill.
 *
 * Access (🔒 fail-closed, branch-scope qua `location` — KHÔNG public):
 *  - read/update/delete: staff bị-khóa-cơ-sở chỉ thấy buổi cùng cơ sở (`location`);
 *    vai trò global thấy tất. `create` KHÔNG scope (ensureSession/backfill chạy
 *    overrideAccess; nhập tay = staff).
 */
export const ClassSessions: CollectionConfig = {
  slug: 'class-sessions',
  labels: {
    singular: 'Buổi học',
    plural: 'Buổi học',
  },
  admin: {
    group: 'Đào tạo',
    useAsTitle: 'khoaBuoi',
    defaultColumns: ['date', 'lop', 'trangThai', 'coachThucTe'],
  },
  timestamps: true,
  access: {
    create: staffOnly,
    read: withBranchScope(staffOnly, 'location'),
    update: withBranchScope(staffOnly, 'location'),
    delete: withBranchScope(staffOnly, 'location'),
  },
  hooks: buildAuditHooks('class-sessions'),
  fields: [
    {
      name: 'lop',
      type: 'relationship',
      label: 'Lớp',
      relationTo: 'classes',
      admin: { description: 'Buổi gắn lớp (đi-tới). Để trống với buổi lịch sử (theo mã buổi).' },
    },
    {
      name: 'location',
      type: 'relationship',
      label: 'Cơ sở',
      relationTo: 'locations',
      admin: {
        description: 'Cơ sở của buổi — trục phân quyền. Buổi gắn lớp lấy từ lớp; buổi lịch sử lấy từ HV.',
      },
    },
    {
      name: 'buoi',
      type: 'text',
      label: 'Mã buổi (lịch sử)',
      admin: { description: 'Nhãn khối/đợt lịch sử (vd C16, B119). Trống với buổi tạo mới theo lớp.' },
    },
    {
      name: 'date',
      type: 'date',
      label: 'Ngày học',
      required: true,
      admin: { date: DATE_ONLY },
    },
    {
      name: 'thu',
      type: 'select',
      label: 'Thứ',
      options: [
        { label: 'Thứ 2', value: 't2' },
        { label: 'Thứ 3', value: 't3' },
        { label: 'Thứ 4', value: 't4' },
        { label: 'Thứ 5', value: 't5' },
        { label: 'Thứ 6', value: 't6' },
        { label: 'Thứ 7', value: 't7' },
        { label: 'Chủ nhật', value: 'cn' },
      ],
      admin: { description: 'Suy từ ngày khi sinh buổi (snapshot từ lịch tuần).' },
    },
    {
      name: 'gioBatDau',
      type: 'text',
      label: 'Giờ bắt đầu (HH:MM)',
    },
    {
      name: 'gioKetThuc',
      type: 'text',
      label: 'Giờ kết thúc (HH:MM)',
    },
    {
      name: 'phong',
      type: 'text',
      label: 'Phòng',
    },
    {
      name: 'coachThucTe',
      type: 'relationship',
      label: 'GV thực dạy',
      relationTo: 'coaches',
      admin: { description: 'GV thực tế đứng buổi (dạy thay). Để trống = dùng GV chính của lớp.' },
    },
    {
      name: 'troGiangThucTe',
      type: 'relationship',
      label: 'Trợ giảng thực tế',
      relationTo: 'coaches',
    },
    {
      name: 'trangThai',
      type: 'select',
      label: 'Trạng thái buổi',
      required: true,
      defaultValue: 'du_kien',
      options: [
        { label: 'Dự kiến', value: 'du_kien' },
        { label: 'Đã dạy', value: 'da_day' },
        { label: 'Hủy', value: 'huy' },
        { label: 'Dạy bù', value: 'bu' },
      ],
    },
    // ── Nội dung buổi (CẤP LỚP — nhập 1 lần/buổi) ────────────────────────────
    {
      name: 'mucTieu',
      type: 'textarea',
      label: 'Mục tiêu',
      admin: { description: 'Mục tiêu bài học (điền sẵn khi áp khung lộ trình).' },
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
      name: 'khBuoiSau',
      type: 'textarea',
      label: 'Kế hoạch buổi sau',
    },
    {
      name: 'sachDangHoc',
      type: 'text',
      label: 'Sách đang học',
    },
    {
      name: 'ghiChuBuoi',
      type: 'textarea',
      label: 'Ghi chú buổi',
      admin: { description: 'Lý do hủy / ghi chú vận hành.' },
    },
    {
      name: 'buoiGoc',
      type: 'relationship',
      label: 'Buổi gốc (cho buổi bù)',
      relationTo: 'class-sessions',
      admin: { description: 'Với buổi dạy bù: trỏ về buổi đã hủy mà nó thay thế.' },
    },
    {
      name: 'khoaBuoi',
      type: 'text',
      label: 'Khóa buổi',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        position: 'sidebar',
        description: 'Khóa idempotent khi sinh buổi: lop|YYYY-MM-DD. Chống tạo trùng.',
      },
    },
  ],
};
