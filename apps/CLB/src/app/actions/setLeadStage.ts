'use server'

import { headers as nextHeaders } from 'next/headers'
import type { Lead, User } from '@/payload-types'
import { getPayloadClient } from '@/lib/payload'

/**
 * Server Action: đổi giai đoạn (status) của một lead trong pipeline kanban +
 * ghi entry `activityLog` loại `doi_giai_doan`.
 *
 * Danh tính lấy từ phiên đăng nhập server-side (KHÔNG nhận role/userId từ
 * client). Gate role admin/manager/receptionist (khớp `canManageLeads` ở
 * Leads.ts); mọi ghi `overrideAccess:false` + `user` ⇒ access collection là
 * hàng rào DB-level. KHÔNG nới quyền.
 */

// KHÔNG export giá trị này: file 'use server' chỉ được export hàm async (quy tắc
// Next.js). Giá trị chỉ dùng nội bộ file; type LeadStage vẫn export được (type bị
// erase nên không vi phạm). Nếu cần dùng ở nơi khác → tách sang module thường.
const LEAD_STAGE_VALUES = [
  'moi',
  'da_lien_he',
  'dang_ky_hoc_thu',
  'da_chot',
  'khong_phu_hop',
] as const
export type LeadStage = (typeof LEAD_STAGE_VALUES)[number]

const STAGE_LABELS: Record<LeadStage, string> = {
  moi: 'Mới',
  da_lien_he: 'Đã liên hệ',
  dang_ky_hoc_thu: 'Đăng ký học thử',
  da_chot: 'Đã chốt',
  khong_phu_hop: 'Không phù hợp',
}

const LEAD_MANAGER_ROLES: ReadonlyArray<User['role'][number]> = ['admin', 'manager', 'receptionist']

export type SetLeadStageResult =
  | { ok: true; status: LeadStage }
  | { ok: false; error: 'forbidden' | 'invalid' | 'not_found' | 'server'; message: string }

function relId(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id: unknown }).id
    return typeof id === 'number' ? id : null
  }
  return null
}

export async function setLeadStage(input: {
  leadId: number
  status: LeadStage
}): Promise<SetLeadStageResult> {
  if (!LEAD_STAGE_VALUES.includes(input.status)) {
    return { ok: false, error: 'invalid', message: 'Giai đoạn không hợp lệ.' }
  }

  const payload = await getPayloadClient()
  const headersList = await nextHeaders()
  const { user } = await payload.auth({ headers: headersList as unknown as Headers })

  if (!user || user.collection !== 'users') {
    return { ok: false, error: 'forbidden', message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.' }
  }
  const actor = user as User
  if (!actor.role.some((r) => LEAD_MANAGER_ROLES.includes(r))) {
    return {
      ok: false,
      error: 'forbidden',
      message: 'Chỉ lễ tân, quản lý hoặc admin mới được cập nhật lead.',
    }
  }

  const access = { overrideAccess: false, user: actor } as const
  try {
    const lead = (await payload.findByID({
      collection: 'leads',
      id: input.leadId,
      depth: 0,
      ...access,
    })) as Lead | null
    if (!lead) return { ok: false, error: 'not_found', message: 'Không tìm thấy lead.' }
    if (lead.status === input.status) return { ok: true, status: input.status }

    const now = new Date().toISOString()
    const prevLabel = STAGE_LABELS[(lead.status as LeadStage) ?? 'moi'] ?? lead.status
    const flattened = (lead.activityLog ?? []).map((e) => ({
      id: e.id,
      type: e.type,
      at: e.at ?? null,
      note: e.note ?? null,
      by: relId(e.by),
    }))

    await payload.update({
      collection: 'leads',
      id: input.leadId,
      data: {
        status: input.status,
        activityLog: [
          ...flattened,
          {
            type: 'doi_giai_doan',
            at: now,
            note: `Chuyển "${prevLabel}" → "${STAGE_LABELS[input.status]}"`,
            by: actor.id,
          },
        ],
      },
      depth: 0,
      ...access,
    })

    return { ok: true, status: input.status }
  } catch (err) {
    payload.logger.error({ err }, 'setLeadStage failed')
    return { ok: false, error: 'server', message: 'Cập nhật giai đoạn thất bại.' }
  }
}
