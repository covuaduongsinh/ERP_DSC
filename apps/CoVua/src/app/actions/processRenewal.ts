'use server';

import { headers as nextHeaders } from 'next/headers';
import type { User } from '@/payload-types';
import { getPayloadClient } from '@/lib/payload';
import {
  approveRenewalRequest,
  rejectRenewalRequest,
  type ApproveRenewalInput,
  type ApproveRenewalResult,
  type RejectRenewalInput,
  type RejectRenewalResult,
} from '@/lib/renewals/process';

export type ApproveRenewalActionResult = ApproveRenewalResult;
export type RejectRenewalActionResult = RejectRenewalResult;

/** Resolve nhân viên đăng nhập từ cookie; trả null nếu không phải staff. */
async function getStaffActor(): Promise<User | null> {
  const payload = await getPayloadClient();
  const headersList = await nextHeaders();
  const { user } = await payload.auth({
    headers: headersList as unknown as Headers,
  });
  return user?.collection === 'users' ? (user as User) : null;
}

/**
 * Server Action: DUYỆT yêu cầu gia hạn → sinh chu kỳ học phí mới.
 *
 * Danh tính lấy từ phiên đăng nhập server-side (KHÔNG nhận role/userId từ
 * client). Core `approveRenewalRequest` gate role (kế toán/quản lý/admin) +
 * xác nhận; collection access là hàng rào DB-level.
 */
export async function approveRenewal(
  input: ApproveRenewalInput,
): Promise<ApproveRenewalActionResult> {
  const actor = await getStaffActor();
  if (!actor) {
    return {
      ok: false,
      error: 'forbidden',
      message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.',
    };
  }
  const payload = await getPayloadClient();
  return approveRenewalRequest(payload, actor, input);
}

/**
 * Server Action: TỪ CHỐI yêu cầu gia hạn (ghi lý do, không sinh chu kỳ).
 */
export async function rejectRenewal(
  input: RejectRenewalInput,
): Promise<RejectRenewalActionResult> {
  const actor = await getStaffActor();
  if (!actor) {
    return {
      ok: false,
      error: 'forbidden',
      message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.',
    };
  }
  const payload = await getPayloadClient();
  return rejectRenewalRequest(payload, actor, input);
}
