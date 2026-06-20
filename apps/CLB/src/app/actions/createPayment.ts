'use server'

import { headers as nextHeaders } from 'next/headers'
import type { User } from '@/payload-types'
import { getPayloadClient } from '@/lib/payload'
import {
  createPaymentRecord,
  type CreatePaymentInput,
  type CreatePaymentResult,
} from '@/lib/payments/create'

export type CreatePaymentActionResult = CreatePaymentResult

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
 * Server Action: tạo phiếu THU học phí từ form `/admin/nhap-hoc-phi`.
 *
 * Danh tính lấy từ phiên server-side (KHÔNG nhận role/userId từ client). Lõi
 * `createPaymentRecord` ghi với `overrideAccess: false` ⇒ collection access
 * (staffOnly) gate; hook audit của Payments tự ghi nhật ký.
 */
export async function createPayment(input: CreatePaymentInput): Promise<CreatePaymentActionResult> {
  const actor = await getStaffActor()
  if (!actor) {
    return {
      ok: false,
      error: 'forbidden',
      message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.',
    }
  }
  const payload = await getPayloadClient()
  return createPaymentRecord(payload, actor, input)
}
