import 'server-only';
import type { Payload } from 'payload';
import type { User } from '@/payload-types';
import { rolesOf, SESSION_PLANNER_ROLES, CURRICULUM_MANAGER_ROLES } from '@/access';
import { levelOrder, trackOrder, type ChessLevel, type TrackName } from '@/lib/roadmap';
import { loadPlannedSessions, type PlannedSessionRow } from './session-planning';
import { updateSessionContent, type SessionContentPatch } from './session-feedback';

/**
 * KHUNG LỘ TRÌNH / giáo trình mẫu theo cấp (V2) — core CRUD + "Áp khung".
 *
 * 🔒 BẢO MẬT:
 *  - CRUD khung (tạo/sửa/xóa) chỉ admin/manager (`CURRICULUM_MANAGER_ROLES`) —
 *    KIỂM TRA TRONG CORE (collection access cũng chặn, đây là defense-in-depth).
 *    Đọc khung: mọi staff (read=staffOnly) — để áp vào lớp.
 *  - "Áp khung" = quyết định lập kế hoạch ⇒ chỉ admin/manager (`SESSION_PLANNER_ROLES`,
 *    đồng nhất với `generatePlan`). Ghi nội dung buổi qua `updateSessionContent`
 *    (overrideAccess:false + actor ⇒ branch-scope của `class-sessions` là hàng rào).
 *  - 🔒 KHÔNG đụng `attendance`/`tuition_cycles`: áp khung chỉ ghi field text cấp
 *    lớp; buổi vẫn `du_kien`, không sinh điểm danh, không trừ buổi.
 */

/** Field nội dung khung MAP sang buổi khi áp (KHÔNG gồm khBuoiSau/ghiChu/nguonRef). */
const APPLY_FIELDS = ['mucTieu', 'kienThucMoi', 'giaoBTVN', 'sachDangHoc'] as const;
type ApplyField = (typeof APPLY_FIELDS)[number];

/** Trạng thái buổi được map khi áp khung (chỉ buổi dự kiến). */
const PLANNABLE_STATUS = 'du_kien';

export type ApplyMode = 'fill-empty' | 'overwrite';

export interface TemplateLesson {
  tieuDe: string | null;
  mucTieu: string | null;
  kienThucMoi: string | null;
  giaoBTVN: string | null;
  sachDangHoc: string | null;
  ghiChu: string | null;
  nguonRef: string | null;
}

export interface TemplateSummary {
  id: number;
  tenKhung: string;
  capDo: string | null;
  tuyen: string | null;
  trangThai: string;
  soBai: number;
}

export interface TemplateDetail {
  id: number;
  tenKhung: string;
  capDo: string | null;
  tuyen: string | null;
  moTa: string | null;
  trangThai: string;
  baiHoc: TemplateLesson[];
}

export interface SaveTemplateInput {
  id?: number;
  tenKhung: string;
  capDo: string;
  tuyen?: string | null;
  moTa?: string | null;
  trangThai?: string;
  baiHoc: TemplateLesson[];
}

export type TemplateListResult =
  | { ok: true; templates: TemplateSummary[] }
  | { ok: false; error: ErrorCode; message: string };

export type TemplateDetailResult =
  | { ok: true; template: TemplateDetail }
  | { ok: false; error: ErrorCode; message: string };

export type SaveTemplateResult =
  | { ok: true; id: number }
  | { ok: false; error: ErrorCode; message: string };

export type SimpleTemplateResult =
  | { ok: true }
  | { ok: false; error: ErrorCode; message: string };

type ErrorCode = 'forbidden' | 'invalid_input' | 'not_found' | 'server';

function isStaff(actor: User | null): actor is User {
  return !!actor && (actor as { collection?: string }).collection === 'users';
}

function hasAnyRole(actor: User | null, roles: readonly string[]): actor is User {
  if (!isStaff(actor)) return false;
  return rolesOf(actor as Parameters<typeof rolesOf>[0]).some((r) => roles.includes(r));
}

const isCurriculumManager = (actor: User | null): actor is User =>
  hasAnyRole(actor, CURRICULUM_MANAGER_ROLES as readonly string[]);

const isPlanner = (actor: User | null): actor is User =>
  hasAnyRole(actor, SESSION_PLANNER_ROLES as readonly string[]);

function strOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

function lessonOf(row: Record<string, unknown>): TemplateLesson {
  return {
    tieuDe: strOrNull(row.tieuDe),
    mucTieu: strOrNull(row.mucTieu),
    kienThucMoi: strOrNull(row.kienThucMoi),
    giaoBTVN: strOrNull(row.giaoBTVN),
    sachDangHoc: strOrNull(row.sachDangHoc),
    ghiChu: strOrNull(row.ghiChu),
    nguonRef: strOrNull(row.nguonRef),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) CRUD — đọc (mọi staff) · ghi (admin/manager)
// ─────────────────────────────────────────────────────────────────────────────

/** Liệt kê khung (tóm tắt). `onlyActive` để lọc khung "Đang dùng" cho dropdown áp. */
export async function listTemplates(
  payload: Payload,
  actor: User | null,
  opts?: { onlyActive?: boolean },
): Promise<TemplateListResult> {
  if (!isStaff(actor)) {
    return { ok: false, error: 'forbidden', message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.' };
  }
  try {
    const { docs } = await payload.find({
      collection: 'curriculum-templates',
      where: opts?.onlyActive ? { trangThai: { equals: 'dang_dung' } } : {},
      user: actor,
      overrideAccess: false,
      disableErrors: true,
      depth: 0,
      pagination: false,
      limit: 0,
      sort: ['capDo', 'tenKhung'],
    });
    const templates: TemplateSummary[] = (docs as unknown as Array<Record<string, unknown>>).map((d) => ({
      id: d.id as number,
      tenKhung: strOrNull(d.tenKhung) ?? `Khung #${d.id}`,
      capDo: strOrNull(d.capDo),
      tuyen: strOrNull(d.tuyen),
      trangThai: String(d.trangThai ?? 'dang_dung'),
      soBai: Array.isArray(d.baiHoc) ? d.baiHoc.length : 0,
    }));
    return { ok: true, templates };
  } catch (err) {
    console.error('[listTemplates] lỗi:', err);
    return { ok: false, error: 'server', message: 'Không tải được danh sách khung lộ trình.' };
  }
}

/** Đọc chi tiết 1 khung (gồm danh sách bài theo thứ tự). */
export async function loadTemplate(
  payload: Payload,
  actor: User | null,
  id: number,
): Promise<TemplateDetailResult> {
  if (!isStaff(actor)) {
    return { ok: false, error: 'forbidden', message: 'Bạn cần đăng nhập bằng tài khoản nhân viên.' };
  }
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: 'invalid_input', message: 'Khung không hợp lệ.' };
  }
  try {
    const doc = await payload.findByID({
      collection: 'curriculum-templates',
      id,
      depth: 0,
      user: actor,
      overrideAccess: false,
      disableErrors: true,
    });
    if (!doc) return { ok: false, error: 'not_found', message: 'Không tìm thấy khung lộ trình.' };
    const d = doc as unknown as Record<string, unknown>;
    const baiHoc = Array.isArray(d.baiHoc)
      ? (d.baiHoc as Array<Record<string, unknown>>).map(lessonOf)
      : [];
    return {
      ok: true,
      template: {
        id: d.id as number,
        tenKhung: strOrNull(d.tenKhung) ?? `Khung #${d.id}`,
        capDo: strOrNull(d.capDo),
        tuyen: strOrNull(d.tuyen),
        moTa: strOrNull(d.moTa),
        trangThai: String(d.trangThai ?? 'dang_dung'),
        baiHoc,
      },
    };
  } catch (err) {
    console.error('[loadTemplate] lỗi:', err);
    return { ok: false, error: 'server', message: 'Không tải được khung lộ trình.' };
  }
}

/** Tạo mới hoặc cập nhật (kèm sắp xếp lại bài) một khung. Chỉ admin/manager. */
export async function saveTemplate(
  payload: Payload,
  actor: User | null,
  input: SaveTemplateInput,
): Promise<SaveTemplateResult> {
  if (!isCurriculumManager(actor)) {
    return { ok: false, error: 'forbidden', message: 'Chỉ quản lý hoặc admin mới được biên soạn khung lộ trình.' };
  }
  const tenKhung = strOrNull(input.tenKhung);
  if (!tenKhung) {
    return { ok: false, error: 'invalid_input', message: 'Tên khung không được để trống.' };
  }
  if (!(levelOrder as readonly string[]).includes(input.capDo)) {
    return { ok: false, error: 'invalid_input', message: 'Cấp độ không hợp lệ.' };
  }
  const tuyen = strOrNull(input.tuyen);
  if (tuyen && !(trackOrder as readonly string[]).includes(tuyen)) {
    return { ok: false, error: 'invalid_input', message: 'Tuyến không hợp lệ.' };
  }
  const trangThai = input.trangThai === 'luu_tru' ? 'luu_tru' : 'dang_dung';

  // Chuẩn hóa bài: chỉ giữ field hợp lệ, bỏ ô trống về null. Thứ tự = thứ tự mảng.
  const baiHoc = (input.baiHoc ?? []).map((l) => ({
    tieuDe: strOrNull(l.tieuDe),
    mucTieu: strOrNull(l.mucTieu),
    kienThucMoi: strOrNull(l.kienThucMoi),
    giaoBTVN: strOrNull(l.giaoBTVN),
    sachDangHoc: strOrNull(l.sachDangHoc),
    ghiChu: strOrNull(l.ghiChu),
    nguonRef: strOrNull(l.nguonRef),
  }));

  const data = {
    tenKhung,
    capDo: input.capDo as ChessLevel,
    tuyen: (tuyen as TrackName | null) ?? null,
    moTa: strOrNull(input.moTa),
    trangThai,
    baiHoc,
  };

  try {
    if (input.id && Number.isInteger(input.id) && input.id > 0) {
      const updated = await payload.update({
        collection: 'curriculum-templates',
        id: input.id,
        data: data as never,
        user: actor,
        overrideAccess: false,
      });
      return { ok: true, id: (updated as { id: number }).id };
    }
    const created = await payload.create({
      collection: 'curriculum-templates',
      data: data as never,
      user: actor,
      overrideAccess: false,
    });
    return { ok: true, id: (created as { id: number }).id };
  } catch (err) {
    console.error('[saveTemplate] lỗi:', err);
    return { ok: false, error: 'server', message: 'Không lưu được khung lộ trình.' };
  }
}

/** Xóa một khung. Chỉ admin/manager. */
export async function deleteTemplate(
  payload: Payload,
  actor: User | null,
  id: number,
): Promise<SimpleTemplateResult> {
  if (!isCurriculumManager(actor)) {
    return { ok: false, error: 'forbidden', message: 'Chỉ quản lý hoặc admin mới được xóa khung lộ trình.' };
  }
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: 'invalid_input', message: 'Khung không hợp lệ.' };
  }
  try {
    await payload.delete({
      collection: 'curriculum-templates',
      id,
      user: actor,
      overrideAccess: false,
    });
    return { ok: true };
  } catch (err) {
    console.error('[deleteTemplate] lỗi:', err);
    return { ok: false, error: 'server', message: 'Không xóa được khung lộ trình.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) ÁP KHUNG — map bài thứ N ↔ buổi du_kien thứ N (theo ngày) rồi điền nội dung
// ─────────────────────────────────────────────────────────────────────────────

export type FieldAction = 'fill' | 'skip' | 'overwrite' | 'empty-source';

export interface ApplyPreviewRow {
  sessionId: number;
  date: string | null;
  /** Vị trí bài trong khung (1-based) đã map vào buổi này. */
  lessonIndex: number;
  lessonTitle: string | null;
  actions: Record<ApplyField, FieldAction>;
}

export interface ApplyInput {
  lopId: number;
  from: string;
  to: string;
  templateId: number;
  /** Bắt đầu từ bài thứ mấy (1-based, mặc định 1) — áp tiếp giữa lộ trình. */
  startIndex?: number;
  mode: ApplyMode;
}

export type ApplyPreviewResult =
  | {
      ok: true;
      classTitle: string;
      templateName: string;
      rows: ApplyPreviewRow[];
      sessionsMapped: number;
      lessonsTotal: number;
      toFill: number;
      toOverwrite: number;
      note: string | null;
    }
  | { ok: false; error: ErrorCode; message: string };

export type ApplyCommitResult =
  | {
      ok: true;
      classTitle: string;
      templateName: string;
      sessionsAffected: number;
      fieldsFilled: number;
      fieldsOverwritten: number;
    }
  | { ok: false; error: ErrorCode; message: string };

interface ComputedRow {
  row: ApplyPreviewRow;
  /** Patch cần ghi vào buổi (đã theo mode). Rỗng = không ghi. */
  patch: SessionContentPatch;
}

/** Tính kế hoạch áp (THUẦN): map buổi du_kien (sắp theo ngày) ↔ bài + action mỗi ô. */
function computeApplyPlan(
  sessions: PlannedSessionRow[],
  lessons: TemplateLesson[],
  startIndex: number,
  mode: ApplyMode,
): ComputedRow[] {
  const duKien = sessions.filter((s) => s.trangThai === PLANNABLE_STATUS);
  const out: ComputedRow[] = [];
  for (let i = 0; i < duKien.length; i += 1) {
    const lessonIdx0 = startIndex - 1 + i;
    const lesson = lessons[lessonIdx0];
    if (!lesson) break; // hết bài → dừng map
    const session = duKien[i];
    const actions = {} as Record<ApplyField, FieldAction>;
    const patch: SessionContentPatch = {};
    for (const f of APPLY_FIELDS) {
      const source = lesson[f];
      const current = session.content[f];
      if (!source) {
        actions[f] = 'empty-source';
        continue;
      }
      if (!current) {
        actions[f] = 'fill';
        patch[f] = source;
      } else if (mode === 'overwrite') {
        actions[f] = 'overwrite';
        patch[f] = source;
      } else {
        actions[f] = 'skip';
      }
    }
    out.push({
      row: {
        sessionId: session.sessionId,
        date: session.date,
        lessonIndex: lessonIdx0 + 1,
        lessonTitle: lesson.tieuDe,
        actions,
      },
      patch,
    });
  }
  return out;
}

function normalizeStartIndex(v: number | undefined): number {
  return Number.isInteger(v) && (v as number) >= 1 ? (v as number) : 1;
}

/** Nạp buổi (branch-scoped) + khung rồi tính kế hoạch áp. Dùng chung preview/commit. */
async function prepareApply(
  payload: Payload,
  actor: User,
  input: ApplyInput,
): Promise<
  | { ok: true; classTitle: string; templateName: string; lessonsTotal: number; computed: ComputedRow[]; sessionsTotal: number }
  | { ok: false; error: ErrorCode; message: string }
> {
  const tpl = await loadTemplate(payload, actor, input.templateId);
  if (!tpl.ok) return tpl;

  const list = await loadPlannedSessions(payload, actor, {
    lopId: input.lopId,
    from: input.from,
    to: input.to,
  });
  if (!list.ok) return list;

  // Nhãn lớp cho nhật ký/UI (branch-scoped — null nếu ngoài cơ sở, nhưng khi đó
  // loadPlannedSessions cũng rỗng). Không chặn nếu thiếu — fallback `Lớp #id`.
  let classTitle = `Lớp #${input.lopId}`;
  const cls = await payload.findByID({
    collection: 'classes',
    id: input.lopId,
    depth: 0,
    user: actor,
    overrideAccess: false,
    disableErrors: true,
  });
  const title = strOrNull((cls as { title?: unknown } | null)?.title);
  if (title) classTitle = title;

  const computed = computeApplyPlan(
    list.rows,
    tpl.template.baiHoc,
    normalizeStartIndex(input.startIndex),
    input.mode,
  );
  return {
    ok: true,
    classTitle,
    templateName: tpl.template.tenKhung,
    lessonsTotal: tpl.template.baiHoc.length,
    computed,
    sessionsTotal: list.rows.filter((s) => s.trangThai === PLANNABLE_STATUS).length,
  };
}

/** Xem trước áp khung (dry-run) — KHÔNG ghi DB. Chỉ admin/manager. */
export async function previewApplyTemplate(
  payload: Payload,
  actor: User | null,
  input: ApplyInput,
): Promise<ApplyPreviewResult> {
  if (!isPlanner(actor)) {
    return { ok: false, error: 'forbidden', message: 'Chỉ quản lý hoặc admin mới được áp khung lộ trình.' };
  }
  try {
    const prep = await prepareApply(payload, actor, input);
    if (!prep.ok) return prep;

    let toFill = 0;
    let toOverwrite = 0;
    for (const c of prep.computed) {
      for (const f of APPLY_FIELDS) {
        if (c.row.actions[f] === 'fill') toFill += 1;
        else if (c.row.actions[f] === 'overwrite') toOverwrite += 1;
      }
    }
    const note =
      prep.computed.length === 0
        ? 'Không có buổi dự kiến nào trong khoảng (hoặc khung chưa có bài). Hãy sinh buổi dự kiến trước.'
        : null;
    return {
      ok: true,
      classTitle: prep.classTitle,
      templateName: prep.templateName,
      rows: prep.computed.map((c) => c.row),
      sessionsMapped: prep.computed.length,
      lessonsTotal: prep.lessonsTotal,
      toFill,
      toOverwrite,
      note,
    };
  } catch (err) {
    console.error('[previewApplyTemplate] lỗi:', err);
    return { ok: false, error: 'server', message: 'Không xem trước được áp khung.' };
  }
}

/** Áp khung THẬT — ghi nội dung buổi qua updateSessionContent (branch-scope + audit). */
export async function applyCurriculumTemplate(
  payload: Payload,
  actor: User | null,
  input: ApplyInput,
): Promise<ApplyCommitResult> {
  if (!isPlanner(actor)) {
    return { ok: false, error: 'forbidden', message: 'Chỉ quản lý hoặc admin mới được áp khung lộ trình.' };
  }
  try {
    const prep = await prepareApply(payload, actor, input);
    if (!prep.ok) return prep;

    let sessionsAffected = 0;
    let fieldsFilled = 0;
    let fieldsOverwritten = 0;
    for (const c of prep.computed) {
      if (Object.keys(c.patch).length === 0) continue;
      const res = await updateSessionContent(payload, actor, c.row.sessionId, c.patch);
      if (!res.ok) continue; // best-effort per buổi (vd ngoài cơ sở) — bỏ qua, không chặn cả mẻ
      sessionsAffected += 1;
      for (const f of APPLY_FIELDS) {
        if (c.row.actions[f] === 'fill') fieldsFilled += 1;
        else if (c.row.actions[f] === 'overwrite') fieldsOverwritten += 1;
      }
    }

    await writeApplyLog(payload, actor.id, {
      classTitle: prep.classTitle,
      templateName: prep.templateName,
      from: input.from,
      to: input.to,
      mode: input.mode,
      sessionsAffected,
      fieldsFilled,
      fieldsOverwritten,
    });

    return {
      ok: true,
      classTitle: prep.classTitle,
      templateName: prep.templateName,
      sessionsAffected,
      fieldsFilled,
      fieldsOverwritten,
    };
  } catch (err) {
    console.error('[applyCurriculumTemplate] lỗi:', err);
    return { ok: false, error: 'server', message: 'Không áp được khung lộ trình.' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) NHẬT KÝ — 1 dòng ImportLog tổng kết mỗi lần áp (best-effort)
// ─────────────────────────────────────────────────────────────────────────────

async function writeApplyLog(
  payload: Payload,
  userId: number,
  summary: {
    classTitle: string;
    templateName: string;
    from: string;
    to: string;
    mode: ApplyMode;
    sessionsAffected: number;
    fieldsFilled: number;
    fieldsOverwritten: number;
  },
): Promise<void> {
  try {
    const modeLabel = summary.mode === 'overwrite' ? 'ghi đè' : 'điền ô trống';
    await payload.create({
      collection: 'import-logs',
      data: {
        kind: 'curriculum-apply',
        fileName: `${summary.classTitle} · ${summary.templateName} · ${summary.from}→${summary.to}`,
        user: userId,
        rowsTotal: summary.sessionsAffected,
        rowsCreated: summary.fieldsFilled,
        rowsUpdated: summary.fieldsOverwritten,
        rowsSkipped: 0,
        rowsErrors: 0,
        notes: `Áp khung "${summary.templateName}" (${modeLabel}): ${summary.sessionsAffected} buổi, điền ${summary.fieldsFilled} ô, ghi đè ${summary.fieldsOverwritten} ô.`,
      } as never,
      overrideAccess: true,
    });
  } catch (err) {
    console.error('[writeApplyLog] lỗi:', err);
  }
}
