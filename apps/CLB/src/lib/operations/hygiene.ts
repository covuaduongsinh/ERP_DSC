import 'server-only'
import type { Payload } from 'payload'
import type { Student, TuitionCycle, User } from '@/payload-types'

/**
 * Đếm "DỮ LIỆU CẦN HOÀN THIỆN" cho màn /du-lieu-can-hoan-thien.
 *
 * Cách SIẾT MỀM (đã chốt với vận hành): KHÔNG khóa cứng field ở schema (tránh vỡ
 * importer), thay vào đó phơi các bản ghi thiếu dữ liệu quan trọng để nhân viên
 * dọn dần. Mỗi tín hiệu = số đếm + vài mẫu (link tới bản ghi để sửa ngay).
 *
 * Branch-scope: students đọc với `overrideAccess:false + user` ⇒ vai trò bị-khóa
 * chỉ thấy HV cùng cơ sở (đồng bộ withBranchScope). Chu kỳ đọc staffOnly ⇒ toàn
 * cơ sở (nhất quán hàng đợi/KPI). Dùng `disableErrors:true` để role thiếu quyền
 * nhận 0 thay vì lỗi.
 */

export interface HygieneSample {
  id: number
  label: string
  href: string
}

export interface HygieneSignal {
  key: string
  label: string
  hint: string
  count: number
  samples: HygieneSample[]
}

const SAMPLE_LIMIT = 10

function studentName(value: unknown): string {
  if (value && typeof value === 'object') {
    const s = value as { fullName?: string }
    if (typeof s.fullName === 'string' && s.fullName.trim()) return s.fullName.trim()
  }
  return '—'
}

async function studentSignal(
  payload: Payload,
  user: User,
  key: string,
  label: string,
  hint: string,
  field: 'location' | 'capChinh' | 'parents',
): Promise<HygieneSignal> {
  const { totalDocs, docs } = await payload.find({
    collection: 'students',
    where: {
      and: [
        { [field]: { exists: false } },
        // Chỉ HV còn hoạt động (đang học / tạm nghỉ) — HV đã nghỉ không cần dọn.
        { enrollmentStatus: { not_equals: 'da_nghi' } },
      ],
    },
    user,
    overrideAccess: false,
    disableErrors: true,
    depth: 0,
    limit: SAMPLE_LIMIT,
    sort: 'fullName',
  })
  return {
    key,
    label,
    hint,
    count: totalDocs,
    samples: (docs as Student[]).map((s) => ({
      id: s.id,
      label: s.fullName,
      href: `/admin/collections/students/${s.id}`,
    })),
  }
}

export async function loadDataHygiene(payload: Payload, user: User): Promise<HygieneSignal[]> {
  const [missingLocation, missingLevel, missingParents] = await Promise.all([
    studentSignal(
      payload,
      user,
      'student_location',
      'Học viên chưa gán cơ sở',
      'Thiếu cơ sở ⇒ phân quyền theo cơ sở & báo cáo theo cơ sở bị lệch.',
      'location',
    ),
    studentSignal(
      payload,
      user,
      'student_level',
      'Học viên chưa gán cấp chính',
      'Thiếu cấp chính ⇒ báo cáo tiến độ theo cấp không truy được.',
      'capChinh',
    ),
    studentSignal(
      payload,
      user,
      'student_parents',
      'Học viên chưa có phụ huynh',
      'Chưa nối phụ huynh ⇒ chưa onboarding được cổng phụ huynh.',
      'parents',
    ),
  ])

  // Chu kỳ đang hiệu lực nhưng thiếu ngày dự kiến hết ⇒ không bao giờ kích "sắp
  // hết hạn" (chỉ kích theo số buổi). Nhắc nhân viên điền để theo dõi theo ngày.
  const { totalDocs: cycleCount, docs: cycleDocs } = await payload.find({
    collection: 'tuition-cycles',
    where: {
      and: [{ status: { in: ['dang_hoc', 'sap_het'] } }, { expectedEndDate: { exists: false } }],
    },
    user,
    overrideAccess: false,
    disableErrors: true,
    depth: 1,
    limit: SAMPLE_LIMIT,
    sort: 'startDate',
  })
  const missingEndDate: HygieneSignal = {
    key: 'cycle_end_date',
    label: 'Chu kỳ học phí chưa có ngày dự kiến hết',
    hint: 'Thiếu ngày hết ⇒ không nhắc tái tục theo hạn (chỉ theo số buổi).',
    count: cycleCount,
    samples: (cycleDocs as TuitionCycle[]).map((c) => ({
      id: c.id,
      label: `${studentName(c.student)} — gói ${c.package}`,
      href: `/admin/collections/tuition-cycles/${c.id}`,
    })),
  }

  return [missingLocation, missingLevel, missingParents, missingEndDate]
}
