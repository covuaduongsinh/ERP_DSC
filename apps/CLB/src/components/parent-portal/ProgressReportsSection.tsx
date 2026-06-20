import { RichTextContent } from '@/components/ui/RichTextContent'
import { formatDate } from '@/lib/labels'
import { getLevelLabel } from '@/lib/labels'
import type { Coach, ProgressReport } from '@/payload-types'

type ProgressReportsSectionProps = {
  reports: ProgressReport[]
  locale?: string
}

function resolveCoachName(coach: ProgressReport['coach']): string | null {
  if (!coach || typeof coach === 'number') return null
  return (coach as Coach).name
}

/** Một mục text/textarea giữ xuống dòng (btvn, kế hoạch, …). */
function TextBlock({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div className="mb-3">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">{label}</p>
      <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--ds-text)]">{value}</p>
    </div>
  )
}

export function ProgressReportsSection({ reports, locale = 'vi' }: ProgressReportsSectionProps) {
  if (reports.length === 0) {
    return (
      <p className="text-sm text-[var(--ds-text-muted)]">
        Chưa có báo cáo đánh giá định kỳ. Trung tâm sẽ cập nhật sau mỗi kỳ học.
      </p>
    )
  }

  return (
    <ol className="space-y-4">
      {reports.map((report) => {
        const coachName = resolveCoachName(report.coach)
        const levelLabel = report.level ? getLevelLabel(report.level) : null

        return (
          <li key={report.id} className="rounded-xl border border-primary/10 bg-[var(--ds-bg)] p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-primary">{report.period}</h3>
                {report.publishedAt ? (
                  <p className="text-xs text-[var(--ds-text-muted)]">
                    {formatDate(report.publishedAt, locale)}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {typeof report.yThuc === 'number' ? (
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold text-primary">
                    Ý thức {report.yThuc}/10
                  </span>
                ) : null}
                {levelLabel ? (
                  <span className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold text-[var(--ds-text-on-primary)]">
                    Cấp {levelLabel}
                  </span>
                ) : null}
              </div>
            </div>

            {report.nhanXetChung ? (
              <div className="mb-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
                  Nhận xét chung
                </p>
                <RichTextContent data={report.nhanXetChung} />
              </div>
            ) : null}

            <TextBlock label="Bài tập về nhà" value={report.btvn} />
            <TextBlock label="Tham gia giải đấu" value={report.thamGiaGiaiDau} />
            <TextBlock label="Các sách đã học" value={report.cacSachDaHoc} />
            <TextBlock label="Kế hoạch" value={report.keHoach} />

            {report.coachComment ? (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary">
                  Nhận xét HLV
                  {coachName ? ` — ${coachName}` : ''}
                </p>
                <RichTextContent data={report.coachComment} />
              </div>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}
