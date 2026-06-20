import { formatDate } from '@/lib/labels'
import { getAttendanceStatusLabel } from '@/lib/parent-labels'
import type { Attendance } from '@/payload-types'

type AttendanceHistoryProps = {
  records: Attendance[]
  locale?: string
}

const statusStyles: Record<Attendance['status'], { badge: string; dot: string }> = {
  co_mat: {
    badge: 'bg-[var(--ds-teal)]/15 text-primary',
    dot: 'bg-[var(--ds-teal)]',
  },
  vang: {
    badge: 'bg-primary/10 text-primary',
    dot: 'bg-primary',
  },
  phep: {
    badge: 'bg-primary/10 text-[var(--ds-text-muted)]',
    dot: 'bg-[var(--ds-blue-light)]',
  },
}

export function AttendanceHistory({ records, locale = 'vi' }: AttendanceHistoryProps) {
  if (records.length === 0) {
    return (
      <p className="text-sm text-[var(--ds-text-muted)]">
        Chưa có dữ liệu điểm danh trên hệ thống.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-primary/10">
      {records.map((record) => {
        const styles = statusStyles[record.status]
        return (
          <li
            key={record.id}
            className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${styles.dot}`} aria-hidden />
              <span className="text-sm font-medium text-[var(--ds-text)]">
                {formatDate(record.date, locale)}
              </span>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${styles.badge}`}
            >
              {getAttendanceStatusLabel(record.status)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
