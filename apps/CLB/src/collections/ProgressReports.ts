import type { CollectionConfig, CollectionBeforeValidateHook } from 'payload'
import { staffOnly, readByStudentRelation } from '../access/parents'
import { withBranchScope } from '../access/branch'
import { DATE_ONLY } from '../lib/admin-date'
import { buildAuditHooks } from '../lib/audit/log'
import { chessLevelSelectOptions } from '../lib/roadmap'
import { PROGRESS_REPORT_PERIODS } from '../lib/imports/progress-reports'
import { codeField, PROGRESS_REPORT_CODE_SPEC } from '../lib/codes/field'
import { makeCodeHook } from '../lib/codes/makeCodeHook'
import { lockCodeHook } from '../lib/codes/lockCodeHook'

/**
 * Chặn 2 báo cáo cùng (học viên, kỳ). Importer đã idempotent theo khóa này khi
 * NHẬP FILE, nhưng tạo/sửa TAY ở /admin thì chưa — hook báo lỗi tiếng Việt thân
 * thiện TRƯỚC khi đụng unique index DB (migration
 * 20260603_100000_progress_reports_unique_student_period). Defense-in-depth.
 */
const preventDuplicateStudentPeriod: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  req,
}) => {
  const studentRaw = data?.student ?? originalDoc?.student
  const period = data?.period ?? originalDoc?.period
  const student =
    studentRaw && typeof studentRaw === 'object' ? (studentRaw as { id?: number }).id : studentRaw
  if (typeof student !== 'number' || !period) return data

  const currentId = originalDoc?.id ?? (data as { id?: number } | undefined)?.id
  const { docs } = await req.payload.find({
    collection: 'progress-reports',
    where: {
      and: [
        { student: { equals: student } },
        { period: { equals: period } },
        ...(currentId ? [{ id: { not_equals: currentId } }] : []),
      ],
    },
    overrideAccess: true,
    depth: 0,
    limit: 1,
    req,
  })
  if (docs.length > 0) {
    throw new Error(
      `Học viên này đã có báo cáo kỳ "${period}". Mỗi học viên chỉ một báo cáo mỗi kỳ — hãy sửa báo cáo hiện có thay vì tạo bản mới.`,
    )
  }
  return data
}

/**
 * Báo cáo tiến độ định kỳ — schema GĐ4 (access control: Claude Code).
 *
 * Dữ liệu thật (DanhGiaDinhKy_long.csv) gộp ưu/nhược điểm vào một ô nên dùng
 * `nhanXetChung` (richText) thay cho cặp strengths/areasToImprove cũ.
 */
export const ProgressReports: CollectionConfig = {
  slug: 'progress-reports',
  labels: {
    singular: 'Báo cáo tiến độ',
    plural: 'Báo cáo tiến độ',
  },
  admin: {
    group: 'Đào tạo',
    useAsTitle: 'period',
    defaultColumns: ['code', 'period', 'student', 'level', 'coach', 'publishedAt'],
    components: {
      beforeListTable: ['/components/admin/export/ExportButtons#ExportButtons'],
    },
  },
  timestamps: true,
  access: {
    create: staffOnly,
    // Phụ huynh chỉ thấy báo cáo ĐÃ phát hành (publishedAt khác null) của con
    // mình (gate trả Where ⇒ withBranchScope trả nguyên, giữ filter publishedAt,
    // KHÔNG chồng branch). 🔒 Staff: gate trả `true` ⇒ branch-scope theo
    // `student.location` (bị-khóa chỉ đọc báo cáo HV cùng cơ sở; global đọc tất).
    read: withBranchScope(
      readByStudentRelation({ publishedAt: { not_equals: null } }),
      'student.location',
    ),
    update: withBranchScope(staffOnly, 'student.location'),
    delete: withBranchScope(staffOnly, 'student.location'),
  },
  hooks: {
    ...buildAuditHooks('progress-reports'),
    beforeValidate: [lockCodeHook, preventDuplicateStudentPeriod],
    beforeChange: [makeCodeHook(PROGRESS_REPORT_CODE_SPEC)],
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
      name: 'period',
      type: 'select',
      label: 'Kỳ báo cáo',
      required: true,
      options: PROGRESS_REPORT_PERIODS.map((p) => ({ label: p, value: p })),
      admin: {
        description: 'Kỳ đánh giá định kỳ (kết hợp học viên thành khóa idempotent).',
      },
    },
    {
      name: 'level',
      type: 'select',
      label: 'Cấp độ tại kỳ báo cáo',
      options: chessLevelSelectOptions(),
      admin: {
        description: 'Cấp trên lộ trình @ds/brand tại thời điểm báo cáo.',
      },
    },
    {
      name: 'yThuc',
      type: 'number',
      label: 'Ý thức (0–10)',
      min: 0,
      max: 10,
    },
    {
      name: 'btvn',
      type: 'textarea',
      label: 'Bài tập về nhà',
    },
    {
      name: 'thamGiaGiaiDau',
      type: 'text',
      label: 'Tham gia giải đấu',
    },
    {
      name: 'cacSachDaHoc',
      type: 'text',
      label: 'Các sách đã học',
    },
    {
      name: 'nhanXetChung',
      type: 'richText',
      label: 'Nhận xét chung',
    },
    {
      name: 'keHoach',
      type: 'textarea',
      label: 'Kế hoạch',
    },
    {
      name: 'coachComment',
      type: 'richText',
      label: 'Nhận xét HLV',
    },
    {
      name: 'coach',
      type: 'relationship',
      label: 'HLV',
      relationTo: 'coaches',
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'Ngày phát hành',
      admin: {
        description: 'Để trống = nháp (phụ huynh KHÔNG thấy). Điền ngày = phát hành cho phụ huynh.',
        date: DATE_ONLY,
      },
    },
  ],
}
