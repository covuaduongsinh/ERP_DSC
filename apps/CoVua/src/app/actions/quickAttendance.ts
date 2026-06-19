'use server';

import { headers as nextHeaders } from 'next/headers';
import type { User } from '@/payload-types';
import { getPayloadClient } from '@/lib/payload';
import { loadClassRoster, type ClassRosterRow } from '@/lib/operations/roster';
import {
  submitQuickAttendance,
  type SubmitQuickAttendanceInput,
  type SubmitQuickAttendanceResult,
} from '@/lib/operations/quick-attendance';

/** Resolve nhân viên đăng nhập từ cookie; null nếu không phải staff. */
async function getStaffActor(): Promise<User | null> {
  const payload = await getPayloadClient();
  const headersList = await nextHeaders();
  const { user } = await payload.auth({
    headers: headersList as unknown as Headers,
  });
  return user?.collection === 'users' ? (user as User) : null;
}

export type FetchClassRosterResult =
  | { ok: true; rows: ClassRosterRow[] }
  | { ok: false; message: string };

/**
 * Server Action: nạp sĩ số một lớp (branch-scoped). Dùng chung cho màn Điểm danh
 * nhanh và Sĩ số lớp. Danh tính lấy từ phiên server; HV ngoài cơ sở bị loại.
 */
export async function fetchClassRoster(
  classId: number,
): Promise<FetchClassRosterResult> {
  const actor = await getStaffActor();
  if (!actor) {
    return { ok: false, message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.' };
  }
  if (!Number.isInteger(classId) || classId <= 0) {
    return { ok: false, message: 'Lớp không hợp lệ.' };
  }
  const payload = await getPayloadClient();
  const rows = await loadClassRoster(payload, actor, classId);
  return { ok: true, rows };
}

/**
 * Server Action: ghi điểm danh nhanh cả lớp (idempotent theo student+ngày).
 */
export async function saveQuickAttendance(
  input: SubmitQuickAttendanceInput,
): Promise<SubmitQuickAttendanceResult> {
  const actor = await getStaffActor();
  if (!actor) {
    return {
      ok: false,
      error: 'forbidden',
      message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.',
    };
  }
  const payload = await getPayloadClient();
  return submitQuickAttendance(payload, actor, input);
}
