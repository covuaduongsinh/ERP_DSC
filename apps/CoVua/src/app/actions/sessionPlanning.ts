'use server';

import { headers as nextHeaders } from 'next/headers';
import type { User } from '@/payload-types';
import { getPayloadClient } from '@/lib/payload';
import {
  previewPlan,
  generatePlan,
  loadPlannedSessions,
  cancelPlannedSession,
  createPlannedMakeup,
  type PreviewPlanResult,
  type GeneratePlanResult,
  type LoadPlannedSessionsResult,
} from '@/lib/operations/session-planning';
import type { SimpleResult, MakeupResult } from '@/lib/operations/session-entry';
import {
  loadSessionStudentPlans,
  updateStudentPlan,
  applyClassPlanToAll,
  type LoadSessionStudentPlansResult,
  type PlanSimpleResult,
  type ApplyAllResult,
  type StudentPlanContent,
} from '@/lib/operations/session-student-plans';

/**
 * Server Actions cho trang "Lập kế hoạch buổi học". Resolve nhân viên từ cookie
 * rồi ủy quyền core (`session-planning.ts`) — role gate (admin/manager cho sinh/
 * hủy/bù) và branch-scope nằm trong core. Sửa NỘI DUNG buổi dùng lại
 * `updateSessionContentAction` của `sessionFeedback.ts`.
 */

async function getStaffActor(): Promise<User | null> {
  const payload = await getPayloadClient();
  const headersList = await nextHeaders();
  const { user } = await payload.auth({ headers: headersList as unknown as Headers });
  return user?.collection === 'users' ? (user as User) : null;
}

const FORBIDDEN = {
  ok: false as const,
  error: 'forbidden' as const,
  message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.',
};

export interface PlanRangeInput {
  lopId: number;
  from: string;
  to: string;
}

/** Xem trước (dry-run) chuỗi buổi sẽ sinh. */
export async function previewPlanAction(input: PlanRangeInput): Promise<PreviewPlanResult> {
  const actor = await getStaffActor();
  if (!actor) return FORBIDDEN;
  const payload = await getPayloadClient();
  return previewPlan(payload, actor, input);
}

/** Xác nhận sinh buổi dự kiến (chỉ admin/manager). */
export async function generatePlanAction(input: PlanRangeInput): Promise<GeneratePlanResult> {
  const actor = await getStaffActor();
  if (!actor) return FORBIDDEN;
  const payload = await getPayloadClient();
  return generatePlan(payload, actor, input);
}

/** Nạp danh sách buổi của lớp trong khoảng (để sửa nội dung / hủy / bù). */
export async function listPlannedSessionsAction(input: PlanRangeInput): Promise<LoadPlannedSessionsResult> {
  const actor = await getStaffActor();
  if (!actor) return FORBIDDEN;
  const payload = await getPayloadClient();
  return loadPlannedSessions(payload, actor, input);
}

/** Hủy buổi (chỉ admin/manager). */
export async function cancelPlannedSessionAction(input: {
  classId: number;
  date: string;
  reason?: string;
}): Promise<SimpleResult> {
  const actor = await getStaffActor();
  if (!actor) return FORBIDDEN;
  const payload = await getPayloadClient();
  return cancelPlannedSession(payload, actor, input);
}

/** Tạo buổi dạy bù (chỉ admin/manager). */
export async function createPlannedMakeupAction(input: {
  classId: number;
  originalSessionId: number;
  date: string;
}): Promise<MakeupResult> {
  const actor = await getStaffActor();
  if (!actor) return FORBIDDEN;
  const payload = await getPayloadClient();
  return createPlannedMakeup(payload, actor, input);
}

// ─── Kế hoạch theo từng HV (V1.1) — chỉ staff + branch-scope (KHÔNG planner-only) ─

/** Nạp roster + kế hoạch cá nhân (override) + nội dung kế thừa của một buổi. */
export async function loadSessionStudentPlansAction(
  sessionId: number,
): Promise<LoadSessionStudentPlansResult> {
  const actor = await getStaffActor();
  if (!actor) return FORBIDDEN;
  const payload = await getPayloadClient();
  return loadSessionStudentPlans(payload, actor, sessionId);
}

/** Ghi đè nội dung kế hoạch riêng cho 1 HV trong buổi (idempotent). */
export async function updateStudentPlanAction(input: {
  sessionId: number;
  studentId: number;
  patch: Partial<StudentPlanContent>;
}): Promise<PlanSimpleResult> {
  const actor = await getStaffActor();
  if (!actor) return FORBIDDEN;
  const payload = await getPayloadClient();
  return updateStudentPlan(payload, actor, input);
}

/** Áp nội dung buổi (cả lớp) xuống tất cả HV trong roster của buổi. */
export async function applyClassPlanToAllAction(sessionId: number): Promise<ApplyAllResult> {
  const actor = await getStaffActor();
  if (!actor) return FORBIDDEN;
  const payload = await getPayloadClient();
  return applyClassPlanToAll(payload, actor, sessionId);
}
