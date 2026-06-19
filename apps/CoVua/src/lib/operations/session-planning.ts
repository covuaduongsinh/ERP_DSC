import 'server-only';
import type { Payload } from 'payload';
import type { User } from '@/payload-types';
import { rolesOf, SESSION_PLANNER_ROLES } from '@/access';
import {
  ensureSession,
  expandSlotsForRange,
  formatUtcDate,
  sessionKey,
  toUtcDayStart,
} from './sessions';
import {
  setSessionCancelled,
  createMakeupSession,
  type SimpleResult,
  type MakeupResult,
} from './session-entry';
import { loadHolidayRanges, holidayNameForDate } from './holidays';

/**
 * "LẬP KẾ HOẠCH BUỔI HỌC" (V1) — sinh TRƯỚC chuỗi buổi `du_kien` cho một lớp trong
 * một khoảng ngày từ lịch tuần (`classes.lichHoc`), để nhân viên soạn giáo án từng
 * buổi tay. Khác màn "Buổi học" (ghi nội dung/điểm danh từng buổi rời).
 *
 * TÁI DÙNG NGUYÊN: `expandSlotsForRange` (bung lịch) + `ensureSession` (sinh
 * idempotent theo `khoaBuoi=lop|YYYY-MM-DD`). Hủy buổi / tạo buổi bù tái dùng
 * `setSessionCancelled` / `createMakeupSession` của `session-entry.ts`.
 *
 * BẢO MẬT 🔒:
 *  - Sinh buổi / hủy / tạo bù = thao tác QUẢN LÝ KHUNG LỊCH ⇒ chỉ admin/manager
 *    (`SESSION_PLANNER_ROLES`). KIỂM TRA TRONG CORE (collection `create` của
 *    class-sessions chỉ là `staffOnly`, KHÔNG đủ).
 *  - Đọc/sửa nội dung dùng `overrideAccess:false + actor` ⇒ branch-scope của
 *    `class-sessions` là hàng rào thật (coach/lễ tân chỉ buổi cùng cơ sở; chưa gán
 *    cơ sở ⇒ rỗng).
 *  - KHÔNG đụng `attendance`/`TuitionCycles`: buổi `du_kien` chưa có điểm danh
 *    `co_mat` ⇒ CHƯA tính học phí. Ranh giới đếm buổi giữ nguyên.
 *  - Mỗi lần sinh hàng loạt ghi 1 dòng ImportLog tổng kết (`kind='session-planning'`);
 *    audit per-row tự ghi qua hook collection `class-sessions`.
 */

/** Trần độ dài khoảng sinh (ngày) — chặn vòng lặp khổng lồ do nhập nhầm. */
const MAX_SPAN_DAYS = 180;

/** Trần số buổi nạp ra danh sách (1 lớp × khoảng vài tháng ≪ trần này). */
const LIST_LIMIT = 400;

function isStaff(actor: User | null): actor is User {
  return !!actor && (actor as { collection?: string }).collection === 'users';
}

/** Nhân viên có vai trò lập kế hoạch (admin/manager). Type-guard ⇒ narrow non-null. */
function isPlanner(actor: User | null): actor is User {
  if (!isStaff(actor)) return false;
  const roles = rolesOf(actor as Parameters<typeof rolesOf>[0]);
  return roles.some((r) => (SESSION_PLANNER_ROLES as readonly string[]).includes(r));
}

function relId(v: unknown): number | null {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object' && 'id' in v) {
    const id = (v as { id: unknown }).id;
    return typeof id === 'number' ? id : null;
  }
  return null;
}

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

/** Chuẩn hóa + kiểm tra khoảng [from, to] (UTC-day, bao gồm 2 đầu). */
function normalizeRange(
  from: string | Date,
  to: string | Date,
): { from: string; to: string } | null {
  const f = new Date(from);
  const t = new Date(to);
  if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return null;
  const fs = toUtcDayStart(f);
  const ts = toUtcDayStart(t);
  if (ts.getTime() < fs.getTime()) return null;
  const span = (ts.getTime() - fs.getTime()) / 86_400_000;
  if (span > MAX_SPAN_DAYS) return null;
  return { from: formatUtcDate(fs), to: formatUtcDate(ts) };
}

function utcDayBounds(dateKey: string): { start: Date; end: Date } {
  const d = toUtcDayStart(dateKey);
  const end = new Date(d);
  end.setUTCHours(23, 59, 59, 999);
  return { start: d, end };
}

function classTitleOf(cls: unknown, lopId: number): string {
  const t = strOrNull((cls as { title?: unknown } | null)?.title);
  return t ?? `Lớp #${lopId}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) PREVIEW (dry-run) — phân loại từng ngày: sẽ-tạo / đã-có
// ─────────────────────────────────────────────────────────────────────────────

export interface PlanOutcome {
  /** YYYY-MM-DD (UTC). */
  date: string;
  thu: string;
  gioBatDau: string;
  gioKetThuc: string;
  phong: string | null;
  /**
   * `create` = sẽ sinh mới; `exists` = đã có buổi; `holiday` = trùng ngày nghỉ
   * (KHÔNG sinh). Buổi `holiday` mà ĐÃ lỡ có buổi `du_kien` ⇒ `trangThai='du_kien'`
   * (client dùng để gợi ý rà soát & hủy).
   */
  status: 'create' | 'exists' | 'holiday';
  /** Trạng thái buổi hiện có (khi `exists`, hoặc `holiday` đã lỡ sinh). */
  trangThai: string | null;
  /** Tên ngày nghỉ (chỉ khi `status='holiday'`). */
  holidayName: string | null;
}

export type PreviewPlanResult =
  | {
      ok: true;
      classTitle: string;
      outcomes: PlanOutcome[];
      toCreate: number;
      existing: number;
      /** Số buổi bỏ qua do trùng ngày nghỉ. */
      skipped: number;
      /** Ghi chú (vd lớp chưa có lịch tuần). */
      note: string | null;
    }
  | { ok: false; error: 'forbidden' | 'invalid_input' | 'server'; message: string };

/**
 * Xem trước chuỗi buổi sẽ sinh trong [from, to] từ lịch tuần của lớp. KHÔNG ghi DB.
 * Cho mọi nhân viên (read-only, branch-scope qua `findByID` lớp).
 */
export async function previewPlan(
  payload: Payload,
  actor: User | null,
  input: { lopId: number; from: string; to: string },
): Promise<PreviewPlanResult> {
  if (!isStaff(actor)) {
    return { ok: false, error: 'forbidden', message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.' };
  }
  if (!Number.isInteger(input.lopId) || input.lopId <= 0) {
    return { ok: false, error: 'invalid_input', message: 'Chưa chọn lớp.' };
  }
  const range = normalizeRange(input.from, input.to);
  if (!range) {
    return {
      ok: false,
      error: 'invalid_input',
      message: `Khoảng ngày không hợp lệ (từ ≤ đến, tối đa ${MAX_SPAN_DAYS} ngày).`,
    };
  }

  try {
    const cls = await payload.findByID({
      collection: 'classes',
      id: input.lopId,
      depth: 0,
      user: actor,
      overrideAccess: false,
      disableErrors: true,
    });
    if (!cls) {
      return { ok: false, error: 'forbidden', message: 'Không tìm thấy lớp (hoặc ngoài phạm vi cơ sở của bạn).' };
    }
    const classTitle = classTitleOf(cls, input.lopId);

    const expanded = expandSlotsForRange(
      (cls as { lichHoc?: unknown }).lichHoc as never,
      range.from,
      range.to,
    );
    if (expanded.length === 0) {
      return {
        ok: true,
        classTitle,
        outcomes: [],
        toCreate: 0,
        existing: 0,
        skipped: 0,
        note: 'Lớp chưa có lịch học tuần (hoặc không có buổi nào trong khoảng đã chọn).',
      };
    }

    const keys = expanded.map((e) => sessionKey(input.lopId, e.date));
    const existingRes = await payload.find({
      collection: 'class-sessions',
      where: { khoaBuoi: { in: keys } },
      user: actor,
      overrideAccess: false,
      disableErrors: true,
      depth: 0,
      limit: keys.length,
    });
    const byKey = new Map<string, Record<string, unknown>>();
    for (const d of existingRes.docs as unknown as Array<Record<string, unknown>>) {
      const k = strOrNull(d.khoaBuoi);
      if (k) byKey.set(k, d);
    }

    // Ngày nghỉ áp dụng cho cơ sở của lớp (toàn công ty + cơ sở đó).
    const locationId = relId((cls as { location?: unknown }).location);
    const holidays = await loadHolidayRanges(payload, locationId, range.from, range.to);

    const outcomes: PlanOutcome[] = expanded.map((e) => {
      const ex = byKey.get(sessionKey(input.lopId, e.date));
      const holidayName = holidayNameForDate(e.date, holidays);
      if (holidayName) {
        return {
          date: e.date,
          thu: e.thu,
          gioBatDau: e.gioBatDau,
          gioKetThuc: e.gioKetThuc,
          phong: e.phong,
          status: 'holiday',
          // Giữ trạng thái buổi đã lỡ sinh (nếu có) để client gợi ý rà soát & hủy.
          trangThai: ex ? String(ex.trangThai ?? 'du_kien') : null,
          holidayName,
        };
      }
      return {
        date: e.date,
        thu: e.thu,
        gioBatDau: e.gioBatDau,
        gioKetThuc: e.gioKetThuc,
        phong: e.phong,
        status: ex ? 'exists' : 'create',
        trangThai: ex ? String(ex.trangThai ?? 'du_kien') : null,
        holidayName: null,
      };
    });
    const toCreate = outcomes.filter((o) => o.status === 'create').length;
    const skipped = outcomes.filter((o) => o.status === 'holiday').length;
    return {
      ok: true,
      classTitle,
      outcomes,
      toCreate,
      existing: outcomes.filter((o) => o.status === 'exists').length,
      skipped,
      note: null,
    };
  } catch (err) {
    console.error('[previewPlan] lỗi:', err);
    return { ok: false, error: 'server', message: 'Không xem trước được kế hoạch buổi.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) GENERATE — sinh buổi `du_kien` thật (idempotent) — chỉ admin/manager
// ─────────────────────────────────────────────────────────────────────────────

export type GeneratePlanResult =
  | { ok: true; classTitle: string; created: number; existing: number; skipped: number }
  | { ok: false; error: 'forbidden' | 'invalid_input' | 'server'; message: string };

/**
 * Sinh buổi `du_kien` cho mọi ngày khớp lịch trong [from, to] (idempotent — ngày
 * đã có buổi thì bỏ qua). Ghi ImportLog tổng kết. Chỉ admin/manager.
 */
export async function generatePlan(
  payload: Payload,
  actor: User | null,
  input: { lopId: number; from: string; to: string },
): Promise<GeneratePlanResult> {
  if (!isPlanner(actor)) {
    return { ok: false, error: 'forbidden', message: 'Chỉ quản lý hoặc admin mới được sinh buổi dự kiến.' };
  }
  if (!Number.isInteger(input.lopId) || input.lopId <= 0) {
    return { ok: false, error: 'invalid_input', message: 'Chưa chọn lớp.' };
  }
  const range = normalizeRange(input.from, input.to);
  if (!range) {
    return {
      ok: false,
      error: 'invalid_input',
      message: `Khoảng ngày không hợp lệ (từ ≤ đến, tối đa ${MAX_SPAN_DAYS} ngày).`,
    };
  }

  try {
    const cls = await payload.findByID({
      collection: 'classes',
      id: input.lopId,
      depth: 0,
      user: actor,
      overrideAccess: false,
      disableErrors: true,
    });
    if (!cls) {
      return { ok: false, error: 'forbidden', message: 'Không tìm thấy lớp (hoặc ngoài phạm vi cơ sở của bạn).' };
    }
    const classTitle = classTitleOf(cls, input.lopId);

    const expanded = expandSlotsForRange(
      (cls as { lichHoc?: unknown }).lichHoc as never,
      range.from,
      range.to,
    );
    if (expanded.length === 0) {
      return { ok: true, classTitle, created: 0, existing: 0, skipped: 0 };
    }

    const keys = expanded.map((e) => sessionKey(input.lopId, e.date));
    const existingRes = await payload.find({
      collection: 'class-sessions',
      where: { khoaBuoi: { in: keys } },
      user: actor,
      overrideAccess: false,
      disableErrors: true,
      depth: 0,
      limit: keys.length,
    });
    const existingKeys = new Set<string>();
    for (const d of existingRes.docs as unknown as Array<Record<string, unknown>>) {
      const k = strOrNull(d.khoaBuoi);
      if (k) existingKeys.add(k);
    }

    // Ngày nghỉ áp dụng cho cơ sở của lớp — KHÔNG sinh buổi vào các ngày này.
    const locationId = relId((cls as { location?: unknown }).location);
    const holidays = await loadHolidayRanges(payload, locationId, range.from, range.to);

    let created = 0;
    let skipped = 0;
    for (const e of expanded) {
      if (holidayNameForDate(e.date, holidays)) {
        skipped += 1;
        continue;
      }
      if (existingKeys.has(sessionKey(input.lopId, e.date))) continue;
      // ensureSession idempotent (race-safe) — chỉ gọi cho ngày chưa có buổi.
      await ensureSession(payload, actor, { lopId: input.lopId, date: e.date });
      created += 1;
    }
    const existing = expanded.length - created - skipped;

    await writePlanningLog(payload, actor.id, {
      classTitle,
      from: range.from,
      to: range.to,
      created,
      existing,
      skipped,
    });

    return { ok: true, classTitle, created, existing, skipped };
  } catch (err) {
    console.error('[generatePlan] lỗi:', err);
    return { ok: false, error: 'server', message: 'Không sinh được buổi dự kiến.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) LIST — nạp các buổi của lớp trong khoảng để sửa nội dung / hủy / bù
// ─────────────────────────────────────────────────────────────────────────────

export interface PlannedSessionRow {
  sessionId: number;
  /** YYYY-MM-DD (UTC). */
  date: string | null;
  thu: string | null;
  gioBatDau: string | null;
  gioKetThuc: string | null;
  phong: string | null;
  trangThai: string;
  buoiGocId: number | null;
  content: {
    mucTieu: string | null;
    kienThucMoi: string | null;
    giaoBTVN: string | null;
    khBuoiSau: string | null;
    sachDangHoc: string | null;
  };
}

export type LoadPlannedSessionsResult =
  | { ok: true; rows: PlannedSessionRow[] }
  | { ok: false; error: 'forbidden' | 'invalid_input' | 'server'; message: string };

/** Nạp buổi của lớp trong [from, to] (branch-scope qua actor). */
export async function loadPlannedSessions(
  payload: Payload,
  actor: User | null,
  input: { lopId: number; from: string; to: string },
): Promise<LoadPlannedSessionsResult> {
  if (!isStaff(actor)) {
    return { ok: false, error: 'forbidden', message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.' };
  }
  if (!Number.isInteger(input.lopId) || input.lopId <= 0) {
    return { ok: false, error: 'invalid_input', message: 'Chưa chọn lớp.' };
  }
  const range = normalizeRange(input.from, input.to);
  if (!range) {
    return { ok: false, error: 'invalid_input', message: 'Khoảng ngày không hợp lệ.' };
  }

  try {
    const { start } = utcDayBounds(range.from);
    const { end } = utcDayBounds(range.to);
    const { docs } = await payload.find({
      collection: 'class-sessions',
      where: {
        and: [
          { lop: { equals: input.lopId } },
          { date: { greater_than_equal: start.toISOString() } },
          { date: { less_than_equal: end.toISOString() } },
        ],
      },
      user: actor,
      overrideAccess: false,
      disableErrors: true,
      depth: 0,
      sort: 'date',
      limit: LIST_LIMIT,
    });

    const rows: PlannedSessionRow[] = (docs as unknown as Array<Record<string, unknown>>).map((d) => ({
      sessionId: d.id as number,
      date: d.date ? formatUtcDate(d.date as string) : null,
      thu: strOrNull(d.thu),
      gioBatDau: strOrNull(d.gioBatDau),
      gioKetThuc: strOrNull(d.gioKetThuc),
      phong: strOrNull(d.phong),
      trangThai: String(d.trangThai ?? 'du_kien'),
      buoiGocId: relId(d.buoiGoc),
      content: {
        mucTieu: strOrNull(d.mucTieu),
        kienThucMoi: strOrNull(d.kienThucMoi),
        giaoBTVN: strOrNull(d.giaoBTVN),
        khBuoiSau: strOrNull(d.khBuoiSau),
        sachDangHoc: strOrNull(d.sachDangHoc),
      },
    }));
    return { ok: true, rows };
  } catch (err) {
    console.error('[loadPlannedSessions] lỗi:', err);
    return { ok: false, error: 'server', message: 'Không tải được danh sách buổi.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4) HỦY / TẠO BÙ — planner-gate rồi ủy quyền session-entry (đã có)
// ─────────────────────────────────────────────────────────────────────────────

/** Hủy buổi (kèm lý do). Chỉ admin/manager. Ủy quyền `setSessionCancelled`. */
export async function cancelPlannedSession(
  payload: Payload,
  actor: User | null,
  input: { classId: number; date: string; reason?: string },
): Promise<SimpleResult> {
  if (!isPlanner(actor)) {
    return { ok: false, error: 'forbidden', message: 'Chỉ quản lý hoặc admin mới được hủy buổi.' };
  }
  return setSessionCancelled(payload, actor, {
    classId: input.classId,
    date: input.date,
    huy: true,
    reason: input.reason,
  });
}

/**
 * Tạo buổi dạy bù vào ngày mới, trỏ về buổi gốc đã hủy. Chỉ admin/manager.
 * Chặn ghi đè: nếu ngày bù ĐÃ có buổi của lớp (≠ buổi bù) → lỗi rõ ràng.
 */
export async function createPlannedMakeup(
  payload: Payload,
  actor: User | null,
  input: { classId: number; originalSessionId: number; date: string },
): Promise<MakeupResult> {
  if (!isPlanner(actor)) {
    return { ok: false, error: 'forbidden', message: 'Chỉ quản lý hoặc admin mới được tạo buổi bù.' };
  }
  const range = normalizeRange(input.date, input.date);
  if (!range || !Number.isInteger(input.classId) || input.classId <= 0) {
    return { ok: false, error: 'invalid_input', message: 'Lớp hoặc ngày bù không hợp lệ.' };
  }

  try {
    const existing = await payload.find({
      collection: 'class-sessions',
      where: { khoaBuoi: { equals: sessionKey(input.classId, range.from) } },
      overrideAccess: true,
      disableErrors: true,
      depth: 0,
      limit: 1,
    });
    const dup = existing.docs[0] as unknown as Record<string, unknown> | undefined;
    if (dup && String(dup.trangThai ?? '') !== 'bu') {
      return {
        ok: false,
        error: 'invalid_input',
        message: 'Ngày này đã có buổi của lớp; chọn ngày khác để dạy bù.',
      };
    }
  } catch (err) {
    console.error('[createPlannedMakeup] kiểm tra trùng lỗi:', err);
    return { ok: false, error: 'server', message: 'Không kiểm tra được ngày bù.' };
  }

  return createMakeupSession(payload, actor, {
    classId: input.classId,
    originalSessionId: input.originalSessionId,
    date: input.date,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 5) NHẬT KÝ — 1 dòng ImportLog tổng kết mỗi lần sinh (best-effort)
// ─────────────────────────────────────────────────────────────────────────────

async function writePlanningLog(
  payload: Payload,
  userId: number,
  summary: {
    classTitle: string;
    from: string;
    to: string;
    created: number;
    existing: number;
    skipped: number;
  },
): Promise<void> {
  try {
    await payload.create({
      collection: 'import-logs',
      data: {
        kind: 'session-planning',
        fileName: `${summary.classTitle} · ${summary.from}→${summary.to}`,
        user: userId,
        rowsTotal: summary.created + summary.existing + summary.skipped,
        rowsCreated: summary.created,
        rowsUpdated: 0,
        rowsSkipped: summary.existing + summary.skipped,
        rowsErrors: 0,
        notes: `Sinh ${summary.created} buổi dự kiến, bỏ qua ${summary.existing} buổi đã có${
          summary.skipped > 0 ? `, bỏ ${summary.skipped} buổi trùng ngày nghỉ` : ''
        } (lớp ${summary.classTitle}, ${summary.from}→${summary.to}).`,
      } as never,
      overrideAccess: true,
    });
  } catch (err) {
    // Nhật ký là best-effort — không chặn thao tác sinh.
    console.error('[writePlanningLog] lỗi:', err);
  }
}
