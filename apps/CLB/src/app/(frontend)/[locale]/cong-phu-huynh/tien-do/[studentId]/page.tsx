import { Link } from '@/i18n/navigation'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { AttendanceHistory } from '@/components/parent-portal/AttendanceHistory'
import { ParentPortalHeader } from '@/components/parent-portal/ParentPortalHeader'
import { ProgressReportsSection } from '@/components/parent-portal/ProgressReportsSection'
import { RoadmapProgress } from '@/components/parent-portal/RoadmapProgress'
import { TuitionSummary } from '@/components/parent-portal/TuitionSummary'
import { getEnrollmentStatusLabel } from '@/lib/parent-labels'
import { getCurrentParent } from '@/lib/parent-auth'
import {
  fetchStudentById,
  fetchStudentProgress,
  fetchPendingRenewalStudentIds,
  requireAuthenticatedParent,
  resolveStudentIdParam,
  toParentPayloadUser,
} from '@/lib/parent-portal'
import { getLevelLabel } from '@/lib/labels'
import { levelFromCapChinh } from '@/lib/roadmap'
import type { Location } from '@/payload-types'

type Props = {
  params: Promise<{ locale: string; studentId: string }>
}

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props) {
  const { studentId: rawId } = await params
  const studentId = resolveStudentIdParam(rawId)
  if (!studentId) return { title: 'Tiến độ học' }

  const parent = await getCurrentParent()
  if (!parent) return { title: 'Tiến độ học' }

  const student = await fetchStudentById(toParentPayloadUser(parent), studentId)
  if (!student) return { title: 'Tiến độ học' }

  return {
    title: `Tiến độ — ${student.fullName} | Cổng phụ huynh`,
  }
}

export default async function StudentProgressPage({ params }: Props) {
  const { locale, studentId: rawId } = await params
  setRequestLocale(locale)

  const studentId = resolveStudentIdParam(rawId)
  if (!studentId) notFound()

  const { parent, parentUser } = await requireAuthenticatedParent()

  const [student, progress, pendingRenewals] = await Promise.all([
    fetchStudentById(parentUser, studentId),
    fetchStudentProgress(parentUser, studentId),
    fetchPendingRenewalStudentIds(parentUser),
  ])

  if (!student) notFound()

  const currentLevel = levelFromCapChinh(student.capChinh)
  const levelLabel = currentLevel ? getLevelLabel(currentLevel) : null
  const classTitle = progress.classTitle
  const locationName =
    student.location && typeof student.location !== 'number'
      ? (student.location as Location).name
      : null

  return (
    <div className="min-h-[60vh] bg-[var(--ds-bg)]">
      <ParentPortalHeader parentName={parent.fullName} />

      <div className="mx-auto max-w-lg px-4 py-6">
        <Link
          href="/cong-phu-huynh"
          className="mb-4 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          ← Quay lại tổng quan
        </Link>

        <header className="mb-6">
          <h1 className="text-xl font-bold text-primary">{student.fullName}</h1>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {levelLabel ? (
              <span className="rounded-full bg-primary px-2.5 py-0.5 font-semibold text-[var(--ds-text-on-primary)]">
                Cấp {levelLabel}
              </span>
            ) : null}
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-semibold text-primary">
              {getEnrollmentStatusLabel(student.enrollmentStatus)}
            </span>
          </div>
          {(classTitle || locationName) && (
            <p className="mt-2 text-sm text-[var(--ds-text-muted)]">
              {[classTitle, locationName].filter(Boolean).join(' · ')}
            </p>
          )}
        </header>

        <section className="mb-6 rounded-xl border border-primary/10 bg-[var(--ds-white)] p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-primary">
            Lộ trình 6 cấp
          </h2>
          <RoadmapProgress currentLevel={currentLevel} />
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-primary">Học phí</h2>
          <TuitionSummary
            studentId={studentId}
            tuition={progress.tuition}
            hasPendingRequest={pendingRenewals.has(studentId)}
            locale={locale}
          />
        </section>

        <section className="mb-6 rounded-xl border border-primary/10 bg-[var(--ds-white)] p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-primary">
            Điểm danh gần đây
          </h2>
          <AttendanceHistory records={progress.attendance} locale={locale} />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-primary">
            Báo cáo đánh giá định kỳ
          </h2>
          <ProgressReportsSection reports={progress.reports} locale={locale} />
        </section>
      </div>
    </div>
  )
}
