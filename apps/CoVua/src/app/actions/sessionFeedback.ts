'use server';

import { headers as nextHeaders } from 'next/headers';
import type { User } from '@/payload-types';
import { getPayloadClient } from '@/lib/payload';
import {
  updateAttendanceFeedback,
  updateSessionContent,
  type AttendanceFeedbackPatch,
  type SessionContentPatch,
  type FeedbackUpdateResult,
} from '@/lib/operations/session-feedback';
import {
  bulkUpdateSessions,
  bulkDeleteSessions,
  type BulkSessionPatch,
  type BulkOpResult,
} from '@/lib/operations/sessions-bulk';

/** Resolve nhân viên đăng nhập từ cookie; null nếu không phải staff. */
async function getStaffActor(): Promise<User | null> {
  const payload = await getPayloadClient();
  const headersList = await nextHeaders();
  const { user } = await payload.auth({ headers: headersList as unknown as Headers });
  return user?.collection === 'users' ? (user as User) : null;
}

const FORBIDDEN: FeedbackUpdateResult = {
  ok: false,
  error: 'forbidden',
  message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.',
};

/** Sửa nhận xét/điểm danh per-HV trên một bản ghi attendance. */
export async function updateAttendanceFeedbackAction(
  attendanceId: number,
  patch: AttendanceFeedbackPatch,
): Promise<FeedbackUpdateResult> {
  const actor = await getStaffActor();
  if (!actor) return FORBIDDEN;
  const payload = await getPayloadClient();
  return updateAttendanceFeedback(payload, actor, attendanceId, patch);
}

/** Sửa nội dung buổi (cấp lớp) trên class-sessions. */
export async function updateSessionContentAction(
  sessionId: number,
  patch: SessionContentPatch,
): Promise<FeedbackUpdateResult> {
  const actor = await getStaffActor();
  if (!actor) return FORBIDDEN;
  const payload = await getPayloadClient();
  return updateSessionContent(payload, actor, sessionId, patch);
}

const BULK_FORBIDDEN: BulkOpResult = {
  ok: false,
  error: 'forbidden',
  message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.',
};

/** Gán cơ sở / lớp / GV thực dạy cho nhiều buổi đã chọn. */
export async function bulkUpdateSessionsAction(input: {
  sessionIds: number[];
  patch: BulkSessionPatch;
}): Promise<BulkOpResult> {
  const actor = await getStaffActor();
  if (!actor) return BULK_FORBIDDEN;
  const payload = await getPayloadClient();
  return bulkUpdateSessions(payload, actor, input);
}

/** Xóa nhiều buổi đã chọn (kèm điểm danh) — yêu cầu confirm. */
export async function bulkDeleteSessionsAction(input: {
  sessionIds: number[];
  confirm: boolean;
}): Promise<BulkOpResult> {
  const actor = await getStaffActor();
  if (!actor) return BULK_FORBIDDEN;
  const payload = await getPayloadClient();
  return bulkDeleteSessions(payload, actor, input);
}
