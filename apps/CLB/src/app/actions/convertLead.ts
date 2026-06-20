'use server'

import { headers } from 'next/headers'
import type { User } from '@/payload-types'
import { getPayloadClient } from '@/lib/payload'
import {
  convertLeadToParentStudent,
  type ConvertLeadInput,
  type ConvertLeadResult,
} from '@/lib/leads/convert'

/**
 * Vai trò được phép chuyển đổi lead. CHẶT HƠN access của collection
 * `parents`/`students` (chỉ cần staff bất kỳ): chuyển đổi là thao tác chăm sóc
 * khách hàng ⇒ chỉ lễ tân/quản lý/admin. Khớp `canManageLeads` trong Leads.ts.
 */
const CONVERT_ALLOWED_ROLES: ReadonlyArray<User['role'][number]> = [
  'admin',
  'manager',
  'receptionist',
]

export type ConvertLeadActionResult =
  | ConvertLeadResult
  | { ok: false; error: 'forbidden'; message: string }

/**
 * Server Action: chuyển đổi lead thành Phụ huynh + Học viên.
 *
 * Resolve nhân viên đang đăng nhập từ cookie (Payload auth), gate role, rồi gọi
 * core thuần `convertLeadToParentStudent`. KHÔNG nhận role/userId từ client —
 * danh tính lấy từ phiên đăng nhập server-side.
 */
export async function convertLead(input: ConvertLeadInput): Promise<ConvertLeadActionResult> {
  const payload = await getPayloadClient()
  const headersList = await headers()
  const { user } = await payload.auth({
    headers: headersList as unknown as Headers,
  })

  // Chỉ nhân viên (collection `users`) — phụ huynh KHÔNG được dùng.
  if (!user || user.collection !== 'users') {
    return {
      ok: false,
      error: 'forbidden',
      message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.',
    }
  }

  const staff = user as User
  if (!staff.role.some((r) => CONVERT_ALLOWED_ROLES.includes(r))) {
    return {
      ok: false,
      error: 'forbidden',
      message: 'Chỉ lễ tân, quản lý hoặc admin mới được chuyển đổi lead.',
    }
  }

  return convertLeadToParentStudent(payload, staff, input)
}
