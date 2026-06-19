import 'server-only';
import type { Payload } from 'payload';
import type { Class, Coach, Location, Parent, Student, TuitionCycle, User } from '@/payload-types';
import { isGlobalBranchUser, resolveBranchIds } from '../../access/branch';
import { sessionsRemaining } from '../tuition';

/**
 * Đọc SĨ SỐ một lớp cho màn vận hành (điểm danh nhanh + sĩ số lớp).
 *
 * BẢO MẬT / PHÂN QUYỀN CƠ SỞ 🔒: branch-scope được áp ở bước đọc STUDENTS
 * (`students.read = withBranchScope(...)`), KHÔNG ở enrollments/classes (cả hai
 * đều read rộng hơn). Vì vậy ta:
 *   1) lấy danh sách ghi danh ĐANG HỌC của lớp (chỉ để có studentIds);
 *   2) đọc lại students theo id với `overrideAccess:false + user` ⇒ vai trò
 *      bị-khóa-cơ-sở chỉ nhận HV cùng cơ sở (HV ngoài cơ sở bị loại khỏi roster);
 *   3) gắn chu kỳ đang học (latest) + số buổi còn lại + SĐT phụ huynh.
 */

export interface ClassRosterRow {
  studentId: number;
  fullName: string;
  enrollmentStatus: Student['enrollmentStatus'] | null;
  /** Chu kỳ đang học mới nhất (nếu có) + số buổi còn lại (virtual). */
  activeCycleId: number | null;
  sessionsRemaining: number | null;
  /** SĐT phụ huynh đầu tiên (để liên hệ nhanh). */
  parentPhone: string | null;
}

function relId(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id;
    return typeof id === 'number' ? id : null;
  }
  return null;
}

function firstParentPhone(student: Student): string | null {
  const parents = student.parents;
  if (!Array.isArray(parents)) return null;
  for (const p of parents) {
    if (p && typeof p === 'object') {
      const phone = (p as Parent).phone;
      if (typeof phone === 'string' && phone.trim()) return phone.trim();
    }
  }
  return null;
}

export interface ClassOption {
  id: number;
  title: string;
  location: string | null;
  /** Tên GV phụ trách / trợ giảng (nếu đã gán). */
  coach: string | null;
  troGiang: string | null;
  /** Sĩ số tối đa (null nếu không giới hạn) — để cảnh báo khi đủ/vượt. */
  siSoToiDa: number | null;
}

function coachName(value: unknown): string | null {
  if (value && typeof value === 'object' && 'name' in value) {
    const n = (value as Coach).name;
    return typeof n === 'string' && n.trim() ? n.trim() : null;
  }
  return null;
}

/**
 * Danh sách lớp cho picker. Lớp `read=anyone` (không scope), nên tự lọc theo cơ
 * sở: vai trò global thấy tất; vai trò bị-khóa chỉ thấy lớp cùng `location` đã
 * gán; bị-khóa mà CHƯA gán cơ sở ⇒ rỗng (fail-closed, đồng bộ withBranchScope).
 */
export async function loadClassOptions(
  payload: Payload,
  user: User,
): Promise<ClassOption[]> {
  const { docs } = await payload.find({
    collection: 'classes',
    user,
    overrideAccess: false,
    disableErrors: true,
    depth: 1,
    pagination: false,
    limit: 0,
    sort: 'title',
  });
  const rows = (docs as Class[]).map((c) => {
    const loc = c.location as Location | number | null | undefined;
    const locId = loc && typeof loc === 'object' ? loc.id : typeof loc === 'number' ? loc : null;
    const locName = loc && typeof loc === 'object' ? loc.name : null;
    return {
      id: c.id,
      title: c.title,
      location: locName ?? null,
      locId,
      coach: coachName(c.coach),
      troGiang: coachName(c.troGiang),
      siSoToiDa: typeof c.siSoToiDa === 'number' ? c.siSoToiDa : null,
    };
  });

  if (!isGlobalBranchUser(user)) {
    const branchIds = resolveBranchIds(user);
    if (branchIds.length === 0) return []; // fail-closed: chưa gán cơ sở
    return rows
      .filter((r) => r.locId != null && branchIds.includes(r.locId))
      .map(({ locId: _locId, ...r }) => r);
  }
  return rows.map(({ locId: _locId, ...r }) => r);
}

export interface EnrollableStudent {
  id: number;
  fullName: string;
}

/**
 * Danh sách HV để THÊM vào lớp (picker màn Sĩ số lớp). Lọc theo cơ sở qua
 * `students.read = withBranchScope` (overrideAccess:false): vai trò bị-khóa chỉ
 * thấy HV cùng cơ sở; chưa gán cơ sở ⇒ rỗng (fail-closed). Client tự loại HV đã
 * có trong lớp + lọc theo ô tìm. 141 HV tối đa ⇒ tải một lần, lọc phía client.
 */
export async function loadEnrollableStudents(
  payload: Payload,
  user: User,
): Promise<EnrollableStudent[]> {
  const { docs } = await payload.find({
    collection: 'students',
    user,
    overrideAccess: false,
    disableErrors: true,
    depth: 0,
    pagination: false,
    limit: 0,
    sort: 'fullName',
  });
  return (docs as Student[]).map((s) => ({ id: s.id, fullName: s.fullName }));
}

export async function loadClassRoster(
  payload: Payload,
  user: User,
  classId: number,
): Promise<ClassRosterRow[]> {
  // 1) Ghi danh đang học của lớp → studentIds (enrollments read rộng cho staff).
  const { docs: enrollments } = await payload.find({
    collection: 'enrollments',
    where: { and: [{ class: { equals: classId } }, { dangHoc: { equals: true } }] },
    user,
    overrideAccess: false,
    disableErrors: true,
    depth: 0,
    pagination: false,
    limit: 0,
  });
  const studentIds = Array.from(
    new Set(
      enrollments
        .map((e) => relId((e as { student?: unknown }).student))
        .filter((id): id is number => id !== null),
    ),
  );
  if (studentIds.length === 0) return [];

  // 2) Đọc students theo id (branch-scope áp ở đây) — depth:1 populate parents.
  const { docs: studentDocs } = await payload.find({
    collection: 'students',
    where: { id: { in: studentIds } },
    user,
    overrideAccess: false,
    disableErrors: true,
    depth: 1,
    pagination: false,
    limit: 0,
    sort: 'fullName',
  });
  const students = studentDocs as Student[];
  const visibleIds = students.map((s) => s.id);
  if (visibleIds.length === 0) return [];

  // 3) Chu kỳ ĐANG HỌC (dang_hoc|sap_het) của các HV thấy được → latest mỗi HV.
  const { docs: cycleDocs } = await payload.find({
    collection: 'tuition-cycles',
    where: {
      and: [
        { student: { in: visibleIds } },
        { status: { in: ['dang_hoc', 'sap_het'] } },
      ],
    },
    user,
    overrideAccess: false,
    disableErrors: true,
    depth: 0,
    pagination: false,
    limit: 0,
  });
  const latestCycleByStudent = new Map<number, TuitionCycle>();
  for (const c of cycleDocs as TuitionCycle[]) {
    const sid = relId(c.student);
    if (sid === null) continue;
    const prev = latestCycleByStudent.get(sid);
    if (!prev || String(c.startDate ?? '') > String(prev.startDate ?? '')) {
      latestCycleByStudent.set(sid, c);
    }
  }

  return students.map((s) => {
    const cycle = latestCycleByStudent.get(s.id) ?? null;
    return {
      studentId: s.id,
      fullName: s.fullName,
      enrollmentStatus: s.enrollmentStatus ?? null,
      activeCycleId: cycle?.id ?? null,
      sessionsRemaining: cycle ? sessionsRemaining(cycle) : null,
      parentPhone: firstParentPhone(s),
    };
  });
}
