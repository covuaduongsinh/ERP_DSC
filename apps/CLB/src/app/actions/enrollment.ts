'use server'

import { headers as nextHeaders } from 'next/headers'
import type { User } from '@/payload-types'
import { getPayloadClient } from '@/lib/payload'
import {
  addStudentToClass,
  removeStudentFromClass,
  transferStudentClass,
  bulkRemoveStudentsFromClass,
  bulkTransferStudentsClass,
  type AddStudentResult,
  type RemoveStudentResult,
  type TransferResult,
  type BulkResult,
} from '@/lib/operations/enrollment'

/** Resolve nhân viên đăng nhập từ cookie; null nếu không phải staff. */
async function getStaffActor(): Promise<User | null> {
  const payload = await getPayloadClient()
  const headersList = await nextHeaders()
  const { user } = await payload.auth({
    headers: headersList as unknown as Headers,
  })
  return user?.collection === 'users' ? (user as User) : null
}

/**
 * Server Action: THÊM học viên vào lớp (branch-safe, idempotent). Danh tính lấy
 * từ phiên server; HV/lớp ngoài cơ sở của nhân viên bị từ chối.
 */
export async function addStudentToClassAction(
  classId: number,
  studentId: number,
): Promise<AddStudentResult> {
  const actor = await getStaffActor()
  if (!actor) {
    return { ok: false, error: 'forbidden', message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.' }
  }
  const payload = await getPayloadClient()
  return addStudentToClass(payload, actor, classId, studentId)
}

/**
 * Server Action: RÚT học viên khỏi lớp (đặt dangHoc=false, giữ lịch sử).
 */
export async function removeStudentFromClassAction(
  classId: number,
  studentId: number,
): Promise<RemoveStudentResult> {
  const actor = await getStaffActor()
  if (!actor) {
    return { ok: false, error: 'forbidden', message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.' }
  }
  const payload = await getPayloadClient()
  return removeStudentFromClass(payload, actor, classId, studentId)
}

/**
 * Server Action: CHUYỂN học viên từ lớp nguồn sang lớp đích (branch-safe).
 */
export async function transferStudentClassAction(
  fromClassId: number,
  studentId: number,
  toClassId: number,
): Promise<TransferResult> {
  const actor = await getStaffActor()
  if (!actor) {
    return { ok: false, error: 'forbidden', message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.' }
  }
  const payload = await getPayloadClient()
  return transferStudentClass(payload, actor, fromClassId, studentId, toClassId)
}

/**
 * Server Action: RÚT hàng loạt HV khỏi lớp (branch-safe từng HV, gom lỗi).
 */
export async function bulkRemoveStudentsFromClassAction(
  classId: number,
  studentIds: number[],
): Promise<BulkResult> {
  const actor = await getStaffActor()
  if (!actor) {
    return { ok: false, error: 'forbidden', message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.' }
  }
  const payload = await getPayloadClient()
  return bulkRemoveStudentsFromClass(payload, actor, classId, studentIds)
}

/**
 * Server Action: CHUYỂN hàng loạt HV từ lớp nguồn sang lớp đích (branch-safe).
 */
export async function bulkTransferStudentsClassAction(
  fromClassId: number,
  studentIds: number[],
  toClassId: number,
): Promise<BulkResult> {
  const actor = await getStaffActor()
  if (!actor) {
    return { ok: false, error: 'forbidden', message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.' }
  }
  const payload = await getPayloadClient()
  return bulkTransferStudentsClass(payload, actor, fromClassId, studentIds, toClassId)
}
