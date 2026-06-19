import type { CollectionConfig, FieldHook, Where } from 'payload';
import { staffOnly, readByStudentRelation } from '../access/parents';
import { withBranchScope } from '../access/branch';
import { DATE_ONLY } from '../lib/admin-date';
import { codeField, TUITION_CYCLE_CODE_SPEC } from '../lib/codes/field';
import { makeCodeHook } from '../lib/codes/makeCodeHook';
import { lockCodeHook } from '../lib/codes/lockCodeHook';

/** Giá trị quan hệ → students: id số, `{ id }`, hoặc null/undefined. */
type StudentRef = number | { id?: number | null } | null | undefined;

/** Input thuần để dựng `where` đếm buổi của MỘT chu kỳ (tách ra để unit-test). */
export type SessionsUsedWindow = {
  student?: StudentRef;
  startDate?: string | Date | null;
  expectedEndDate?: string | Date | null;
};

/** Rút id số từ giá trị quan hệ student (id | `{ id }` | null). */
export function resolveStudentId(student: StudentRef): number | undefined {
  if (typeof student === 'number') return student;
  if (student && typeof student === 'object' && typeof student.id === 'number') {
    return student.id;
  }
  return undefined;
}

/**
 * Chuẩn hóa một mốc ngày về ĐẦU/CUỐI ngày theo UTC, trả ISO string.
 * Trả null nếu rỗng hoặc không phải ngày hợp lệ (⇒ bỏ qua cận đó).
 *
 * Mục đích: `[startDate, expectedEndDate]` bao trùm CẢ ngày ở hai đầu mút, nên
 * một buổi điểm danh đúng ngày startDate (giờ bất kỳ) hay đúng ngày
 * expectedEndDate (kể cả 23:59) vẫn được tính.
 */
function toUtcDayBound(
  value: string | Date | null | undefined,
  edge: 'start' | 'end',
): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  if (edge === 'start') d.setUTCHours(0, 0, 0, 0);
  else d.setUTCHours(23, 59, 59, 999);
  return d.toISOString();
}

/**
 * Dựng `where` đếm buổi "Có mặt" thuộc về MỘT chu kỳ học phí:
 *  - cùng học viên (`student`);
 *  - `status = co_mat` (loại vắng/phép);
 *  - `date ∈ [startDate, expectedEndDate]`, bao trùm cả ngày ở 2 đầu mút (UTC).
 *    `expectedEndDate` rỗng ⇒ CỬA MỞ (không chặn cận trên). `startDate` rỗng ⇒
 *    không chặn cận dưới (phòng thủ; thực tế startDate là bắt buộc).
 *
 * Trả null nếu chu kỳ chưa có `student` hợp lệ ⇒ caller coi như 0 buổi.
 */
export function buildSessionsUsedWhere(input: SessionsUsedWindow): Where | null {
  const studentId = resolveStudentId(input.student);
  if (typeof studentId !== 'number') return null;

  const and: Where[] = [
    { student: { equals: studentId } },
    { status: { equals: 'co_mat' } },
  ];

  const startBound = toUtcDayBound(input.startDate, 'start');
  if (startBound) and.push({ date: { greater_than_equal: startBound } });

  const endBound = toUtcDayBound(input.expectedEndDate, 'end');
  if (endBound) and.push({ date: { less_than_equal: endBound } });

  return { and };
}

/**
 * Đếm số buổi điểm danh "Có mặt" của học viên TRONG cửa sổ của chu kỳ.
 *
 * Dùng cho virtual field `sessionsUsed`: TÍNH lại mỗi lần đọc, KHÔNG lưu DB,
 * nên nhân viên không nhập tay được và luôn đồng bộ với Attendance.
 * `overrideAccess: true` để đếm ĐÚNG tổng buổi của học viên (không phải vấn đề
 * leak: đã lọc cứng theo `studentId` của chính cycle mà người gọi được phép đọc).
 */
export const countAttendedSessions: FieldHook = async ({ req, data }) => {
  const where = buildSessionsUsedWhere({
    student: data?.student as StudentRef,
    startDate: data?.startDate as string | null | undefined,
    expectedEndDate: data?.expectedEndDate as string | null | undefined,
  });
  if (!where) return 0;

  const { totalDocs } = await req.payload.count({
    collection: 'attendance',
    where,
    req,
    overrideAccess: true,
  });
  return totalDocs;
};

/**
 * Chu kỳ học phí / gói buổi — schema GĐ4.
 *
 * Access control quan hệ: phụ huynh CHỈ đọc cycle của con mình (lọc qua
 * `student` ∈ parent.children). Ghi: chỉ staff.
 */
export const TuitionCycles: CollectionConfig = {
  slug: 'tuition-cycles',
  labels: {
    singular: 'Chu kỳ học phí',
    plural: 'Chu kỳ học phí',
  },
  admin: {
    group: 'Tài chính',
    useAsTitle: 'student',
    defaultColumns: [
      'code',
      'student',
      'package',
      'sessionsUsed',
      'sessionsTotal',
      'status',
      'expectedEndDate',
    ],
  },
  timestamps: true,
  hooks: {
    beforeValidate: [lockCodeHook],
    beforeChange: [makeCodeHook(TUITION_CYCLE_CODE_SPEC)],
  },
  access: {
    create: staffOnly,
    // 🔒 Branch-scope theo `student.location`: nhân viên bị-khóa-cơ-sở chỉ
    // đọc/sửa/xóa cycle của HV cùng cơ sở; vai trò global xem/ghi tất. Luồng phụ
    // huynh giữ NGUYÊN (gate trả Where ⇒ withBranchScope trả nguyên). `create`
    // KHÔNG scope. Virtual `sessionsUsed` đếm Attendance bằng `overrideAccess:true`
    // ⇒ KHÔNG bị branch ảnh hưởng.
    read: withBranchScope(readByStudentRelation(), 'student.location'),
    update: withBranchScope(staffOnly, 'student.location'),
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
      name: 'package',
      type: 'select',
      label: 'Gói buổi',
      required: true,
      options: [
        { label: '10 buổi', value: '10' },
        { label: '20 buổi', value: '20' },
        { label: '40 buổi', value: '40' },
      ],
    },
    {
      name: 'sessionsTotal',
      type: 'number',
      label: 'Tổng số buổi',
      required: true,
      min: 1,
    },
    {
      name: 'sessionsUsed',
      type: 'number',
      label: 'Buổi đã học',
      // Virtual: TÍNH từ đếm Attendance (status=co_mat) TRONG cửa sổ chu kỳ
      // [startDate, expectedEndDate], KHÔNG lưu DB, không nhập tay. Nguồn sự
      // thật duy nhất là collection Attendance.
      virtual: true,
      admin: {
        readOnly: true,
        description:
          'Tự động = số buổi điểm danh "Có mặt" của học viên trong [Ngày bắt đầu, Ngày dự kiến hết gói] (không lưu, không nhập tay).',
      },
      hooks: {
        afterRead: [countAttendedSessions],
      },
    },
    {
      name: 'startDate',
      type: 'date',
      label: 'Ngày bắt đầu',
      required: true,
      admin: { date: DATE_ONLY },
    },
    {
      name: 'expectedEndDate',
      type: 'date',
      label: 'Ngày dự kiến hết gói',
      admin: { date: DATE_ONLY },
    },
    {
      name: 'status',
      type: 'select',
      label: 'Trạng thái gói',
      required: true,
      defaultValue: 'dang_hoc',
      options: [
        { label: 'Đang học', value: 'dang_hoc' },
        { label: 'Sắp hết', value: 'sap_het' },
        { label: 'Đã hết', value: 'da_het' },
      ],
    },
  ],
};
