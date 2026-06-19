'use client';

import { Button } from '@payloadcms/ui';
import { useRouter } from 'next/navigation';
import { Fragment, useState, useTransition } from 'react';
import type {
  AttendanceStatus,
  SessionFeedbackData,
  SessionFeedbackRow,
} from '@/lib/operations/session-feedback';
import { updateAttendanceFeedbackAction } from '@/app/actions/sessionFeedback';
import { ClassContentEditor } from './ClassContentEditor';

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

// ── Form sửa 1 HV (mở rộng dưới dòng) ─────────────────────────────────────────
interface RowForm {
  status: AttendanceStatus;
  yThuc: string;
  lamBTVN: string;
  nhanXet: string;
  linkLichess: string;
  kienThucMoi: string;
  giaoBTVN: string;
  khBuoiSau: string;
  sachDangHoc: string;
}

function toRowForm(r: SessionFeedbackRow): RowForm {
  return {
    status: r.status ?? 'co_mat',
    yThuc: r.yThuc != null ? String(r.yThuc) : '',
    lamBTVN: r.lamBTVN != null ? String(r.lamBTVN) : '',
    nhanXet: r.nhanXet ?? '',
    linkLichess: r.linkLichess ?? '',
    kienThucMoi: r.kienThucMoi ?? '',
    giaoBTVN: r.giaoBTVN ?? '',
    khBuoiSau: r.khBuoiSau ?? '',
    sachDangHoc: r.sachDangHoc ?? '',
  };
}

function RowEditor({
  row,
  isHistorical,
  onDone,
}: {
  row: SessionFeedbackRow;
  isHistorical: boolean;
  onDone: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<RowForm>(() => toRowForm(row));
  const [saving, startSave] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof RowForm, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const onSave = () => {
    setError(null);
    startSave(async () => {
      const res = await updateAttendanceFeedbackAction(row.attendanceId, {
        status: form.status,
        yThuc: form.yThuc ? Number(form.yThuc) : null,
        lamBTVN: form.lamBTVN ? Number(form.lamBTVN) : null,
        nhanXet: form.nhanXet || null,
        linkLichess: form.linkLichess || null,
        // Nội dung buổi chỉ gửi khi buổi lịch sử (server cũng tự chặn nếu gắn session).
        ...(isHistorical
          ? {
              kienThucMoi: form.kienThucMoi || null,
              giaoBTVN: form.giaoBTVN || null,
              khBuoiSau: form.khBuoiSau || null,
              sachDangHoc: form.sachDangHoc || null,
            }
          : {}),
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onDone();
      router.refresh();
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 2px' }}>
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
      {isHistorical && (
        <>
          <label className="ds-field" style={{ display: 'block' }}>
            Kiến thức mới
            <textarea className="ds-input ds-input--full" rows={2} value={form.kienThucMoi} onChange={(e) => set('kienThucMoi', e.target.value)} disabled={saving} />
          </label>
          <div className="ds-formrow">
            <label className="ds-field" style={{ flex: 1 }}>
              Giao BTVN
              <input className="ds-input ds-input--full" type="text" value={form.giaoBTVN} onChange={(e) => set('giaoBTVN', e.target.value)} disabled={saving} />
            </label>
            <label className="ds-field" style={{ flex: 1 }}>
              Sách đang học
              <input className="ds-input ds-input--full" type="text" value={form.sachDangHoc} onChange={(e) => set('sachDangHoc', e.target.value)} disabled={saving} />
            </label>
          </div>
          <label className="ds-field" style={{ display: 'block' }}>
            Kế hoạch buổi sau
            <textarea className="ds-input ds-input--full" rows={2} value={form.khBuoiSau} onChange={(e) => set('khBuoiSau', e.target.value)} disabled={saving} />
          </label>
        </>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <Button buttonStyle="primary" type="button" disabled={saving} onClick={onSave}>
          {saving ? 'Đang lưu…' : 'Lưu'}
        </Button>
        <Button buttonStyle="secondary" type="button" disabled={saving} onClick={onDone}>
          Hủy
        </Button>
      </div>
    </div>
  );
}

export function SessionFeedbackTable({ data }: { data: SessionFeedbackData }) {
  const [editId, setEditId] = useState<number | null>(null);

  const sub = [fmtDate(data.date), data.location, data.coachName ? `GV: ${data.coachName}` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <header className="ds-pghead">
        <div>
          <h1 className="ds-pghead__h1">{data.title}</h1>
          <p className="ds-pghead__sub">{sub || '—'}</p>
        </div>
      </header>

      {data.classContent && data.sessionId !== null && (
        <ClassContentEditor sessionId={data.sessionId} content={data.classContent} />
      )}

      {data.rows.length === 0 ? (
        <p className="ds-muted">Buổi này chưa có học viên nào.</p>
      ) : (
        <div className="ds-tbl-wrap">
          <table className="ds-tbl">
            <thead>
              <tr>
                <th scope="col">Học viên</th>
                <th scope="col">Trạng thái</th>
                <th scope="col">Ý thức</th>
                <th scope="col">BTVN</th>
                <th scope="col">Nhận xét</th>
                <th scope="col" style={{ width: 70 }}>Sửa</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => {
                const isOpen = editId === r.attendanceId;
                return (
                  <Fragment key={r.attendanceId}>
                    <tr>
                      <td>
                        {r.studentId !== null ? (
                          <a className="ds-tbl__link" href={`/admin/nhan-xet-buoi?student=${r.studentId}`}>
                            {r.studentName}
                          </a>
                        ) : (
                          r.studentName
                        )}
                      </td>
                      <td>{r.status ? STATUS_LABEL[r.status] : '—'}</td>
                      <td className="ds-tbl__num">{r.yThuc ?? '—'}</td>
                      <td className="ds-tbl__num">{r.lamBTVN ?? '—'}</td>
                      <td style={{ whiteSpace: 'pre-wrap' }}>{r.nhanXet ?? '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="ds-tbl__link"
                          onClick={() => setEditId(isOpen ? null : r.attendanceId)}
                        >
                          {isOpen ? 'Đóng' : 'Sửa'}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={6} className="ds-expandcell">
                          <RowEditor row={r} isHistorical={data.isHistorical} onDone={() => setEditId(null)} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default SessionFeedbackTable;
