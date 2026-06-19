'use client';

import { Button } from '@payloadcms/ui';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type {
  AttendanceStatus,
  StudentFeedbackEntry,
  StudentFeedbackTimeline as TimelineData,
} from '@/lib/operations/session-feedback';
import { updateAttendanceFeedbackAction } from '@/app/actions/sessionFeedback';

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  co_mat: 'Có mặt',
  vang: 'Vắng',
  phep: 'Phép',
};

const STATUS_OPTIONS: AttendanceStatus[] = ['co_mat', 'vang', 'phep'];

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN');
}

interface EditForm {
  status: AttendanceStatus;
  yThuc: string;
  lamBTVN: string;
  nhanXet: string;
  linkLichess: string;
}

function toForm(e: StudentFeedbackEntry): EditForm {
  return {
    status: e.status ?? 'co_mat',
    yThuc: e.yThuc != null ? String(e.yThuc) : '',
    lamBTVN: e.lamBTVN != null ? String(e.lamBTVN) : '',
    nhanXet: e.nhanXet ?? '',
    linkLichess: e.linkLichess ?? '',
  };
}

function ReadField({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div style={{ marginTop: 4 }}>
      <span className="ds-muted">{label}: </span>
      <span style={{ whiteSpace: 'pre-wrap' }}>{value}</span>
    </div>
  );
}

function EntryCard({ entry }: { entry: StudentFeedbackEntry }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm>(() => toForm(entry));
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof EditForm, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const onSave = () => {
    setError(null);
    startSave(async () => {
      const res = await updateAttendanceFeedbackAction(entry.attendanceId, {
        status: form.status,
        yThuc: form.yThuc ? Number(form.yThuc) : null,
        lamBTVN: form.lamBTVN ? Number(form.lamBTVN) : null,
        nhanXet: form.nhanXet || null,
        linkLichess: form.linkLichess || null,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  };

  const onCancel = () => {
    setForm(toForm(entry));
    setError(null);
    setEditing(false);
  };

  const sub = [
    fmtDate(entry.date),
    entry.classTitle ?? (entry.buoi ? `Mã buổi ${entry.buoi}` : null),
    entry.coachName ? `GV: ${entry.coachName}` : null,
    entry.status ? STATUS_LABEL[entry.status] : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className="ds-card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <strong>{sub || 'Buổi học'}</strong>
        {!editing && (
          <button type="button" className="ds-tbl__link" onClick={() => setEditing(true)}>
            Sửa
          </button>
        )}
      </div>

      {!editing ? (
        <>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {entry.yThuc != null && (
              <span className="ds-chip ds-chip--sm">Ý thức: {entry.yThuc}</span>
            )}
            {entry.lamBTVN != null && (
              <span className="ds-chip ds-chip--sm">BTVN: {entry.lamBTVN}</span>
            )}
            {entry.linkLichess && (
              <a className="ds-tbl__link" href={entry.linkLichess} target="_blank" rel="noreferrer">
                Lichess →
              </a>
            )}
          </div>
          {entry.nhanXet ? (
            <div style={{ whiteSpace: 'pre-wrap' }}>
              <span className="ds-muted">Nhận xét: </span>
              {entry.nhanXet}
            </div>
          ) : (
            <div className="ds-muted">Chưa có nhận xét.</div>
          )}
          <ReadField label="Kiến thức mới" value={entry.kienThucMoi} />
          <ReadField label="Giao BTVN" value={entry.giaoBTVN} />
          <ReadField label="Kế hoạch buổi sau" value={entry.khBuoiSau} />
          <ReadField label="Sách đang học" value={entry.sachDangHoc} />
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {error && <p role="alert" className="ds-error" style={{ margin: 0 }}>{error}</p>}
          <div className="ds-formrow">
            <label className="ds-field">
              Trạng thái
              <select className="ds-select" value={form.status} onChange={(e) => set('status', e.target.value)} disabled={saving}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </label>
            <label className="ds-field">
              Ý thức (1–10)
              <input className="ds-input" type="number" min={1} max={10} style={{ width: 80 }} value={form.yThuc} onChange={(e) => set('yThuc', e.target.value)} disabled={saving} />
            </label>
            <label className="ds-field">
              Làm BTVN
              <input className="ds-input" type="number" style={{ width: 80 }} value={form.lamBTVN} onChange={(e) => set('lamBTVN', e.target.value)} disabled={saving} />
            </label>
          </div>
          <label className="ds-field" style={{ display: 'block' }}>
            Nhận xét
            <textarea className="ds-input ds-input--full" rows={2} value={form.nhanXet} onChange={(e) => set('nhanXet', e.target.value)} disabled={saving} />
          </label>
          <label className="ds-field" style={{ display: 'block' }}>
            Link Lichess
            <input className="ds-input ds-input--full" type="text" value={form.linkLichess} onChange={(e) => set('linkLichess', e.target.value)} disabled={saving} />
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button buttonStyle="primary" type="button" disabled={saving} onClick={onSave}>
              {saving ? 'Đang lưu…' : 'Lưu'}
            </Button>
            <Button buttonStyle="secondary" type="button" disabled={saving} onClick={onCancel}>
              Hủy
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

export function StudentFeedbackTimeline({ data }: { data: TimelineData }) {
  const withFeedback = data.entries.filter((e) => e.nhanXet || e.yThuc != null || e.lamBTVN != null).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header className="ds-pghead">
        <div>
          <h1 className="ds-pghead__h1">{data.studentName}</h1>
          <p className="ds-pghead__sub">
            {data.location ?? '—'} · {data.entries.length} buổi · {withFeedback} buổi có nhận xét ·{' '}
            <a className="ds-tbl__link" href={`/admin/collections/students/${data.studentId}`}>
              Mở hồ sơ học viên
            </a>
          </p>
        </div>
      </header>

      {data.entries.length === 0 ? (
        <p className="ds-muted">Học viên này chưa có buổi học nào.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.entries.map((e) => (
            <EntryCard key={e.attendanceId} entry={e} />
          ))}
        </div>
      )}
    </div>
  );
}

export default StudentFeedbackTimeline;
