import 'server-only'
import type { Payload } from 'payload'
import type { Class, Location, Student, User } from '@/payload-types'
import { isGlobalBranchUser, resolveBranchIds } from '../../access/branch'

/**
 * THÊM / RÚT học viên khỏi một lớp (Enrollments) cho màn "Sĩ số lớp" — lớp lõi
 * THUẦN nghiệp vụ + I/O qua Local API (tách khỏi next/headers để unit-test được).
 *
 * BẢO MẬT / PHÂN QUYỀN CƠ SỞ 🔒: `Enrollments.create` KHÔNG branch-scope (chủ ý —
 * giống Students/Classes). Vì vậy TRƯỚC khi tạo ghi danh, ta tự kiểm tra CẢ HAI:
 *   - lớp thuộc phạm vi cơ sở của nhân viên (Classes.read=anyone ⇒ tự lọc theo
 *     `location` như loadClassOptions);
 *   - học viên đọc được qua access đã scope (`students.read = withBranchScope`).
 * Nhân viên bị-khóa-cơ-sở KHÔNG thể xếp HV/lớp ngoài cơ sở của mình. read/update
 * của Enrollments đã branch-scope (Phase 4) nên RÚT cũng an toàn DB-level.
 * Ghi luôn `overrideAccess:false + user` ⇒ collection access là hàng rào thứ hai.
 */

export type AddStudentResult =
  | { ok: true; action: 'created' | 'reactivated' | 'already'; enrollmentId: number }
  | { ok: false; error: 'forbidden' | 'invalid_input' | 'server'; message: string }

export type RemoveStudentResult =
  | { ok: true; enrollmentId: number }
  | { ok: false; error: 'forbidden' | 'invalid_input' | 'not_found' | 'server'; message: string }

export type TransferResult =
  | { ok: true }
  | { ok: false; error: 'forbidden' | 'invalid_input' | 'not_found' | 'server'; message: string }

function isStaff(actor: User | null): boolean {
  return !!actor && (actor as { collection?: string }).collection === 'users'
}

function relId(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id
    return typeof id === 'number' ? id : null
  }
  return null
}

function validIds(classId: number, studentId: number): boolean {
  return Number.isInteger(classId) && classId > 0 && Number.isInteger(studentId) && studentId > 0
}

/** 🔒 Lớp có thuộc phạm vi cơ sở của actor không (Classes.read không scope). */
async function classInBranch(payload: Payload, actor: User, classId: number): Promise<boolean> {
  const { docs } = await payload.find({
    collection: 'classes',
    where: { id: { equals: classId } },
    user: actor,
    overrideAccess: false,
    disableErrors: true,
    depth: 1,
    limit: 1,
  })
  if (docs.length === 0) return false
  if (isGlobalBranchUser(actor)) return true
  const branchIds = resolveBranchIds(actor)
  if (branchIds.length === 0) return false
  const loc = (docs[0] as Class).location as Location | number | null | undefined
  const locId = relId(loc)
  return locId != null && branchIds.includes(locId)
}

/** 🔒 HV có đọc được qua access đã scope không (cùng cơ sở actor). */
async function studentVisible(payload: Payload, actor: User, studentId: number): Promise<boolean> {
  const { docs } = await payload.find({
    collection: 'students',
    where: { id: { equals: studentId } },
    user: actor,
    overrideAccess: false,
    disableErrors: true,
    depth: 0,
    limit: 1,
  })
  return (docs as Student[]).length > 0
}

/**
 * Thêm HV vào lớp — idempotent. Nếu đã có ghi danh (student+class): bật lại
 * `dangHoc` nếu đang tắt, hoặc no-op nếu đang học. Chưa có ⇒ tạo mới `dangHoc:true`.
 */
export async function addStudentToClass(
  payload: Payload,
  actor: User | null,
  classId: number,
  studentId: number,
): Promise<AddStudentResult> {
  if (!isStaff(actor)) {
    return { ok: false, error: 'forbidden', message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.' }
  }
  if (!validIds(classId, studentId)) {
    return { ok: false, error: 'invalid_input', message: 'Lớp hoặc học viên không hợp lệ.' }
  }
  const staff = actor as User
  if (!(await classInBranch(payload, staff, classId))) {
    return { ok: false, error: 'forbidden', message: 'Lớp ngoài phạm vi cơ sở của bạn.' }
  }
  if (!(await studentVisible(payload, staff, studentId))) {
    return { ok: false, error: 'forbidden', message: 'Học viên ngoài phạm vi cơ sở của bạn.' }
  }

  const { docs: existing } = await payload.find({
    collection: 'enrollments',
    where: { and: [{ student: { equals: studentId } }, { class: { equals: classId } }] },
    user: staff,
    overrideAccess: false,
    disableErrors: true,
    depth: 0,
    limit: 1,
  })

  if (existing.length > 0) {
    const e = existing[0] as { id: number; dangHoc?: boolean | null }
    if (e.dangHoc) return { ok: true, action: 'already', enrollmentId: e.id }
    await payload.update({
      collection: 'enrollments',
      id: e.id,
      data: { dangHoc: true },
      user: staff,
      overrideAccess: false,
    })
    return { ok: true, action: 'reactivated', enrollmentId: e.id }
  }

  const created = await payload.create({
    collection: 'enrollments',
    data: {
      student: studentId,
      class: classId,
      dangHoc: true,
      ngayBatDau: new Date().toISOString(),
    },
    user: staff,
    overrideAccess: false,
  })
  return { ok: true, action: 'created', enrollmentId: (created as { id: number }).id }
}

/**
 * Rút HV khỏi lớp — đặt `dangHoc:false` + `ngayKetThuc` hôm nay (GIỮ lịch sử ghi
 * danh, KHÔNG xóa). Bản ghi đọc/sửa đã branch-scope ⇒ nhân viên bị-khóa chỉ rút
 * được HV cùng cơ sở.
 */
export async function removeStudentFromClass(
  payload: Payload,
  actor: User | null,
  classId: number,
  studentId: number,
): Promise<RemoveStudentResult> {
  if (!isStaff(actor)) {
    return { ok: false, error: 'forbidden', message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.' }
  }
  if (!validIds(classId, studentId)) {
    return { ok: false, error: 'invalid_input', message: 'Lớp hoặc học viên không hợp lệ.' }
  }
  const staff = actor as User

  const { docs } = await payload.find({
    collection: 'enrollments',
    where: {
      and: [
        { student: { equals: studentId } },
        { class: { equals: classId } },
        { dangHoc: { equals: true } },
      ],
    },
    user: staff,
    overrideAccess: false,
    disableErrors: true,
    depth: 0,
    limit: 1,
  })
  if (docs.length === 0) {
    return {
      ok: false,
      error: 'not_found',
      message: 'Không tìm thấy ghi danh đang học (hoặc ngoài phạm vi cơ sở của bạn).',
    }
  }
  const e = docs[0] as { id: number }
  await payload.update({
    collection: 'enrollments',
    id: e.id,
    data: { dangHoc: false, ngayKetThuc: new Date().toISOString() },
    user: staff,
    overrideAccess: false,
  })
  return { ok: true, enrollmentId: e.id }
}

/**
 * CHUYỂN LỚP — thêm HV vào lớp ĐÍCH rồi rút khỏi lớp NGUỒN. Thêm trước để nếu lỗi
 * (vd ngoài cơ sở) thì HV vẫn ở lớp cũ. Rút lớp cũ là best-effort (không có ghi
 * danh cũ vẫn coi như chuyển xong). Branch-safe nhờ tái dùng add/remove.
 */
export async function transferStudentClass(
  payload: Payload,
  actor: User | null,
  fromClassId: number,
  studentId: number,
  toClassId: number,
): Promise<TransferResult> {
  if (!isStaff(actor)) {
    return { ok: false, error: 'forbidden', message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.' }
  }
  if (!validIds(toClassId, studentId) || !Number.isInteger(fromClassId) || fromClassId <= 0) {
    return { ok: false, error: 'invalid_input', message: 'Lớp hoặc học viên không hợp lệ.' }
  }
  if (fromClassId === toClassId) {
    return { ok: false, error: 'invalid_input', message: 'Lớp nguồn và lớp đích trùng nhau.' }
  }

  const add = await addStudentToClass(payload, actor, toClassId, studentId)
  if (!add.ok) return { ok: false, error: add.error, message: add.message }

  const rem = await removeStudentFromClass(payload, actor, fromClassId, studentId)
  if (!rem.ok && rem.error !== 'not_found') {
    return { ok: false, error: rem.error, message: rem.message }
  }
  return { ok: true }
}

/**
 * Kết quả thao tác HÀNG LOẠT: gom HV thành công + danh sách HV lỗi (kèm lý do).
 * KHÔNG dừng giữa chừng — lỗi 1 HV không chặn các HV còn lại.
 */
export type BulkResult =
  | { ok: true; succeeded: number; failed: { studentId: number; message: string }[] }
  | { ok: false; error: 'forbidden' | 'invalid_input'; message: string }

/** Lọc studentIds hợp lệ, loại trùng. */
function sanitizeStudentIds(studentIds: unknown): number[] {
  if (!Array.isArray(studentIds)) return []
  const set = new Set<number>()
  for (const v of studentIds) {
    if (Number.isInteger(v) && (v as number) > 0) set.add(v as number)
  }
  return Array.from(set)
}

/**
 * RÚT hàng loạt HV khỏi một lớp — lặp `removeStudentFromClass` (mỗi lần tự kiểm
 * cơ sở + audit). Tuần tự (N nhỏ ≤ vài chục HV/lớp). HV ngoài cơ sở/không có ghi
 * danh đang học → gom vào `failed[]`, không chặn HV khác.
 */
export async function bulkRemoveStudentsFromClass(
  payload: Payload,
  actor: User | null,
  classId: number,
  studentIds: number[],
): Promise<BulkResult> {
  if (!isStaff(actor)) {
    return { ok: false, error: 'forbidden', message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.' }
  }
  const ids = sanitizeStudentIds(studentIds)
  if (!(Number.isInteger(classId) && classId > 0) || ids.length === 0) {
    return {
      ok: false,
      error: 'invalid_input',
      message: 'Lớp hoặc danh sách học viên không hợp lệ.',
    }
  }
  let succeeded = 0
  const failed: { studentId: number; message: string }[] = []
  for (const studentId of ids) {
    const res = await removeStudentFromClass(payload, actor, classId, studentId)
    if (res.ok) succeeded += 1
    else failed.push({ studentId, message: res.message })
  }
  return { ok: true, succeeded, failed }
}

/**
 * CHUYỂN hàng loạt HV từ lớp nguồn sang lớp đích — lặp `transferStudentClass`.
 * Mỗi HV add(đích) trước rồi remove(nguồn) (idempotent, branch-safe).
 */
export async function bulkTransferStudentsClass(
  payload: Payload,
  actor: User | null,
  fromClassId: number,
  studentIds: number[],
  toClassId: number,
): Promise<BulkResult> {
  if (!isStaff(actor)) {
    return { ok: false, error: 'forbidden', message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.' }
  }
  const ids = sanitizeStudentIds(studentIds)
  if (
    !(Number.isInteger(fromClassId) && fromClassId > 0) ||
    !(Number.isInteger(toClassId) && toClassId > 0) ||
    ids.length === 0
  ) {
    return {
      ok: false,
      error: 'invalid_input',
      message: 'Lớp hoặc danh sách học viên không hợp lệ.',
    }
  }
  if (fromClassId === toClassId) {
    return { ok: false, error: 'invalid_input', message: 'Lớp nguồn và lớp đích trùng nhau.' }
  }
  let succeeded = 0
  const failed: { studentId: number; message: string }[] = []
  for (const studentId of ids) {
    const res = await transferStudentClass(payload, actor, fromClassId, studentId, toClassId)
    if (res.ok) succeeded += 1
    else failed.push({ studentId, message: res.message })
  }
  return { ok: true, succeeded, failed }
}
