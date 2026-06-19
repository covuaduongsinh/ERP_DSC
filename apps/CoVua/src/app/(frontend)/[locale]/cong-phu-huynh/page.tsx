import { setRequestLocale } from 'next-intl/server';
import { ParentPortalHeader } from '@/components/parent-portal/ParentPortalHeader';
import { StudentOverviewCard } from '@/components/parent-portal/StudentOverviewCard';
import { TuitionRenewalAlert } from '@/components/parent-portal/TuitionRenewalAlert';
import {
  fetchActiveEnrollments,
  fetchActiveTuitionCycles,
  fetchParentStudents,
  isTuitionLow,
  mapClassTitleByStudent,
  mapTuitionByStudent,
  requireAuthenticatedParent,
} from '@/lib/parent-portal';

type Props = {
  params: Promise<{ locale: string }>;
};

export const dynamic = 'force-dynamic';

export default async function ParentPortalHome({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { parent, parentUser } = await requireAuthenticatedParent();

  const [students, tuitionCycles, enrollments] = await Promise.all([
    fetchParentStudents(parentUser),
    fetchActiveTuitionCycles(parentUser),
    fetchActiveEnrollments(parentUser),
  ]);
  const tuitionByStudent = mapTuitionByStudent(tuitionCycles);
  const classTitleByStudent = mapClassTitleByStudent(enrollments);
  const lowTuitionAlerts = students.flatMap((student) => {
    const tuition = tuitionByStudent.get(student.id);
    if (!tuition || !isTuitionLow(tuition)) return [];
    return [{ student, tuition }];
  });

  return (
    <div className="min-h-[60vh] bg-[var(--ds-bg)]">
      <ParentPortalHeader parentName={parent.fullName} />

      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-primary">Con của bạn</h1>
          <p className="mt-1 text-sm text-[var(--ds-text-muted)]">
            {students.length <= 1
              ? 'Theo dõi tiến độ học và học phí của con.'
              : 'Chọn con để xem tiến độ chi tiết.'}
          </p>
        </div>

        {lowTuitionAlerts.map(({ student, tuition }) => (
          <TuitionRenewalAlert
            key={student.id}
            student={student}
            tuition={tuition}
          />
        ))}

        {students.length === 0 ? (
          <div className="rounded-xl border border-primary/10 bg-[var(--ds-white)] p-5 text-center shadow-sm">
            <p className="text-sm text-[var(--ds-text-muted)]">
              Trung tâm chưa gắn học viên cho tài khoản này. Vui lòng liên hệ
              nhân viên để cập nhật.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {students.map((student) => (
              <li key={student.id}>
                <StudentOverviewCard
                  student={student}
                  tuition={tuitionByStudent.get(student.id) ?? null}
                  classTitle={classTitleByStudent.get(student.id) ?? null}
                  locale={locale}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
