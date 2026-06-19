import { getTuitionWarningMessage, isTuitionLow } from '@/lib/parent-portal';
import type { Student, TuitionCycle } from '@/payload-types';

type TuitionRenewalAlertProps = {
  student: Student;
  tuition: TuitionCycle;
};

export function TuitionRenewalAlert({
  student,
  tuition,
}: TuitionRenewalAlertProps) {
  if (!isTuitionLow(tuition)) return null;

  return (
    <div
      className="mb-4 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3"
      role="status"
    >
      <p className="text-sm font-bold text-primary">
        {student.fullName}: {getTuitionWarningMessage(tuition)}
      </p>
      <p className="mt-1 text-xs text-[var(--ds-text-muted)]">
        Nhấn &quot;Đăng ký gia hạn&quot; để nhân viên liên hệ chốt gói mới.
      </p>
    </div>
  );
}
