import 'server-only';
import type { Payload } from 'payload';
import type { User } from '@/payload-types';
import { ensureSession } from './sessions';
import { loadClassRoster } from './roster';

/**
 * Màn "Buổi học" (GĐ4) — nhập TRỌN một buổi trong app: nội dung buổi (cấp lớp) +
 * điểm danh & nhận xét từng HV + hủy/dạy bù. Lõi I/O thuần (tách next/headers) để
 * unit-test bằng fake payload như `quick-attendance`/`enrollment`.
 *
 * Chuẩn hóa: field CẤP BUỔI ghi vào `class-sessions`; field CẤP HV ghi vào
 * `attendance` (idempotent student+ngày, kèm FK `session`). KHÔNG đổi nguồn đếm
 * buổi (status co_mat giữ nguyên nghĩa). Mọi ghi `overrideAccess:false + actor`
 * (collection access là hàng rào DB-level), trừ lookup idempotent (overrideAccess
 * true, khóa cứng theo student+ngày — không leak chéo).
 */

export type SessionStatus = 'co_mat' | 'vang' | 'phep';

export interface SessionEntryRow {
  studentId: number;
  fullName: string;
  sessionsRemaining: number | null;
  status: SessionStatus | null;
  yThuc: number | null;
  lamBTVN: number | null;
  nhanXet: string | null;
  linkLichess: string | null;
}

export interface SessionEntryData {
  sessionId: number;
  trangThai: string;
  coachThucTe: number | null;
  kienThucMoi: string | null;
  giaoBTVN: string | null;
  khBuoiSau: string | null;
  sachDangHoc: string | null;
  ghiChuBuoi: string | null;
}

export type LoadSessionEntryResult =
  | { ok: true; session: SessionEntryData; rows: SessionEntryRow[] }
  | { ok: false; error: 'forbidden' | 'invalid_input' | 'server'; message: string };

const VALID_STATUSES: SessionStatus[] = ['co_mat', 'vang', 'phep'];

function isStaff(actor: User | null): actor is User {
  return !!actor && (actor as { collection?: string }).collection === 'users';
}

function relId(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && 'id' in v) {
    const id = (v as { id: unknown }).id;
    return typeof id === 'number' ? id : null;
  }
  return null;
}

function utcDayBounds(date: string): { start: Date; end: Date } | null {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const start = new Date(d);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(d);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

/** Nạp buổi (ensureSession) + sĩ số + prefill attendance hiện có trong ngày. */
export async function loadSessionEntry(
  payload: Payload,
  actor: User | null,
  input: { classId: number; date: string },
): Promise<LoadSessionEntryResult> {
  if (!isStaff(actor)) {
    return { ok: false, error: 'forbidden', message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.' };
  }
  if (!Number.isInteger(input.classId) || input.classId <= 0) {
    return { ok: false, error: 'invalid_input', message: 'Chưa chọn lớp.' };
  }
  const bounds = utcDayBounds(input.date);
  if (!bounds) {
    return { ok: false, error: 'invalid_input', message: 'Ngày học không hợp lệ.' };
  }

  try {
    const session = await ensureSession(payload, actor, { lopId: input.classId, date: bounds.start });
    const roster = await loadClassRoster(payload, actor, input.classId);
    const studentIds = roster.map((r) => r.studentId);

    const existing =
      studentIds.length > 0
        ? await payload.find({
            collection: 'attendance',
            where: {
              and: [
                { student: { in: studentIds } },
                { date: { greater_than_equal: bounds.start.toISOString() } },
                { date: { less_than_equal: bounds.end.toISOString() } },
              ],
            },
            user: actor,
            overrideAccess: false,
            depth: 0,
            limit: 1000,
          })
        : { docs: [] as Array<Record<string, unknown>> };

    const byStudent = new Map<number, Record<string, unknown>>();
    for (const a of existing.docs as Array<Record<string, unknown>>) {
      const sid = relId(a.student);
      if (sid !== null) byStudent.set(sid, a);
    }

    const rows: SessionEntryRow[] = roster.map((r) => {
      const a = byStudent.get(r.studentId);
      const status = a?.status as SessionStatus | undefined;
      return {
        studentId: r.studentId,
        fullName: r.fullName,
        sessionsRemaining: r.sessionsRemaining,
        status: status && VALID_STATUSES.includes(status) ? status : null,
        yThuc: a ? numOrNull(a.yThuc) : null,
        lamBTVN: a ? numOrNull(a.lamBTVN) : null,
        nhanXet: a ? strOrNull(a.nhanXet) : null,
        linkLichess: a ? strOrNull(a.linkLichess) : null,
      };
    });

    const s = session as unknown as Record<string, unknown>;
    return {
      ok: true,
      session: {
        sessionId: session.id,
        trangThai: String(s.trangThai ?? 'du_kien'),
        coachThucTe: relId(s.coachThucTe),
        kienThucMoi: strOrNull(s.kienThucMoi),
        giaoBTVN: strOrNull(s.giaoBTVN),
        khBuoiSau: strOrNull(s.khBuoiSau),
        sachDangHoc: strOrNull(s.sachDangHoc),
        ghiChuBuoi: strOrNull(s.ghiChuBuoi),
      },
      rows,
    };
  } catch (err) {
    console.error('[loadSessionEntry] lỗi:', err);
    return { ok: false, error: 'server', message: 'Có lỗi khi tải buổi học. Vui lòng thử lại.' };
  }
}

export interface SaveSessionEntryInput {
  classId: number;
  date: string;
  session: {
    coachThucTe?: number | null;
    kienThucMoi?: string;
    giaoBTVN?: string;
    khBuoiSau?: string;
    sachDangHoc?: string;
  };
  entries: Array<{
    studentId: number;
    status: SessionStatus;
    yThuc?: number | null;
    lamBTVN?: number | null;
    nhanXet?: string | null;
    linkLichess?: string | null;
  }>;
}

export type SaveSessionEntryResult =
  | { ok: true; created: number; updated: number }
  | { ok: false; error: 'forbidden' | 'invalid_input' | 'server'; message: string };

/** Lưu buổi: cập nhật nội dung buổi (cấp lớp) + upsert điểm danh/nhận xét từng HV. */
export async function saveSessionEntry(
  payload: Payload,
  actor: User | null,
  input: SaveSessionEntryInput,
): Promise<SaveSessionEntryResult> {
  if (!isStaff(actor)) {
    return { ok: false, error: 'forbidden', message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.' };
  }
  if (!Number.isInteger(input.classId) || input.classId <= 0) {
    return { ok: false, error: 'invalid_input', message: 'Chưa chọn lớp.' };
  }
  const bounds = utcDayBounds(input.date);
  if (!bounds) {
    return { ok: false, error: 'invalid_input', message: 'Ngày học không hợp lệ.' };
  }
  const entries = (input.entries ?? []).filter(
    (e) => Number.isInteger(e.studentId) && e.studentId > 0 && VALID_STATUSES.includes(e.status),
  );

  try {
    const session = await ensureSession(payload, actor, { lopId: input.classId, date: bounds.start });
    const currentTrangThai = String((session as unknown as Record<string, unknown>).trangThai ?? 'du_kien');

    // Nội dung buổi (cấp lớp). Buổi đã "hủy" thì GIỮ trạng thái huy (không tự mở lại
    // khi lưu nội dung); ngược lại đánh dấu "đã dạy".
    const sessionData: Record<string, unknown> = {
      kienThucMoi: input.session.kienThucMoi ?? null,
      giaoBTVN: input.session.giaoBTVN ?? null,
      khBuoiSau: input.session.khBuoiSau ?? null,
      sachDangHoc: input.session.sachDangHoc ?? null,
      coachThucTe: input.session.coachThucTe ?? null,
    };
    if (currentTrangThai !== 'huy') sessionData.trangThai = 'da_day';
    await payload.update({ collection: 'class-sessions', id: session.id, data: sessionData, user: actor, overrideAccess: false });

    let created = 0;
    let updated = 0;
    for (const e of entries) {
      const fields: Record<string, unknown> = {
        status: e.status,
        lop: input.classId,
        session: session.id,
        yThuc: numOrNull(e.yThuc),
        lamBTVN: numOrNull(e.lamBTVN),
        nhanXet: strOrNull(e.nhanXet),
        linkLichess: strOrNull(e.linkLichess),
      };

      // Idempotent lookup theo student+ngày (overrideAccess:true cố ý — khóa cứng).
      const found = await payload.find({
        collection: 'attendance',
        where: {
          and: [
            { student: { equals: e.studentId } },
            { date: { greater_than_equal: bounds.start.toISOString() } },
            { date: { less_than_equal: bounds.end.toISOString() } },
          ],
        },
        user: actor,
        overrideAccess: true,
        depth: 0,
        limit: 1,
      });

      if (found.docs.length > 0) {
        await payload.update({ collection: 'attendance', id: found.docs[0].id, data: fields, user: actor, overrideAccess: false });
        updated += 1;
      } else {
        await payload.create({
          collection: 'attendance',
          data: { student: e.studentId, date: bounds.start.toISOString(), ...fields } as never,
          user: actor,
          overrideAccess: false,
        });
        created += 1;
      }
    }
    return { ok: true, created, updated };
  } catch (err) {
    console.error('[saveSessionEntry] lỗi:', err);
    return { ok: false, error: 'server', message: 'Có lỗi khi lưu buổi học. Vui lòng thử lại.' };
  }
}

export type SimpleResult =
  | { ok: true }
  | { ok: false; error: 'forbidden' | 'invalid_input' | 'server'; message: string };

/** Hủy buổi (huy=true) hoặc mở lại (huy=false). */
export async function setSessionCancelled(
  payload: Payload,
  actor: User | null,
  input: { classId: number; date: string; huy: boolean; reason?: string },
): Promise<SimpleResult> {
  if (!isStaff(actor)) {
    return { ok: false, error: 'forbidden', message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.' };
  }
  const bounds = utcDayBounds(input.date);
  if (!Number.isInteger(input.classId) || input.classId <= 0 || !bounds) {
    return { ok: false, error: 'invalid_input', message: 'Lớp hoặc ngày không hợp lệ.' };
  }
  try {
    const session = await ensureSession(payload, actor, { lopId: input.classId, date: bounds.start });
    await payload.update({
      collection: 'class-sessions',
      id: session.id,
      data: { trangThai: input.huy ? 'huy' : 'da_day', ghiChuBuoi: input.huy ? (input.reason ?? null) : null },
      user: actor,
      overrideAccess: false,
    });
    return { ok: true };
  } catch (err) {
    console.error('[setSessionCancelled] lỗi:', err);
    return { ok: false, error: 'server', message: 'Có lỗi khi cập nhật trạng thái buổi.' };
  }
}

export type MakeupResult =
  | { ok: true; makeupSessionId: number }
  | { ok: false; error: 'forbidden' | 'invalid_input' | 'server'; message: string };

/** Tạo buổi dạy bù (trên ngày mới) trỏ về buổi gốc (đã hủy). */
export async function createMakeupSession(
  payload: Payload,
  actor: User | null,
  input: { classId: number; originalSessionId: number; date: string },
): Promise<MakeupResult> {
  if (!isStaff(actor)) {
    return { ok: false, error: 'forbidden', message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.' };
  }
  const bounds = utcDayBounds(input.date);
  if (!Number.isInteger(input.classId) || input.classId <= 0 || !bounds) {
    return { ok: false, error: 'invalid_input', message: 'Lớp hoặc ngày không hợp lệ.' };
  }
  if (!Number.isInteger(input.originalSessionId) || input.originalSessionId <= 0) {
    return { ok: false, error: 'invalid_input', message: 'Buổi gốc không hợp lệ.' };
  }
  try {
    const makeup = await ensureSession(payload, actor, { lopId: input.classId, date: bounds.start });
    await payload.update({
      collection: 'class-sessions',
      id: makeup.id,
      data: { trangThai: 'bu', buoiGoc: input.originalSessionId },
      user: actor,
      overrideAccess: false,
    });
    return { ok: true, makeupSessionId: makeup.id };
  } catch (err) {
    console.error('[createMakeupSession] lỗi:', err);
    return { ok: false, error: 'server', message: 'Có lỗi khi tạo buổi bù.' };
  }
}
