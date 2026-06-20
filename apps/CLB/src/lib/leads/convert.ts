import 'server-only'
import type { Payload } from 'payload'
import type { Lead, Parent, Student, User } from '@/payload-types'
import { isValidVietnamesePhone, normalizePhone } from '@/lib/phone'

/**
 * Chuyển đổi Lead → Phụ huynh + Học viên (đường dữ liệu khách hàng 🔒).
 *
 * Nguyên tắc:
 *  - IDEMPOTENT: chạy lại trên cùng một lead không tạo bản ghi mới — đọc
 *    `lead.convertedStudent` làm cờ "đã chuyển đổi".
 *  - CHỐNG TRÙNG THEO SĐT: tái dùng Phụ huynh có sẵn nếu SĐT (đã chuẩn hóa) trùng,
 *    thay vì tạo tài khoản phụ huynh trùng (SĐT là định danh đăng nhập, unique).
 *  - GHI có kiểm soát: dùng Local API với `overrideAccess:false` + `user:actor`
 *    ⇒ access control từng collection vẫn là hàng rào (defense-in-depth). Caller
 *    (Server Action) chịu trách nhiệm GATE ROLE (lễ tân/quản lý) trước khi gọi.
 *
 * Hàm THUẦN nghiệp vụ, KHÔNG đụng next/headers ⇒ unit-test được với Local API.
 */

export interface ConvertLeadInput {
  leadId: number
  /** Tên học viên (con). Lead không có tên con ⇒ mặc định suy ra từ tên phụ huynh. */
  studentFullName?: string
  /** Tên phụ huynh. Mặc định = lead.fullName. */
  parentFullName?: string
  /** Cơ sở của học viên (id locations). Mặc định = lead.interestedLocation. */
  locationId?: number
}

export type ConvertLeadResult =
  | {
      ok: true
      /** true nếu lead đã được chuyển đổi từ trước (không tạo gì thêm). */
      alreadyConverted: boolean
      /** true nếu tái dùng Phụ huynh có sẵn (trùng SĐT) thay vì tạo mới. */
      reusedParent: boolean
      parentId: number
      studentId: number
    }
  | {
      ok: false
      error: 'not_found' | 'invalid_phone' | 'server'
      message: string
    }

function relId(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id
    return typeof id === 'number' ? id : null
  }
  return null
}

/** Các entry activityLog hiện có → dạng phẳng (giữ `id` để không churn row). */
function flattenActivityLog(lead: Lead): NonNullable<Lead['activityLog']> {
  return (lead.activityLog ?? []).map((e) => ({
    id: e.id,
    type: e.type,
    at: e.at ?? null,
    note: e.note ?? null,
    by: relId(e.by),
  }))
}

export async function convertLeadToParentStudent(
  payload: Payload,
  actor: User,
  input: ConvertLeadInput,
): Promise<ConvertLeadResult> {
  const access = { overrideAccess: false as const, user: actor }

  // 1) Nạp lead (depth 0 ⇒ quan hệ là id).
  let lead: Lead
  try {
    lead = (await payload.findByID({
      collection: 'leads',
      id: input.leadId,
      depth: 0,
      ...access,
    })) as Lead
  } catch {
    return { ok: false, error: 'not_found', message: 'Không tìm thấy lead.' }
  }

  // 2) Idempotent: đã chuyển đổi rồi ⇒ trả bản ghi cũ, không tạo thêm.
  const existingStudentId = relId(lead.convertedStudent)
  if (existingStudentId !== null) {
    return {
      ok: true,
      alreadyConverted: true,
      reusedParent: true,
      parentId: relId(lead.convertedParent) ?? 0,
      studentId: existingStudentId,
    }
  }

  // 3) Chuẩn hóa + validate SĐT (phòng thủ; lead.create đã validate ở form).
  const phone = normalizePhone(lead.phone ?? '')
  if (!phone || !isValidVietnamesePhone(phone)) {
    return {
      ok: false,
      error: 'invalid_phone',
      message: 'Số điện thoại của lead không hợp lệ để tạo tài khoản phụ huynh.',
    }
  }

  const parentName = (input.parentFullName ?? lead.fullName ?? '').trim()
  const studentName = (input.studentFullName ?? `Con ${parentName}`).trim()
  const locationId = input.locationId ?? relId(lead.interestedLocation) ?? undefined

  try {
    // 4) Chống trùng theo SĐT: tái dùng Phụ huynh nếu đã tồn tại.
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
            ...(lead.email ? { email: lead.email } : {}),
          },
          depth: 0,
          ...access,
        })) as Parent
      } catch (err) {
        // Race / unique(phone) ⇒ phụ huynh vừa được tạo song song: nạp lại.
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

    // 5) Học viên: chống trùng theo (phụ huynh + tên) để re-convert không nhân đôi.
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

    // 6) Đồng bộ quan hệ 2 chiều: thêm học viên vào parent.children (Payload
    //    KHÔNG tự đồng bộ 2 field quan hệ rời nhau).
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

    // 7) Đóng lead: giai đoạn → "đã chốt" + dấu vết + nhật ký.
    const now = new Date().toISOString()
    await payload.update({
      collection: 'leads',
      id: lead.id,
      data: {
        status: 'da_chot',
        convertedAt: now,
        convertedParent: parent.id,
        convertedStudent: student.id,
        activityLog: [
          ...flattenActivityLog(lead),
          {
            type: 'chuyen_doi',
            at: now,
            note: `Chuyển đổi → Phụ huynh #${parent.id} + Học viên #${student.id}${reusedParent ? ' (dùng lại phụ huynh có sẵn theo SĐT)' : ''}`,
            by: actor.id,
          },
        ],
      },
      depth: 0,
      ...access,
    })

    return {
      ok: true,
      alreadyConverted: false,
      reusedParent,
      parentId: parent.id,
      studentId: student.id,
    }
  } catch (err) {
    payload.logger.error({ err, leadId: lead.id }, '[convertLead] lỗi chuyển đổi')
    return {
      ok: false,
      error: 'server',
      message: 'Không thể chuyển đổi lead. Vui lòng thử lại.',
    }
  }
}
