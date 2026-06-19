'use client';

import { Button } from '@payloadcms/ui';
import { useCallback, useEffect, useState, useTransition } from 'react';
import type { ClassOption } from '@/lib/operations/roster';
import type { SessionEntryData, SessionEntryRow, SessionStatus } from '@/lib/operations/session-entry';
import {
  fetchSessionEntry,
  saveSessionEntryAction,
  setSessionCancelledAction,
  createMakeupAction,
} from '@/app/actions/buoiHoc';

export interface CoachOption {
  id: number;
  name: string;
}

export interface BuoiHocClientProps {
  classes: ClassOption[];
  coaches: CoachOption[];
}

const STATUS_OPTIONS: { value: SessionStatus; label: string }[] = [
  { value: 'co_mat', label: 'Có mặt' },
  { value: 'vang', label: 'Vắng' },
  { value: 'phep', label: 'Phép' },
];

const TRANG_THAI_LABEL: Record<string, string> = {
  du_kien: 'Dự kiến',
  da_day: 'Đã dạy',
  huy: 'Đã hủy',
  bu: 'Buổi bù',
};

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

interface StudentForm {
  status: SessionStatus;
  yThuc: string;
  lamBTVN: string;
  nhanXet: string;
  linkLichess: string;
}

interface SessionForm {
  coachThucTe: string;
  kienThucMoi: string;
  giaoBTVN: string;
  khBuoiSau: string;
  sachDangHoc: string;
}

const EMPTY_SESSION_FORM: SessionForm = {
  coachThucTe: '',
  kienThucMoi: '',
  giaoBTVN: '',
  khBuoiSau: '',
  sachDangHoc: '',
};

export function BuoiHocClient({ classes, coaches }: BuoiHocClientProps) {
  const [classId, setClassId] = useState<number | ''>('');
  const [date, setDate] = useState<string>(todayInputValue());
  const [session, setSession] = useState<SessionEntryData | null>(null);
  const [rows, setRows] = useState<SessionEntryRow[]>([]);
  const [forms, setForms] = useState<Record<number, StudentForm>>({});
  const [sessionForm, setSessionForm] = useState<SessionForm>(EMPTY_SESSION_FORM);
  const [makeupDate, setMakeupDate] = useState<string>(todayInputValue());

  const [loading, startLoad] = useTransition();
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback((cid: number, d: string) => {
    setError(null);
    setSuccess(null);
    startLoad(async () => {
      const res = await fetchSessionEntry(cid, d);
      if (!res.ok) {
        setError(res.message);
        setSession(null);
        setRows([]);
        return;
      }
      setSession(res.session);
      setRows(res.rows);
      setSessionForm({
        coachThucTe: res.session.coachThucTe != null ? String(res.session.coachThucTe) : '',
        kienThucMoi: res.session.kienThucMoi ?? '',
        giaoBTVN: res.session.giaoBTVN ?? '',
        khBuoiSau: res.session.khBuoiSau ?? '',
        sachDangHoc: res.session.sachDangHoc ?? '',
      });
      const init: Record<number, StudentForm> = {};
      for (const r of res.rows) {
        init[r.studentId] = {
          status: r.status ?? 'co_mat',
          yThuc: r.yThuc != null ? String(r.yThuc) : '',
          lamBTVN: r.lamBTVN != null ? String(r.lamBTVN) : '',
          nhanXet: r.nhanXet ?? '',
          linkLichess: r.linkLichess ?? '',
        };
      }
      setForms(init);
    });
  }, []);

  // Tải lại khi đổi lớp hoặc ngày.
  useEffect(() => {
    if (classId) load(classId as number, date);
    else {
      setSession(null);
      setRows([]);
    }
  }, [classId, date, load]);

  const setField = useCallback((studentId: number, key: keyof StudentForm, value: string) => {
    setForms((prev) => ({ ...prev, [studentId]: { ...prev[studentId], [key]: value } }));
  }, []);

  const onSave = useCallback(() => {
    if (!classId || rows.length === 0) return;
    setError(null);
    setSuccess(null);
    startSubmit(async () => {
      const entries = rows.map((r) => {
        const f = forms[r.studentId];
        return {
          studentId: r.studentId,
          status: f?.status ?? 'co_mat',
          yThuc: f?.yThuc ? Number(f.yThuc) : null,
          lamBTVN: f?.lamBTVN ? Number(f.lamBTVN) : null,
          nhanXet: f?.nhanXet || null,
          linkLichess: f?.linkLichess || null,
        };
      });
      const res = await saveSessionEntryAction({
        classId: classId as number,
        date,
        session: {
          coachThucTe: sessionForm.coachThucTe ? Number(sessionForm.coachThucTe) : null,
          kienThucMoi: sessionForm.kienThucMoi || undefined,
          giaoBTVN: sessionForm.giaoBTVN || undefined,
          khBuoiSau: sessionForm.khBuoiSau || undefined,
          sachDangHoc: sessionForm.sachDangHoc || undefined,
        },
        entries,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setSuccess(`Đã lưu buổi học: ${res.created} mới, ${res.updated} cập nhật (${rows.length} HV).`);
      load(classId as number, date);
    });
  }, [classId, date, forms, rows, sessionForm, load]);

  const onToggleCancel = useCallback(
    (huy: boolean) => {
      if (!classId) return;
      let reason: string | undefined;
      if (huy) {
        const r = window.prompt('Lý do hủy buổi (tùy chọn):', '');
        if (r === null) return; // bấm Cancel
        reason = r || undefined;
      }
      setError(null);
      setSuccess(null);
      startSubmit(async () => {
        const res = await setSessionCancelledAction({ classId: classId as number, date, huy, reason });
        if (!res.ok) {
          setError(res.message);
          return;
        }
        setSuccess(huy ? 'Đã hủy buổi.' : 'Đã mở lại buổi.');
        load(classId as number, date);
      });
    },
    [classId, date, load],
  );

  const onMakeup = useCallback(() => {
    if (!classId || !session) return;
    setError(null);
    setSuccess(null);
    startSubmit(async () => {
      const res = await createMakeupAction({
        classId: classId as number,
        originalSessionId: session.sessionId,
        date: makeupDate,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setSuccess(`Đã tạo buổi bù ngày ${makeupDate}. Chọn ngày đó để nhập nội dung buổi bù.`);
    });
  }, [classId, session, makeupDate]);

  const busy = loading || submitting;
  const isCancelled = session?.trangThai === 'huy';

  return (
    <div>
      {success ? <p aria-live="polite" className="ds-success">{success}</p> : null}
      {error ? <p role="alert" className="ds-error">{error}</p> : null}

      <div className="ds-formrow">
        <label className="ds-field">
          Lớp
          <select
            className="ds-select"
            value={classId}
            onChange={(e) => setClassId(e.target.value ? Number(e.target.value) : '')}
            disabled={busy}
          >
            <option value="">— Chọn lớp —</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
                {c.location ? ` (${c.location})` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="ds-field">
          Ngày học
          <input className="ds-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} />
        </label>
        {session ? (
          <span className="ds-field" style={{ alignSelf: 'flex-end' }}>
            Trạng thái: <strong>{TRANG_THAI_LABEL[session.trangThai] ?? session.trangThai}</strong>
          </span>
        ) : null}
      </div>

      {loading ? <p className="ds-muted">Đang tải buổi học…</p> : null}

      {!loading && classId && rows.length === 0 ? (
        <p className="ds-muted">Lớp này chưa có học viên đang học (hoặc ngoài phạm vi cơ sở của bạn).</p>
      ) : null}

      {session && rows.length > 0 ? (
        <>
          {isCancelled ? (
            <p className="ds-error">Buổi này đã HỦY — không nên ghi “có mặt”. Mở lại nếu cần nhập điểm danh.</p>
          ) : null}

          {/* Nội dung buổi (cấp lớp) */}
          <fieldset style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 6, padding: 12, marginBottom: 16 }}>
            <legend style={{ padding: '0 6px', fontWeight: 600 }}>Nội dung buổi (cả lớp)</legend>
            <div className="ds-formrow">
              <label className="ds-field">
                GV thực dạy
                <select
                  className="ds-select"
                  value={sessionForm.coachThucTe}
                  onChange={(e) => setSessionForm((p) => ({ ...p, coachThucTe: e.target.value }))}
                  disabled={busy}
                >
                  <option value="">— Mặc định (GV của lớp) —</option>
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="ds-field">
                Sách đang học
                <input className="ds-input" type="text" value={sessionForm.sachDangHoc} onChange={(e) => setSessionForm((p) => ({ ...p, sachDangHoc: e.target.value }))} disabled={busy} />
              </label>
            </div>
            <label className="ds-field" style={{ display: 'block', marginTop: 8 }}>
              Kiến thức mới
              <textarea className="ds-input ds-input--full" rows={2} value={sessionForm.kienThucMoi} onChange={(e) => setSessionForm((p) => ({ ...p, kienThucMoi: e.target.value }))} disabled={busy} />
            </label>
            <label className="ds-field" style={{ display: 'block', marginTop: 8 }}>
              Giao BTVN
              <textarea className="ds-input ds-input--full" rows={2} value={sessionForm.giaoBTVN} onChange={(e) => setSessionForm((p) => ({ ...p, giaoBTVN: e.target.value }))} disabled={busy} />
            </label>
            <label className="ds-field" style={{ display: 'block', marginTop: 8 }}>
              Kế hoạch buổi sau
              <textarea className="ds-input ds-input--full" rows={2} value={sessionForm.khBuoiSau} onChange={(e) => setSessionForm((p) => ({ ...p, khBuoiSau: e.target.value }))} disabled={busy} />
            </label>
          </fieldset>

          {/* Điểm danh + nhận xét từng HV */}
          <div className="ds-tbl-wrap">
            <table className="ds-tbl">
              <thead>
                <tr>
                  <th scope="col">Học viên</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Ý thức (1–10)</th>
                  <th scope="col">Làm BTVN</th>
                  <th scope="col">Nhận xét</th>
                  <th scope="col">Link Lichess</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const f = forms[r.studentId];
                  return (
                    <tr key={r.studentId}>
                      <td>
                        {r.fullName}
                        {typeof r.sessionsRemaining === 'number' ? (
                          <div className="ds-cellsub">Còn {r.sessionsRemaining} buổi</div>
                        ) : null}
                      </td>
                      <td>
                        <div className="ds-radiorow">
                          {STATUS_OPTIONS.map((opt) => (
                            <label key={opt.value} className="ds-radio">
                              <input
                                type="radio"
                                name={`status-${r.studentId}`}
                                checked={(f?.status ?? 'co_mat') === opt.value}
                                onChange={() => setField(r.studentId, 'status', opt.value)}
                                disabled={busy}
                              />
                              {opt.label}
                            </label>
                          ))}
                        </div>
                      </td>
                      <td>
                        <input className="ds-input" type="number" min={1} max={10} style={{ width: 70 }} value={f?.yThuc ?? ''} onChange={(e) => setField(r.studentId, 'yThuc', e.target.value)} disabled={busy} />
                      </td>
                      <td>
                        <input className="ds-input" type="number" style={{ width: 70 }} value={f?.lamBTVN ?? ''} onChange={(e) => setField(r.studentId, 'lamBTVN', e.target.value)} disabled={busy} />
                      </td>
                      <td>
                        <input className="ds-input ds-input--full" type="text" value={f?.nhanXet ?? ''} onChange={(e) => setField(r.studentId, 'nhanXet', e.target.value)} disabled={busy} />
                      </td>
                      <td>
                        <input className="ds-input" type="text" style={{ width: 160 }} value={f?.linkLichess ?? ''} onChange={(e) => setField(r.studentId, 'linkLichess', e.target.value)} disabled={busy} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button buttonStyle="primary" type="button" disabled={busy} onClick={onSave}>
              {submitting ? 'Đang lưu…' : `Lưu buổi (${rows.length} HV)`}
            </Button>
            {isCancelled ? (
              <Button buttonStyle="secondary" type="button" disabled={busy} onClick={() => onToggleCancel(false)}>
                Mở lại buổi
              </Button>
            ) : (
              <Button buttonStyle="secondary" type="button" disabled={busy} onClick={() => onToggleCancel(true)}>
                Hủy buổi
              </Button>
            )}
          </div>

          {isCancelled ? (
            <div className="ds-formrow" style={{ marginTop: 12, alignItems: 'flex-end' }}>
              <label className="ds-field">
                Ngày dạy bù
                <input className="ds-input" type="date" value={makeupDate} onChange={(e) => setMakeupDate(e.target.value)} disabled={busy} />
              </label>
              <Button buttonStyle="secondary" type="button" disabled={busy} onClick={onMakeup}>
                Tạo buổi bù
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
