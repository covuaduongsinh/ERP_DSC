import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'
import type { Coach, Student } from '@/payload-types'
import { chessLevelSelectOptions } from '@/lib/roadmap'
import { DRAFT_PROGRESS_REPORTS_WHERE } from '@/lib/progress-reports/publish'
import { PublishQueueClient, type DraftReportRow } from './PublishQueueClient'

/** Trần số dòng nạp ra trang (hàng đợi nháp thực tế chỉ vài chục). */
const QUEUE_LIMIT = 500

const LEVEL_LABELS = new Map(chessLevelSelectOptions().map((o) => [o.value, o.label]))

/**
 * Hàng đợi phát hành báo cáo tiến độ (admin view — staff tool).
 *
 * Server-side liệt kê báo cáo còn NHÁP (`publishedAt = null`) bằng Local API với
 * `user` = nhân viên đang đăng nhập + `overrideAccess: false` ⇒ access control
 * của collection vẫn là hàng rào (phụ huynh không bao giờ tới được view admin,
 * nhưng giữ defense-in-depth). Client xử lý chọn + xác nhận + gọi Server Action.
 */
export async function PublishQueueView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props
  const {
    req: { user, payload, i18n },
    permissions,
    visibleEntities,
    locale,
  } = initPageResult

  if (!user) {
    return (
      <Gutter>
        <p>Bạn cần đăng nhập tài khoản nhân viên để sử dụng trang này.</p>
      </Gutter>
    )
  }

  const { docs, totalDocs } = await payload.find({
    collection: 'progress-reports',
    where: DRAFT_PROGRESS_REPORTS_WHERE,
    user,
    overrideAccess: false,
    depth: 1, // populate student + coach để hiển thị tên
    limit: QUEUE_LIMIT,
    sort: '-updatedAt',
  })

  const initialDrafts: DraftReportRow[] = docs.map((report) => {
    const student = report.student as Student | number | null
    const coach = report.coach as Coach | number | null
    return {
      id: report.id,
      studentName: student && typeof student === 'object' ? student.fullName : 'Học viên',
      period: report.period,
      levelLabel: report.level ? (LEVEL_LABELS.get(report.level) ?? report.level) : null,
      coachName: coach && typeof coach === 'object' ? coach.name : null,
      updatedAt: report.updatedAt,
    }
  })

  return (
    <DefaultTemplate
      i18n={i18n}
      locale={locale}
      params={params}
      payload={payload}
      permissions={permissions}
      searchParams={searchParams}
      user={user}
      visibleEntities={visibleEntities}
    >
      <Gutter>
        <header style={{ marginBottom: 16 }}>
          <h1>Phát hành báo cáo tiến độ</h1>
          <p style={{ color: 'var(--theme-elevation-500)' }}>
            Báo cáo nháp chưa hiển thị cho phụ huynh. Chọn các báo cáo đã hoàn thiện rồi phát hành —
            sau khi xác nhận, phụ huynh sẽ thấy ngay.
          </p>
        </header>
        <PublishQueueClient initialDrafts={initialDrafts} truncated={totalDocs > docs.length} />
      </Gutter>
    </DefaultTemplate>
  )
}
