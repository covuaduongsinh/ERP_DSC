import 'server-only'
import type { Payload } from 'payload'
import type { Parent, Student } from '@/payload-types'
import { isValidVietnamesePhone, normalizePhone } from '@/lib/phone'

/**
 * Tạo Phụ huynh + Học viên (+ Ghi danh) từ dữ liệu do CRM gửi sang khi một Deal
 * "Tuyển sinh" được CHỐT — đường handoff CRM → CLB.
 *
 * Khác `convertLeadToParentStudent` (đầu vào là `leadId` của CLB): ở kiến trúc
 * mới Lead nằm ở CRM, nên hàm này nhận thẳng dữ liệu phụ huynh/học viên. Tái dùng
 * đúng các quy tắc đã kiểm chứng trong convert.ts:
 *  - CHỐNG TRÙNG theo SĐT (đã chuẩn hóa) — SĐT là định danh đăng nhập phụ huynh.
 *  - CHỐNG TRÙNG học viên theo (phụ huynh + tên).
 *  - Đồng bộ 2 chiều parent.children.
 *
 * Gọi từ endpoint nội bộ đã xác thực service-token ⇒ dùng `overrideAccess: true`
 * (tin cậy server-to-server). Hàm THUẦN nghiệp vụ, unit-test được với Local API.
 */
export interface AdmissionUpsertInput {
  parentFullName: string
  phone: string
  email?: string | null
  zaloId?: string | null
  studentFullName?: string
  /** id locations (CLB). */
  locationId?: number | null
  /** id classes (CLB) — có thì tạo Enrollment. */
  classId?: number | null
  /** Ngày bắt đầu học (ISO). */
  startDate?: string | null
  /** Dấu vết nguồn: id Deal bên CRM. */
  crmDealId?: string | null
}

export type AdmissionUpsertResult =
  | {
      ok: true
      reusedParent: boolean
      parentId: number
      studentId: number
      enrollmentId: number | null
    }
  | { ok: false; error: 'invalid_phone' | 'server'; message: string }

function relId(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id
    return typeof id === 'number' ? id : null
  }
  return null
}

export async function upsertParentStudentEnrollment(
  payload: Payload,
  input: AdmissionUpsertInput,
): Promise<AdmissionUpsertResult> {
  const access = { overrideAccess: true as const }

  const phone = normalizePhone(input.phone ?? '')
  if (!phone || !isValidVietnamesePhone(phone)) {
    return {
      ok: false,
      error: 'invalid_phone',
      message: 'Số điện thoại không hợp lệ để tạo tài khoản phụ huynh.',
    }
  }

  const parentName = (input.parentFullName ?? '').trim()
  const studentName = (input.studentFullName ?? `Con ${parentName}`).trim()
  const locationId = input.locationId ?? undefined

  try {
    // 1) Chống trùng phụ huynh theo SĐT.
    const existingParents = await payload.find({
      collection: 'parents',
      where: { phone: { equals: phone } },
      limit: 1,
      depth: 0,
      ...access,
    })

    let parent: Parent
    let reusedParent = false
    if (existingParents.docs.length > 0) {
      parent = existingParents.docs[0] as Parent
      reusedParent = true
    } else {
      try {
        parent = (await payload.create({
          collection: 'parents',
          data: {
            fullName: parentName || phone,
            phone,
            ...(input.email ? { email: input.email } : {}),
            ...(input.zaloId ? { zaloId: input.zaloId } : {}),
          },
          depth: 0,
          ...access,
        })) as Parent
      } catch (err) {
        // Race / unique(phone): nạp lại.
        const retry = await payload.find({
          collection: 'parents',
          where: { phone: { equals: phone } },
          limit: 1,
          depth: 0,
          ...access,
        })
        if (retry.docs.length === 0) throw err
        parent = retry.docs[0] as Parent
        reusedParent = true
      }
    }

    // 2) Chống trùng học viên theo (phụ huynh + tên).
    const existingStudents = await payload.find({
      collection: 'students',
      where: {
        and: [{ parents: { in: [parent.id] } }, { fullName: { equals: studentName } }],
      },
      limit: 1,
      depth: 0,
      ...access,
    })

    let student: Student
    if (existingStudents.docs.length > 0) {
      student = existingStudents.docs[0] as Student
    } else {
      student = (await payload.create({
        collection: 'students',
        data: {
          fullName: studentName,
          parents: [parent.id],
          enrollmentStatus: 'dang_hoc',
          ...(locationId ? { location: locationId } : {}),
        },
        depth: 0,
        ...access,
      })) as Student
    }

    // 3) Đồng bộ 2 chiều parent.children.
    const childIds = (parent.children ?? []).map(relId).filter((id): id is number => id !== null)
    if (!childIds.includes(student.id)) {
      await payload.update({
        collection: 'parents',
        id: parent.id,
        data: { children: [...childIds, student.id] },
        depth: 0,
        ...access,
      })
    }

    // 4) Ghi danh vào lớp (nếu có classId) — chống trùng theo (student + class) đang học.
    let enrollmentId: number | null = null
    if (input.classId) {
      const existingEnroll = await payload.find({
        collection: 'enrollments',
        where: {
          and: [{ student: { equals: student.id } }, { class: { equals: input.classId } }],
        },
        limit: 1,
        depth: 0,
        ...access,
      })
      if (existingEnroll.docs.length > 0) {
        enrollmentId = relId(existingEnroll.docs[0])
      } else {
        const enrollment = await payload.create({
          collection: 'enrollments',
          data: {
            student: student.id,
            class: input.classId,
            dangHoc: true,
            ...(input.startDate ? { ngayBatDau: input.startDate } : {}),
          },
          depth: 0,
          ...access,
        })
        enrollmentId = relId(enrollment)
      }
    }

    return {
      ok: true,
      reusedParent,
      parentId: parent.id,
      studentId: student.id,
      enrollmentId,
    }
  } catch (err) {
    payload.logger.error({ err, crmDealId: input.crmDealId }, '[admission] lỗi handoff CRM→CLB')
    return {
      ok: false,
      error: 'server',
      message: 'Không thể tạo phụ huynh/học viên. Vui lòng thử lại.',
    }
  }
}
