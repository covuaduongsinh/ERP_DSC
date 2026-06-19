'use client';

import { Button } from '@payloadcms/ui';
import { useEffect, useState, useTransition } from 'react';
import type {
  TemplateSummary,
  ApplyPreviewRow,
  ApplyMode,
  FieldAction,
} from '@/lib/operations/curriculum-templates';
import { listTemplatesAction, previewApplyTemplateAction, applyTemplateAction } from '@/app/actions/curriculum';

/**
 * Panel "ÁP KHUNG LỘ TRÌNH" trong trang Lập kế hoạch buổi học. Chọn khung → xem
 * trước (dry-run) bảng map bài↔buổi + hành vi từng ô → xác nhận áp. Mặc định
 * `fill-empty` (chỉ điền ô trống); `overwrite` cần tick xác nhận. Chỉ admin/manager.
 */

const APPLY_FIELDS: { key: keyof ApplyPreviewRow['actions']; label: string }[] = [
  { key: 'mucTieu', label: 'Mục tiêu' },
  { key: 'kienThucMoi', label: 'Kiến thức mới' },
  { key: 'giaoBTVN', label: 'Giao BTVN' },
  { key: 'sachDangHoc', label: 'Sách' },
];

const ACTION_LABEL: Record<FieldAction, string> = {
  fill: 'điền',
  overwrite: 'ghi đè',
  skip: 'giữ',
  'empty-source': '—',
};

function actionClass(a: FieldAction): string {
  if (a === 'fill') return 'ds-badge ds-badge--created';
  if (a === 'overwrite') return 'ds-badge ds-badge--skipped';
  return 'ds-muted';
}

function fmtDate(d: string | null): string {
  if (!d) return '—';
  const dt = new Date(`${d}T00:00:00.000Z`);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString('vi-VN');
}

interface PreviewState {
  templateName: string;
  rows: ApplyPreviewRow[];
  sessionsMapped: number;
  lessonsTotal: number;
  toFill: number;
  toOverwrite: number;
  note: string | null;
}

export function ApplyTemplatePanel({
  lopId,
  from,
  to,
  onApplied,
}: {
  lopId: number;
  from: string;
  to: string;
  onApplied: () => Promise<void> | void;
}) {
  const [templates, setTemplates] = useState<TemplateSummary[] | null>(null);
  const [templateId, setTemplateId] = useState<number>(0);
  const [mode, setMode] = useState<ApplyMode>('fill-empty');
  const [startIndex, setStartIndex] = useState<number>(1);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, startBusy] = useTransition();

  useEffect(() => {
    startBusy(async () => {
      const res = await listTemplatesAction({ onlyActive: true });
      if (!res.ok) {
        setTemplates([]);
        return;
      }
      setTemplates(res.templates);
      setTemplateId((prev) => prev || res.templates[0]?.id || 0);
    });
  }, []);

  const onPreview = () => {
    setMsg(null);
    setPreview(null);
    if (!templateId) {
      setMsg({ kind: 'err', text: 'Hãy chọn một khung.' });
      return;
    }
    startBusy(async () => {
      const res = await previewApplyTemplateAction({ lopId, from, to, templateId, startIndex, mode });
      if (!res.ok) {
        setMsg({ kind: 'err', text: res.message });
        return;
      }
      setPreview({
        templateName: res.templateName,
        rows: res.rows,
        sessionsMapped: res.sessionsMapped,
        lessonsTotal: res.lessonsTotal,
        toFill: res.toFill,
        toOverwrite: res.toOverwrite,
        note: res.note,
      });
      if (res.note) setMsg({ kind: 'ok', text: res.note });
    });
  };

  const onApply = () => {
    setMsg(null);
    if (!templateId) return;
    if (mode === 'overwrite' && !confirmOverwrite) {
      setMsg({ kind: 'err', text: 'Chế độ ghi đè sẽ thay nội dung đã có — hãy tick xác nhận trước.' });
      return;
    }
    startBusy(async () => {
      const res = await applyTemplateAction({ lopId, from, to, templateId, startIndex, mode });
      if (!res.ok) {
        setMsg({ kind: 'err', text: res.message });
        return;
      }
      setMsg({
        kind: 'ok',
        text: `Đã áp khung "${res.templateName}": ${res.sessionsAffected} buổi (điền ${res.fieldsFilled} ô, ghi đè ${res.fieldsOverwritten} ô).`,
      });
      setPreview(null);
      setConfirmOverwrite(false);
      await onApplied();
    });
  };

  return (
    <fieldset style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 6, padding: 12 }}>
      <legend style={{ padding: '0 6px', fontWeight: 600 }}>Áp khung lộ trình (điền sẵn nội dung buổi)</legend>

      {templates && templates.length === 0 ? (
        <p className="ds-muted" style={{ margin: 0 }}>
          Chưa có khung lộ trình nào (đang dùng). Tạo khung ở trang <strong>Soạn khung lộ trình</strong>.
        </p>
      ) : (
        <>
          <div className="ds-formrow" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label className="ds-field" style={{ flex: '1 1 240px' }}>
              Khung
              <select className="ds-select" value={templateId} onChange={(e) => setTemplateId(Number(e.target.value))} disabled={busy}>
                {(templates ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.tenKhung}{t.capDo ? ` · ${t.capDo}` : ''} · {t.soBai} bài
                  </option>
                ))}
              </select>
            </label>
            <label className="ds-field" style={{ width: 130 }}>
              Bắt đầu từ bài #
              <input className="ds-input" type="number" min={1} value={startIndex} onChange={(e) => setStartIndex(Math.max(1, Number(e.target.value) || 1))} disabled={busy} />
            </label>
            <label className="ds-field" style={{ width: 180 }}>
              Cách áp
              <select className="ds-select" value={mode} onChange={(e) => { setMode(e.target.value as ApplyMode); setConfirmOverwrite(false); }} disabled={busy}>
                <option value="fill-empty">Chỉ điền ô trống</option>
                <option value="overwrite">Ghi đè nội dung</option>
              </select>
            </label>
            <Button buttonStyle="secondary" type="button" disabled={busy || !templateId} onClick={onPreview}>
              {busy ? 'Đang xử lý…' : 'Xem trước'}
            </Button>
          </div>
          <p className="ds-muted" style={{ margin: '8px 0 0' }}>
            Bài thứ N của khung điền vào buổi <strong>dự kiến</strong> thứ N (theo ngày). “Kế hoạch
            buổi sau” không bị đụng. Áp khung <strong>không</strong> tính học phí.
          </p>
        </>
      )}

      {msg && (
        <p role={msg.kind === 'err' ? 'alert' : undefined} className={msg.kind === 'err' ? 'ds-error' : 'ds-success'} style={{ margin: '8px 0 0' }}>
          {msg.text}
        </p>
      )}

      {preview && preview.rows.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p style={{ margin: '0 0 8px', fontWeight: 600 }}>
            Xem trước “{preview.templateName}”: map <strong>{preview.sessionsMapped}</strong>/{preview.lessonsTotal} bài ·
            sẽ điền <strong>{preview.toFill}</strong> ô, ghi đè <strong>{preview.toOverwrite}</strong> ô.
          </p>
          <div className="ds-tbl-wrap">
            <table className="ds-tbl">
              <thead>
                <tr>
                  <th scope="col">Buổi</th>
                  <th scope="col">Bài</th>
                  {APPLY_FIELDS.map((f) => (
                    <th key={f.key} scope="col">{f.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.sessionId}>
                    <td>{fmtDate(r.date)}</td>
                    <td>Bài {r.lessonIndex}{r.lessonTitle ? ` · ${r.lessonTitle}` : ''}</td>
                    {APPLY_FIELDS.map((f) => {
                      const a = r.actions[f.key];
                      return (
                        <td key={f.key}>
                          <span className={actionClass(a)}>{ACTION_LABEL[a]}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {mode === 'overwrite' && (
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 10 }}>
              <input type="checkbox" checked={confirmOverwrite} onChange={(e) => setConfirmOverwrite(e.target.checked)} disabled={busy} />
              Tôi xác nhận ghi đè nội dung đã có ở các buổi trên.
            </label>
          )}

          <div style={{ marginTop: 10 }}>
            <Button
              buttonStyle="primary"
              type="button"
              disabled={busy || (preview.toFill === 0 && preview.toOverwrite === 0) || (mode === 'overwrite' && !confirmOverwrite)}
              onClick={onApply}
            >
              {busy ? 'Đang áp…' : `Xác nhận áp khung (${preview.toFill + preview.toOverwrite} ô)`}
            </Button>
          </div>
        </div>
      )}
    </fieldset>
  );
}

export default ApplyTemplatePanel;
