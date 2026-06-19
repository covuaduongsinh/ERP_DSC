import type { Payload } from 'payload';
import { describe, it, expect, vi } from 'vitest';

import type { User } from '@/payload-types';
import {
  listTemplates,
  saveTemplate,
  deleteTemplate,
  previewApplyTemplate,
  applyCurriculumTemplate,
  type TemplateLesson,
} from '@/lib/operations/curriculum-templates';

// ─── Actors ───────────────────────────────────────────────────────────────────
const admin = { id: 1, collection: 'users', role: 'admin' } as unknown as User;
const manager = { id: 2, collection: 'users', role: 'manager' } as unknown as User;
const coach = { id: 3, collection: 'users', role: 'coach' } as unknown as User;
const anon = null;

const LOP = 5001;
const FROM = '2026-06-01';
const TO = '2026-06-30';

function lesson(p: Partial<TemplateLesson>): TemplateLesson {
  return {
    tieuDe: null,
    mucTieu: null,
    kienThucMoi: null,
    giaoBTVN: null,
    sachDangHoc: null,
    ghiChu: null,
    nguonRef: null,
    ...p,
  };
}

// Khung mẫu: 3 bài. Bài 2 thiếu giaoBTVN/sach (⇒ empty-source).
const TEMPLATE = {
  id: 1,
  tenKhung: 'Lộ trình Tốt',
  capDo: 'tot',
  tuyen: 'nhap_mon',
  moTa: null,
  trangThai: 'dang_dung',
  baiHoc: [
    { tieuDe: 'B1', mucTieu: 'MT1', kienThucMoi: 'KT1', giaoBTVN: 'BT1', sachDangHoc: 'S1', ghiChu: 'note', nguonRef: null },
    { tieuDe: 'B2', mucTieu: 'MT2', kienThucMoi: 'KT2', giaoBTVN: null, sachDangHoc: null, ghiChu: null, nguonRef: null },
    { tieuDe: 'B3', mucTieu: 'MT3', kienThucMoi: 'KT3', giaoBTVN: 'BT3', sachDangHoc: 'S3', ghiChu: null, nguonRef: null },
  ],
};

/** 3 buổi du_kien (theo ngày). Buổi 2 có sẵn `kienThucMoi` ⇒ test skip/overwrite. */
function seedSessions(): Array<Record<string, unknown>> {
  return [
    { id: 71, lop: LOP, date: '2026-06-03T00:00:00.000Z', trangThai: 'du_kien', mucTieu: null, kienThucMoi: null, giaoBTVN: null, khBuoiSau: null, sachDangHoc: null },
    { id: 72, lop: LOP, date: '2026-06-10T00:00:00.000Z', trangThai: 'du_kien', mucTieu: null, kienThucMoi: 'KT cũ', giaoBTVN: null, khBuoiSau: null, sachDangHoc: null },
    { id: 73, lop: LOP, date: '2026-06-17T00:00:00.000Z', trangThai: 'du_kien', mucTieu: null, kienThucMoi: null, giaoBTVN: null, khBuoiSau: null, sachDangHoc: null },
  ];
}

/** Fake payload phủ: curriculum-templates, class-sessions, classes, import-logs.
 *  Đếm thao tác attendance + cập nhật buổi để chứng minh ranh giới học phí 🔒. */
function makeFake(opts?: { withTemplate?: boolean }) {
  const sessions = seedSessions();
  const templates = new Map<number, Record<string, unknown>>();
  if (opts?.withTemplate !== false) templates.set(1, structuredClone(TEMPLATE));
  let nextId = 100;
  const attendanceOps = { create: 0, update: 0, delete: 0 };
  const importLogs: Array<Record<string, unknown>> = [];
  const sessionUpdates: Array<{ id: number; data: Record<string, unknown> }> = [];

  const find = vi.fn(async ({ collection, where }: { collection: string; where?: Record<string, unknown> }) => {
    if (collection === 'class-sessions') {
      const docs = sessions
        .filter((s) => s.lop === LOP)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
      return { docs, totalDocs: docs.length };
    }
    if (collection === 'curriculum-templates') {
      const onlyActive = (where as { trangThai?: { equals?: string } })?.trangThai?.equals;
      let docs = Array.from(templates.values());
      if (onlyActive) docs = docs.filter((t) => t.trangThai === onlyActive);
      return { docs, totalDocs: docs.length };
    }
    return { docs: [], totalDocs: 0 };
  });

  const findByID = vi.fn(async ({ collection, id }: { collection: string; id: number }) => {
    if (collection === 'curriculum-templates') return templates.get(id) ?? null;
    if (collection === 'classes') return id === LOP ? { id: LOP, title: 'Lớp Test' } : null;
    if (collection === 'class-sessions') return sessions.find((s) => s.id === id) ?? null;
    return null;
  });

  const create = vi.fn(async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
    if (collection === 'attendance') {
      attendanceOps.create += 1;
      return { id: nextId++, ...data };
    }
    if (collection === 'import-logs') {
      const doc = { id: nextId++, ...data };
      importLogs.push(doc);
      return doc;
    }
    if (collection === 'curriculum-templates') {
      const id = nextId++;
      const doc = { id, ...data };
      templates.set(id, doc);
      return doc;
    }
    return { id: nextId++, ...data };
  });

  const update = vi.fn(async ({ collection, id, data }: { collection: string; id: number; data: Record<string, unknown> }) => {
    if (collection === 'attendance') {
      attendanceOps.update += 1;
      return { id, ...data };
    }
    if (collection === 'class-sessions') {
      const s = sessions.find((x) => x.id === id);
      if (s) Object.assign(s, data);
      sessionUpdates.push({ id, data });
      return s;
    }
    if (collection === 'curriculum-templates') {
      const t = templates.get(id);
      if (t) Object.assign(t, data);
      return t;
    }
    return { id, ...data };
  });

  const del = vi.fn(async ({ collection, id }: { collection: string; id: number }) => {
    if (collection === 'attendance') attendanceOps.delete += 1;
    if (collection === 'curriculum-templates') templates.delete(id);
    return { id };
  });

  return {
    payload: { find, create, findByID, update, delete: del } as unknown as Payload,
    sessions,
    templates,
    attendanceOps,
    importLogs,
    sessionUpdates,
  };
}

const applyInput = (over?: Record<string, unknown>) => ({
  lopId: LOP,
  from: FROM,
  to: TO,
  templateId: 1,
  mode: 'fill-empty' as const,
  ...over,
});

// ════════════════════════════════════════════════════════════════════════════════
describe('CRUD khung — đọc=staff, ghi=admin/manager', () => {
  it('listTemplates: staff (coach) đọc được; non-staff forbidden', async () => {
    const { payload } = makeFake();
    const ok = await listTemplates(payload, coach);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.templates).toHaveLength(1);
    expect((await listTemplates(payload, anon)).ok).toBe(false);
  });

  it('saveTemplate: coach bị chặn (forbidden); manager lưu được', async () => {
    const { payload, templates } = makeFake({ withTemplate: false });
    const denied = await saveTemplate(payload, coach, {
      tenKhung: 'X', capDo: 'tot', baiHoc: [lesson({ tieuDe: 'a' })],
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error).toBe('forbidden');

    const okRes = await saveTemplate(payload, manager, {
      tenKhung: 'Khung mới', capDo: 'ma', tuyen: 'co_ban', baiHoc: [lesson({ tieuDe: 'a', mucTieu: 'm' })],
    });
    expect(okRes.ok).toBe(true);
    if (okRes.ok) expect(templates.get(okRes.id)?.tenKhung).toBe('Khung mới');
  });

  it('saveTemplate: capDo không hợp lệ ⇒ invalid_input', async () => {
    const { payload } = makeFake();
    const res = await saveTemplate(payload, admin, { tenKhung: 'X', capDo: 'sai', baiHoc: [] });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('invalid_input');
  });

  it('deleteTemplate: coach forbidden; manager xóa được', async () => {
    const { payload, templates } = makeFake();
    expect((await deleteTemplate(payload, coach, 1)).ok).toBe(false);
    expect((await deleteTemplate(payload, manager, 1)).ok).toBe(true);
    expect(templates.has(1)).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
describe('previewApplyTemplate — phân loại điền/giữ/ghi đè/nguồn trống', () => {
  it('fill-empty: phân loại đúng theo trạng thái ô buổi', async () => {
    const { payload } = makeFake();
    const res = await previewApplyTemplate(payload, manager, applyInput());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.sessionsMapped).toBe(3);
    expect(res.lessonsTotal).toBe(3);

    const r1 = res.rows[0]; // buổi 71 (trống) ↔ bài1: điền cả 4
    expect(r1.actions).toEqual({ mucTieu: 'fill', kienThucMoi: 'fill', giaoBTVN: 'fill', sachDangHoc: 'fill' });
    const r2 = res.rows[1]; // buổi 72 (kienThucMoi='KT cũ') ↔ bài2 (thiếu BTVN/sách)
    expect(r2.actions).toEqual({ mucTieu: 'fill', kienThucMoi: 'skip', giaoBTVN: 'empty-source', sachDangHoc: 'empty-source' });

    expect(res.toFill).toBe(9); // 4 + 1 + 4
    expect(res.toOverwrite).toBe(0);
  });

  it('coach (không phải planner) ⇒ forbidden', async () => {
    const { payload } = makeFake();
    expect((await previewApplyTemplate(payload, coach, applyInput())).ok).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
describe('applyCurriculumTemplate — ghi nội dung + ranh giới học phí 🔒', () => {
  it('fill-empty: chỉ điền ô trống; idempotent (chạy lại không đổi); KHÔNG đụng attendance', async () => {
    const { payload, sessions, attendanceOps, importLogs } = makeFake();
    const res = await applyCurriculumTemplate(payload, manager, applyInput());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.sessionsAffected).toBe(3);
    expect(res.fieldsFilled).toBe(9);
    expect(res.fieldsOverwritten).toBe(0);

    // Buổi 1 điền đủ; buổi 2 GIỮ kienThucMoi cũ (không ghi đè).
    expect(sessions[0].mucTieu).toBe('MT1');
    expect(sessions[0].kienThucMoi).toBe('KT1');
    expect(sessions[1].kienThucMoi).toBe('KT cũ'); // skip
    expect(sessions[1].mucTieu).toBe('MT2'); // fill
    // Trạng thái buổi KHÔNG đổi (vẫn du_kien) + KHÔNG đụng attendance/khBuoiSau.
    expect(sessions.every((s) => s.trangThai === 'du_kien')).toBe(true);
    expect(sessions.every((s) => s.khBuoiSau === null)).toBe(true);
    expect(attendanceOps).toEqual({ create: 0, update: 0, delete: 0 });
    expect(importLogs).toHaveLength(1);
    expect(importLogs[0].kind).toBe('curriculum-apply');

    // Chạy lại fill-empty ⇒ không còn ô để điền.
    const again = await applyCurriculumTemplate(payload, manager, applyInput());
    if (!again.ok) throw new Error('rerun fail');
    expect(again.fieldsFilled).toBe(0);
    expect(again.fieldsOverwritten).toBe(0);
  });

  it('overwrite: ghi đè nội dung đã có', async () => {
    const { payload, sessions } = makeFake();
    const res = await applyCurriculumTemplate(payload, manager, applyInput({ mode: 'overwrite' }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.fieldsOverwritten).toBe(1); // buổi 2 kienThucMoi: KT cũ → KT2
    expect(sessions[1].kienThucMoi).toBe('KT2');
  });

  it('startIndex offset: bắt đầu từ bài #2 ⇒ map ít buổi hơn (hết bài thì dừng)', async () => {
    const { payload } = makeFake();
    const res = await previewApplyTemplate(payload, manager, applyInput({ startIndex: 2 }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.sessionsMapped).toBe(2); // buổi1↔bài2, buổi2↔bài3, buổi3↔(hết)→dừng
    expect(res.rows[0].lessonIndex).toBe(2);
    expect(res.rows[1].lessonIndex).toBe(3);
  });
});
