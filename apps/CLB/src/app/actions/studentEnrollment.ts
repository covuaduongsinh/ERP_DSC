'use server'

import { headers as nextHeaders } from 'next/headers'
import type { User } from '@/payload-types'
import { getPayloadClient } from '@/lib/payload'
import {
  loadStudentClassIds,
  saveStudentClasses,
  type SaveStudentClassesResult,
} from '@/lib/operations/student-enrollment'

/** Resolve nhân viên đăng nhập từ cookie; null nếu không phải staff. */
async function getStaffActor(): Promise<User | null> {
  const payload = await getPayloadClient()
  const headersList = await nextHeaders()
  const { user } = await payload.auth({ headers: headersList as unknown as Headers })
  return user?.collection === 'users' ? (user as User) : null
}

export type FetchStudentEnrollmentResult =
  | { ok: true; enrolledClassIds: number[] }
  | { ok: false; message: string }

/** Lấy các lớp HV đang học (để tích sẵn trong màn Ghi danh theo học viên). */
export async function fetchStudentEnrollment(
  studentId: number,
): Promise<FetchStudentEnrollmentResult> {
  const actor = await getStaffActor()
  if (!actor) return { ok: false, message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.' }
  if (!Number.isInteger(studentId) || studentId <= 0) {
    return { ok: false, message: 'Học viên không hợp lệ.' }
  }
  const payload = await getPayloadClient()
  const enrolledClassIds = await loadStudentClassIds(payload, actor, studentId)
  return { ok: true, enrolledClassIds }
}

/** Đặt tập lớp đang học của HV = classIds (thêm/rút theo diff). */
export async function saveStudentEnrollment(
  studentId: number,
  classIds: number[],
): Promise<SaveStudentClassesResult> {
  const actor = await getStaffActor()
  if (!actor)
    return { ok: false, error: 'forbidden', message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.' }
  const payload = await getPayloadClient()
  return saveStudentClasses(payload, actor, studentId, classIds)
}
