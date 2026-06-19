import { Link } from '@/i18n/navigation';
import { formatDate, getLevelLabel } from '@/lib/labels';
import {
  getEnrollmentStatusLabel,
  getTuitionStatusLabel,
} from '@/lib/parent-labels';
import {
  getTuitionWarningMessage,
  isTuitionLow,
  sessionsRemaining,
} from '@/lib/parent-portal';
import { levelFromCapChinh } from '@/lib/roadmap';
import type { Location, Student, TuitionCycle } from '@/payload-types';

type StudentOverviewCardProps = {
  student: Student;
  tuition?: TuitionCycle | null;
  /** Tên lớp đang học (từ Enrollments — thay field `class` cũ trên Students). */
  classTitle?: string | null;
  locale?: string;
};

function resolveLocationName(locationRef: Student['location']): string | null {
  if (!locationRef || typeof locationRef === 'number') return null;
  return (locationRef as Location).name;
}

export function StudentOverviewCard({
  student,
  tuition,
  classTitle = null,
  locale = 'vi',
}: StudentOverviewCardProps) {
  const level = levelFromCapChinh(student.capChinh);
  const levelLabel = level ? getLevelLabel(level) : null;
  const locationName = resolveLocationName(student.location);
  const remaining = tuition ? sessionsRemaining(tuition) : null;
  const showLowWarning = tuition ? isTuitionLow(tuition) : false;

  return (
    <Link
      href={`/cong-phu-huynh/tien-do/${student.id}`}
      className="block rounded-xl border border-primary/10 bg-[var(--ds-white)] p-4 shadow-sm transition-shadow hover:shadow-md active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold text-primary">
            {student.fullName}
          </h2>
          {levelLabel ? (
            <p className="mt-0.5 text-sm text-[var(--ds-text-muted)]">
              Cấp{' '}
              <span className="font-semibold text-primary">{levelLabel}</span>
            </p>
          ) : null}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
            student.enrollmentStatus === 'dang_hoc'
              ? 'bg-[var(--ds-teal)]/15 text-primary'
              : 'bg-primary/10 text-[var(--ds-text-muted)]'
          }`}
        >
          {getEnrollmentStatusLabel(student.enrollmentStatus)}
        </span>
      </div>

      <dl className="mt-3 space-y-1.5 text-sm">
        {classTitle ? (
          <div className="flex gap-2">
            <dt className="shrink-0 text-[var(--ds-text-muted)]">Lớp</dt>
            <dd className="font-medium text-[var(--ds-text)]">{classTitle}</dd>
          </div>
        ) : null}
        {locationName ? (
          <div className="flex gap-2">
            <dt className="shrink-0 text-[var(--ds-text-muted)]">Cơ sở</dt>
            <dd className="font-medium text-[var(--ds-text)]">{locationName}</dd>
          </div>
        ) : null}
        {tuition ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <dt className="text-[var(--ds-text-muted)]">Học phí</dt>
            <dd className="font-medium text-[var(--ds-text)]">
              Còn{' '}
              <span
                className={
                  tuition.status === 'sap_het' ? 'text-primary font-bold' : ''
                }
              >
                {remaining}
              </span>{' '}
              / {tuition.sessionsTotal} buổi
            </dd>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                tuition.status === 'sap_het'
                  ? 'bg-primary/15 text-primary'
                  : tuition.status === 'da_het'
                    ? 'bg-primary/10 text-[var(--ds-text-muted)]'
                    : 'bg-[var(--ds-teal)]/15 text-primary'
              }`}
            >
              {getTuitionStatusLabel(tuition.status)}
            </span>
          </div>
        ) : (
          <p className="text-xs text-[var(--ds-text-muted)]">
            Chưa có thông tin gói buổi — liên hệ trung tâm nếu cần.
          </p>
        )}
      </dl>

      {tuition?.expectedEndDate ? (
        <p className="mt-2 text-xs text-[var(--ds-text-muted)]">
          Dự kiến hết gói: {formatDate(tuition.expectedEndDate, locale)}
        </p>
      ) : null}

      {showLowWarning && tuition ? (
        <p className="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary">
          {getTuitionWarningMessage(tuition)}
        </p>
      ) : null}

      <p className="mt-3 text-xs font-semibold text-primary">
        Xem tiến độ chi tiết →
      </p>
    </Link>
  );
}
