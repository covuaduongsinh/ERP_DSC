import type { Attendance, Student, TuitionCycle } from '@/payload-types';

const enrollmentLabels: Record<Student['enrollmentStatus'], string> = {
  dang_hoc: 'Đang học',
  tam_nghi: 'Tạm nghỉ',
  da_nghi: 'Đã nghỉ',
};

export function getEnrollmentStatusLabel(
  status: Student['enrollmentStatus'],
): string {
  return enrollmentLabels[status];
}

const attendanceLabels: Record<Attendance['status'], string> = {
  co_mat: 'Có mặt',
  vang: 'Vắng',
  phep: 'Phép',
};

export function getAttendanceStatusLabel(status: Attendance['status']): string {
  return attendanceLabels[status];
}

const tuitionStatusLabels: Record<TuitionCycle['status'], string> = {
  dang_hoc: 'Đang học',
  sap_het: 'Sắp hết buổi',
  da_het: 'Đã hết buổi',
};

export function getTuitionStatusLabel(status: TuitionCycle['status']): string {
  return tuitionStatusLabels[status];
}
