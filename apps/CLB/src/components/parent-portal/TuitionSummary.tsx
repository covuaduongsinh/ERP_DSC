import { formatDate } from '@/lib/labels'
import { getTuitionStatusLabel } from '@/lib/parent-labels'
import { isTuitionLow, sessionsRemaining } from '@/lib/parent-portal'
import type { TuitionCycle } from '@/payload-types'
import { RenewalRequestButton } from './RenewalRequestButton'

type TuitionSummaryProps = {
  studentId: number
  tuition: TuitionCycle | null
  hasPendingRequest?: boolean
  locale?: string
}

export function TuitionSummary({
  studentId,
  tuition,
  hasPendingRequest = false,
  locale = 'vi',
}: TuitionSummaryProps) {
  if (!tuition) {
    return (
      <div className="rounded-xl border border-dashed border-primary/20 bg-[var(--ds-bg)] p-4 text-sm text-[var(--ds-text-muted)]">
        Chưa có thông tin gói buổi. Liên hệ trung tâm để được tư vấn tái tục.
      </div>
    )
  }

  const remaining = sessionsRemaining(tuition)
  const isLow = isTuitionLow(tuition)

  return (
    <div
      className={`rounded-xl border p-4 ${
        isLow ? 'border-primary/30 bg-primary/5' : 'border-primary/10 bg-[var(--ds-white)]'
      }`}
    >
      {isLow ? (
        <p className="mb-3 text-sm font-bold text-primary" role="status">
          Còn {remaining} buổi, liên hệ gia hạn
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-primary">Gói {tuition.package} buổi</p>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
            isLow
              ? 'bg-primary text-[var(--ds-text-on-primary)]'
              : 'bg-[var(--ds-teal)]/15 text-primary'
          }`}
        >
          {getTuitionStatusLabel(tuition.status)}
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold text-primary">
        {remaining}
        <span className="ml-1 text-sm font-medium text-[var(--ds-text-muted)]">
          / {tuition.sessionsTotal} buổi còn lại
        </span>
      </p>
      {tuition.expectedEndDate ? (
        <p className="mt-1 text-xs text-[var(--ds-text-muted)]">
          Dự kiến hết gói: {formatDate(tuition.expectedEndDate, locale)}
        </p>
      ) : null}
      {isLow ? (
        <RenewalRequestButton
          studentId={studentId}
          tuitionCycleId={tuition.id}
          hasPendingRequest={hasPendingRequest}
          className="mt-4"
        />
      ) : null}
    </div>
  )
}
