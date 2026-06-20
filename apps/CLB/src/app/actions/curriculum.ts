'use server'

import { headers as nextHeaders } from 'next/headers'
import type { User } from '@/payload-types'
import { getPayloadClient } from '@/lib/payload'
import {
  listTemplates,
  loadTemplate,
  saveTemplate,
  deleteTemplate,
  previewApplyTemplate,
  applyCurriculumTemplate,
  type TemplateListResult,
  type TemplateDetailResult,
  type SaveTemplateResult,
  type SimpleTemplateResult,
  type SaveTemplateInput,
  type ApplyInput,
  type ApplyPreviewResult,
  type ApplyCommitResult,
} from '@/lib/operations/curriculum-templates'

/**
 * Server Actions cho KHUNG LỘ TRÌNH (V2). Resolve nhân viên từ cookie rồi ủy quyền
 * core (`curriculum-templates.ts`) — gate (đọc=staff, ghi=admin/manager, áp=
 * admin/manager) và branch-scope (khi áp) nằm trong core.
 */

async function getStaffActor(): Promise<User | null> {
  const payload = await getPayloadClient()
  const headersList = await nextHeaders()
  const { user } = await payload.auth({ headers: headersList as unknown as Headers })
  return user?.collection === 'users' ? (user as User) : null
}

const FORBIDDEN = {
  ok: false as const,
  error: 'forbidden' as const,
  message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.',
}

/** Liệt kê khung (tóm tắt). `onlyActive` cho dropdown áp. */
export async function listTemplatesAction(opts?: {
  onlyActive?: boolean
}): Promise<TemplateListResult> {
  const actor = await getStaffActor()
  if (!actor) return FORBIDDEN
  const payload = await getPayloadClient()
  return listTemplates(payload, actor, opts)
}

/** Đọc chi tiết 1 khung (gồm bài theo thứ tự). */
export async function loadTemplateAction(id: number): Promise<TemplateDetailResult> {
  const actor = await getStaffActor()
  if (!actor) return FORBIDDEN
  const payload = await getPayloadClient()
  return loadTemplate(payload, actor, id)
}

/** Tạo/cập nhật khung (chỉ admin/manager). */
export async function saveTemplateAction(input: SaveTemplateInput): Promise<SaveTemplateResult> {
  const actor = await getStaffActor()
  if (!actor) return FORBIDDEN
  const payload = await getPayloadClient()
  return saveTemplate(payload, actor, input)
}

/** Xóa khung (chỉ admin/manager). */
export async function deleteTemplateAction(id: number): Promise<SimpleTemplateResult> {
  const actor = await getStaffActor()
  if (!actor) return FORBIDDEN
  const payload = await getPayloadClient()
  return deleteTemplate(payload, actor, id)
}

/** Xem trước áp khung (dry-run, chỉ admin/manager). */
export async function previewApplyTemplateAction(input: ApplyInput): Promise<ApplyPreviewResult> {
  const actor = await getStaffActor()
  if (!actor) return FORBIDDEN
  const payload = await getPayloadClient()
  return previewApplyTemplate(payload, actor, input)
}

/** Áp khung thật (chỉ admin/manager). */
export async function applyTemplateAction(input: ApplyInput): Promise<ApplyCommitResult> {
  const actor = await getStaffActor()
  if (!actor) return FORBIDDEN
  const payload = await getPayloadClient()
  return applyCurriculumTemplate(payload, actor, input)
}
