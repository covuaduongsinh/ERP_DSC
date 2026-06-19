'use client';

import { Button } from '@payloadcms/ui';
import { useEffect, useState, useTransition } from 'react';
import { chessLevelSelectOptions, chessTrackSelectOptions } from '@/lib/roadmap';
import type { TemplateSummary } from '@/lib/operations/curriculum-templates';
import {
  listTemplatesAction,
  loadTemplateAction,
  saveTemplateAction,
  deleteTemplateAction,
} from '@/app/actions/curriculum';

/**
 * Soạn/sửa KHUNG LỘ TRÌNH (V2). Trái: danh sách khung + nút tạo mới. Phải: form
 * biên soạn (metadata + danh sách bài CÓ THỨ TỰ, thêm/xóa/sắp xếp lên-xuống). Lưu
 * cả doc một lần qua `saveTemplateAction` (Payload thay nguyên mảng `baiHoc`).
 */

const LEVEL_OPTIONS = chessLevelSelectOptions();
const TRACK_OPTIONS = chessTrackSelectOptions();
const LEVEL_LABEL: Record<string, string> = Object.fromEntries(LEVEL_OPTIONS.map((o) => [o.value, o.label]));

interface LessonForm {
  tieuDe: string;
  mucTieu: string;
  kienThucMoi: string;
  giaoBTVN: string;
  sachDangHoc: string;
  ghiChu: string;
  nguonRef: string;
}

interface TemplateForm {
  id?: number;
  tenKhung: string;
  capDo: string;
  tuyen: string;
  trangThai: string;
  moTa: string;
  baiHoc: LessonForm[];
}

function emptyLesson(): LessonForm {
  return { tieuDe: '', mucTieu: '', kienThucMoi: '', giaoBTVN: '', sachDangHoc: '', ghiChu: '', nguonRef: '' };
}

function emptyTemplate(): TemplateForm {
  return {
    tenKhung: '',
    capDo: LEVEL_OPTIONS[0]?.value ?? 'tot',
    tuyen: '',
    trangThai: 'dang_dung',
    moTa: '',
    baiHoc: [emptyLesson()],
  };
}

export function CurriculumClient() {
  const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);
  const [form, setForm] = useState<TemplateForm | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, startBusy] = useTransition();

  const reloadList = async () => {
    const res = await listTemplatesAction();
    if (!res.ok) {
      setMsg({ kind: 'err', text: res.message });
      setTemplates([]);
      return;
    }
    setTemplates(res.templates);
  };

  useEffect(() => {
    startBusy(reloadList);
  }, []);

  const openNew = () => {
    setMsg(null);
    setForm(emptyTemplate());
  };

  const openTemplate = (id: number) => {
    setMsg(null);
    startBusy(async () => {
      const res = await loadTemplateAction(id);
      if (!res.ok) {
        setMsg({ kind: 'err', text: res.message });
        return;
      }
      const t = res.template;
      setForm({
        id: t.id,
        tenKhung: t.tenKhung,
        capDo: t.capDo ?? LEVEL_OPTIONS[0]?.value ?? 'tot',
        tuyen: t.tuyen ?? '',
        trangThai: t.trangThai,
        moTa: t.moTa ?? '',
        baiHoc: t.baiHoc.length
          ? t.baiHoc.map((l) => ({
              tieuDe: l.tieuDe ?? '',
              mucTieu: l.mucTieu ?? '',
              kienThucMoi: l.kienThucMoi ?? '',
              giaoBTVN: l.giaoBTVN ?? '',
              sachDangHoc: l.sachDangHoc ?? '',
              ghiChu: l.ghiChu ?? '',
              nguonRef: l.nguonRef ?? '',
            }))
          : [emptyLesson()],
      });
    });
  };

  const setField = <K extends keyof TemplateForm>(key: K, value: TemplateForm[K]) => {
    setForm((p) => (p ? { ...p, [key]: value } : p));
  };

  const setLesson = (idx: number, key: keyof LessonForm, value: string) => {
    setForm((p) => {
      if (!p) return p;
      const baiHoc = p.baiHoc.map((l, i) => (i === idx ? { ...l, [key]: value } : l));
      return { ...p, baiHoc };
    });
  };

  const addLesson = () => setForm((p) => (p ? { ...p, baiHoc: [...p.baiHoc, emptyLesson()] } : p));

  const removeLesson = (idx: number) =>
    setForm((p) => (p ? { ...p, baiHoc: p.baiHoc.filter((_, i) => i !== idx) } : p));

  const moveLesson = (idx: number, dir: -1 | 1) =>
    setForm((p) => {
      if (!p) return p;
      const j = idx + dir;
      if (j < 0 || j >= p.baiHoc.length) return p;
      const baiHoc = [...p.baiHoc];
      [baiHoc[idx], baiHoc[j]] = [baiHoc[j], baiHoc[idx]];
      return { ...p, baiHoc };
    });

  const onSave = () => {
    if (!form) return;
    setMsg(null);
    if (!form.tenKhung.trim()) {
      setMsg({ kind: 'err', text: 'Tên khung không được để trống.' });
      return;
    }
    startBusy(async () => {
      const res = await saveTemplateAction({
        id: form.id,
        tenKhung: form.tenKhung.trim(),
        capDo: form.capDo,
        tuyen: form.tuyen || null,
        moTa: form.moTa || null,
        trangThai: form.trangThai,
        baiHoc: form.baiHoc.map((l) => ({
          tieuDe: l.tieuDe || null,
          mucTieu: l.mucTieu || null,
          kienThucMoi: l.kienThucMoi || null,
          giaoBTVN: l.giaoBTVN || null,
          sachDangHoc: l.sachDangHoc || null,
          ghiChu: l.ghiChu || null,
          nguonRef: l.nguonRef || null,
        })),
      });
      if (!res.ok) {
        setMsg({ kind: 'err', text: res.message });
        return;
      }
      setMsg({ kind: 'ok', text: 'Đã lưu khung lộ trình.' });
      setForm((p) => (p ? { ...p, id: res.id } : p));
      await reloadList();
    });
  };

  const onDelete = () => {
    if (!form?.id) return;
    setMsg(null);
    startBusy(async () => {
      const res = await deleteTemplateAction(form.id as number);
      if (!res.ok) {
        setMsg({ kind: 'err', text: res.message });
        return;
      }
      setMsg({ kind: 'ok', text: 'Đã xóa khung lộ trình.' });
      setForm(null);
      await reloadList();
    });
  };

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      {/* ── Danh sách khung ──────────────────────────────────────────────────── */}
      <div style={{ flex: '1 1 240px', minWidth: 220 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <strong>Khung lộ trình</strong>
          <Button buttonStyle="primary" type="button" disabled={busy} onClick={openNew}>
            + Tạo khung
          </Button>
        </div>
        {templates === null ? (
          <p className="ds-muted">Đang tải…</p>
        ) : templates.length === 0 ? (
          <p className="ds-muted">Chưa có khung nào. Bấm “Tạo khung”.</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {templates.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className="ds-tbl__link"
                  style={{
                    textAlign: 'left',
                    width: '100%',
                    fontWeight: form?.id === t.id ? 700 : 400,
                  }}
                  onClick={() => openTemplate(t.id)}
                  disabled={busy}
                >
                  {t.tenKhung}{' '}
                  <span className="ds-muted">
                    · {t.capDo ? LEVEL_LABEL[t.capDo] ?? t.capDo : '—'} · {t.soBai} bài
                    {t.trangThai === 'luu_tru' ? ' · lưu trữ' : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Form biên soạn ───────────────────────────────────────────────────── */}
      <div style={{ flex: '2 1 480px', minWidth: 320 }}>
        {msg && (
          <p role={msg.kind === 'err' ? 'alert' : undefined} className={msg.kind === 'err' ? 'ds-error' : 'ds-success'}>
            {msg.text}
          </p>
        )}
        {!form ? (
          <p className="ds-muted">Chọn một khung bên trái để sửa, hoặc bấm “Tạo khung”.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <fieldset style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 6, padding: 12 }}>
              <legend style={{ padding: '0 6px', fontWeight: 600 }}>Thông tin khung</legend>
              <label className="ds-field" style={{ display: 'block' }}>
                Tên khung
                <input className="ds-input ds-input--full" type="text" value={form.tenKhung} onChange={(e) => setField('tenKhung', e.target.value)} disabled={busy} />
              </label>
              <div className="ds-formrow" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                <label className="ds-field" style={{ flex: '1 1 140px' }}>
                  Cấp độ
                  <select className="ds-select" value={form.capDo} onChange={(e) => setField('capDo', e.target.value)} disabled={busy}>
                    {LEVEL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <label className="ds-field" style={{ flex: '1 1 140px' }}>
                  Tuyến (tùy chọn)
                  <select className="ds-select" value={form.tuyen} onChange={(e) => setField('tuyen', e.target.value)} disabled={busy}>
                    <option value="">— Không chọn —</option>
                    {TRACK_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </label>
                <label className="ds-field" style={{ flex: '1 1 140px' }}>
                  Trạng thái
                  <select className="ds-select" value={form.trangThai} onChange={(e) => setField('trangThai', e.target.value)} disabled={busy}>
                    <option value="dang_dung">Đang dùng</option>
                    <option value="luu_tru">Lưu trữ</option>
                  </select>
                </label>
              </div>
              <label className="ds-field" style={{ display: 'block', marginTop: 8 }}>
                Mô tả
                <textarea className="ds-input ds-input--full" rows={2} value={form.moTa} onChange={(e) => setField('moTa', e.target.value)} disabled={busy} />
              </label>
            </fieldset>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong>Bài mẫu ({form.baiHoc.length}) — theo thứ tự dạy</strong>
                <Button buttonStyle="secondary" type="button" disabled={busy} onClick={addLesson}>
                  + Thêm bài
                </Button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {form.baiHoc.map((l, idx) => (
                  <fieldset key={idx} style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 6, padding: 10 }}>
                    <legend style={{ padding: '0 6px', fontWeight: 600, display: 'flex', gap: 6, alignItems: 'center' }}>
                      Bài {idx + 1}
                      <span style={{ display: 'inline-flex', gap: 4 }}>
                        <button type="button" className="ds-tbl__link" disabled={busy || idx === 0} onClick={() => moveLesson(idx, -1)} title="Lên">↑</button>
                        <button type="button" className="ds-tbl__link" disabled={busy || idx === form.baiHoc.length - 1} onClick={() => moveLesson(idx, 1)} title="Xuống">↓</button>
                        <button type="button" className="ds-tbl__link" disabled={busy} onClick={() => removeLesson(idx)} title="Xóa">✕</button>
                      </span>
                    </legend>
                    <label className="ds-field" style={{ display: 'block' }}>
                      Tiêu đề bài
                      <input className="ds-input ds-input--full" type="text" value={l.tieuDe} onChange={(e) => setLesson(idx, 'tieuDe', e.target.value)} disabled={busy} />
                    </label>
                    <label className="ds-field" style={{ display: 'block', marginTop: 6 }}>
                      Mục tiêu
                      <textarea className="ds-input ds-input--full" rows={2} value={l.mucTieu} onChange={(e) => setLesson(idx, 'mucTieu', e.target.value)} disabled={busy} />
                    </label>
                    <label className="ds-field" style={{ display: 'block', marginTop: 6 }}>
                      Kiến thức mới
                      <textarea className="ds-input ds-input--full" rows={2} value={l.kienThucMoi} onChange={(e) => setLesson(idx, 'kienThucMoi', e.target.value)} disabled={busy} />
                    </label>
                    <label className="ds-field" style={{ display: 'block', marginTop: 6 }}>
                      Giao BTVN
                      <textarea className="ds-input ds-input--full" rows={2} value={l.giaoBTVN} onChange={(e) => setLesson(idx, 'giaoBTVN', e.target.value)} disabled={busy} />
                    </label>
                    <label className="ds-field" style={{ display: 'block', marginTop: 6 }}>
                      Sách đang học
                      <input className="ds-input ds-input--full" type="text" value={l.sachDangHoc} onChange={(e) => setLesson(idx, 'sachDangHoc', e.target.value)} disabled={busy} />
                    </label>
                    <label className="ds-field" style={{ display: 'block', marginTop: 6 }}>
                      Ghi chú soạn (không áp vào buổi)
                      <textarea className="ds-input ds-input--full" rows={1} value={l.ghiChu} onChange={(e) => setLesson(idx, 'ghiChu', e.target.value)} disabled={busy} />
                    </label>
                  </fieldset>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Button buttonStyle="primary" type="button" disabled={busy} onClick={onSave}>
                {busy ? 'Đang lưu…' : 'Lưu khung'}
              </Button>
              {form.id && (
                <Button buttonStyle="error" type="button" disabled={busy} onClick={onDelete}>
                  Xóa khung
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CurriculumClient;
