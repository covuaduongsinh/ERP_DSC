'use server';

import { headers as nextHeaders } from 'next/headers';
import type { User } from '@/payload-types';
import { getPayloadClient } from '@/lib/payload';
import {
  loadSessionEntry,
  saveSessionEntry,
  setSessionCancelled,
  createMakeupSession,
  type LoadSessionEntryResult,
  type SaveSessionEntryInput,
  type SaveSessionEntryResult,
  type SimpleResult,
  type MakeupResult,
} from '@/lib/operations/session-entry';

/** Resolve nhân viên đăng nhập từ cookie; null nếu không phải staff. */
async function getStaffActor(): Promise<User | null> {
  const payload = await getPayloadClient();
  const headersList = await nextHeaders();
  const { user } = await payload.auth({ headers: headersList as unknown as Headers });
  return user?.collection === 'users' ? (user as User) : null;
}

const FORBIDDEN = 'Bạn cần đăng nhập bằng tài khoản nhân viên.';

export async function fetchSessionEntry(classId: number, date: string): Promise<LoadSessionEntryResult> {
  const actor = await getStaffActor();
  if (!actor) return { ok: false, error: 'forbidden', message: FORBIDDEN };
  const payload = await getPayloadClient();
  return loadSessionEntry(payload, actor, { classId, date });
}

export async function saveSessionEntryAction(input: SaveSessionEntryInput): Promise<SaveSessionEntryResult> {
  const actor = await getStaffActor();
  if (!actor) return { ok: false, error: 'forbidden', message: FORBIDDEN };
  const payload = await getPayloadClient();
  return saveSessionEntry(payload, actor, input);
}

export async function setSessionCancelledAction(input: {
  classId: number;
  date: string;
  huy: boolean;
  reason?: string;
}): Promise<SimpleResult> {
  const actor = await getStaffActor();
  if (!actor) return { ok: false, error: 'forbidden', message: FORBIDDEN };
  const payload = await getPayloadClient();
  return setSessionCancelled(payload, actor, input);
}

export async function createMakeupAction(input: {
  classId: number;
  originalSessionId: number;
  date: string;
}): Promise<MakeupResult> {
  const actor = await getStaffActor();
  if (!actor) return { ok: false, error: 'forbidden', message: FORBIDDEN };
  const payload = await getPayloadClient();
  return createMakeupSession(payload, actor, input);
}
