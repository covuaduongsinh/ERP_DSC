'use client';

import { Fragment, useMemo, useState } from 'react';
import type {
  SessionBalanceFlag,
  SessionBalanceMode,
  SessionBalanceRow,
} from '@/lib/operations/session-balance';
import {
  attendanceHref,
  sessionDetailHref,
} from '@/lib/operations/session-balance-links';

export interface SessionBalanceClientProps {
  rows: SessionBalanceRow[];
}

type FilterKey = 'all' | 'low' | 'reconcile';
type SortKey = 'studentName' | 'balance' | 'attended' | 'paid';

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN');
}

const MODE_LABELS: Record<SessionBalanceMode, string> = {
  opening: 'Chốt số dư',
  last_payment: 'Lần nộp gần nhất',
  none: 'Chưa có phiếu thu',
};

function flagText(flag: SessionBalanceFlag): string {
  switch (flag) {
    case 'low':
      return '⏳ Sắp hết — nhắc gia hạn';
    case 'negative':
      return '🔴 Đã học vượt — soát phiếu thu';
    case 'none':
      return '⚠️ Thiếu phiếu thu / chưa chốt số dư';
    default:
      return 'Đang học';
  }
}

function flagColor(flag: SessionBalanceFlag): string | undefined {
  switch (flag) {
    case 'low':
      return 'var(--ds-warning)';
    case 'negative':
      return 'var(--ds-critical)';
    case 'none':
      return 'var(--ds-text-muted)';
    default:
      return undefined;
  }
}

export function SessionBalanceClient({ rows }: SessionBalanceClientProps) {
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('balance');
  const [asc, setAsc] = useState(true);
  const [lifetime, setLifetime] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());

  const toggleExpand = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const stats = useMemo(
    () => ({
      total: rows.length,
      low: rows.filter((r) => r.flag === 'low').length,
      reconcile: rows.filter((r) => r.flag === 'negative' || r.flag === 'none')
        .length,
    }),
    [rows],
  );

  // Giá trị hiển thị: chế độ thường (cửa sổ hiện tại) vs đối soát toàn bộ lịch sử.
  const view = (r: SessionBalanceRow) =>
    lifetime
      ? { paid: r.lifetimePaid, attended: r.lifetimeAttended, balance: r.lifetimeBalance }
      : { paid: r.paid, attended: r.attended, balance: r.balance };

  const visible = useMemo(() => {
    let list = rows;
    if (filter === 'low') list = list.filter((r) => r.flag === 'low');
    else if (filter === 'reconcile')
      list = list.filter((r) => r.flag === 'negative' || r.flag === 'none');

    const q = query.trim().toLowerCase();
    if (q) list = list.filter((r) => r.studentName.toLowerCase().includes(q));

    const sorted = [...list];
    sorted.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'studentName') {
        cmp = a.studentName.localeCompare(b.studentName, 'vi');
      } else {
        const av = view(a);
        const bv = view(b);
        const pick = (v: { paid: number; attended: number; balance: number | null }) =>
          sortKey === 'paid'
            ? v.paid
            : sortKey === 'attended'
              ? v.attended
              : v.balance === null
                ? Number.POSITIVE_INFINITY
                : v.balance;
        cmp = pick(av) - pick(bv);
      }
      return asc ? cmp : -cmp;
    });
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filter, query, sortKey, asc, lifetime]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setAsc((p) => !p);
    else {
      setSortKey(key);
      setAsc(true);
    }
  };
  const arrow = (key: SortKey) => (key === sortKey ? (asc ? ' ▲' : ' ▼') : '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="ds-toolbar">
        <button
          type="button"
          className={'ds-chip ds-chip--btn' + (filter === 'all' ? ' is-on' : '')}
          onClick={() => setFilter('all')}
        >
          Tất cả ({stats.total})
        </button>
        <button
          type="button"
          className={'ds-chip ds-chip--btn' + (filter === 'low' ? ' is-on' : '')}
          onClick={() => setFilter('low')}
        >
          Sắp hết ({stats.low})
        </button>
        <button
          type="button"
          className={'ds-chip ds-chip--btn' + (filter === 'reconcile' ? ' is-on' : '')}
          onClick={() => setFilter('reconcile')}
        >
          Cần đối soát ({stats.reconcile})
        </button>

        <input
          className="ds-input"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo tên học viên…"
          style={{ marginLeft: 'auto', minWidth: 200 }}
        />
        <label className="ds-radio">
          <input type="checkbox" checked={lifetime} onChange={(e) => setLifetime(e.target.checked)} />
          Đối soát toàn bộ lịch sử
        </label>
      </div>

      {lifetime && (
        <p className="ds-muted" style={{ margin: 0 }}>
          Đang xem <strong>toàn bộ lịch sử</strong>: đã nộp = tổng mọi phiếu thu, đã học = tổng buổi
          “có mặt”. Dùng để soi mức lệch dữ liệu (âm = phiếu thu lịch sử còn thiếu).
        </p>
      )}

      {visible.length === 0 ? (
        <p className="ds-muted">Không có học viên nào khớp bộ lọc.</p>
      ) : (
        <div className="ds-tbl-wrap">
          <table className="ds-tbl">
            <thead>
              <tr>
                <th scope="col" style={{ width: 90 }}>
                  Chi tiết
                </th>
                <th scope="col">
                  <button type="button" className="ds-tbl__sort" onClick={() => toggleSort('studentName')}>
                    Học viên{arrow('studentName')}
                  </button>
                </th>
                <th scope="col">Cơ sở</th>
                <th scope="col">
                  <button type="button" className="ds-tbl__sort" onClick={() => toggleSort('paid')}>
                    Đã nộp{arrow('paid')}
                  </button>
                </th>
                <th scope="col">
                  <button type="button" className="ds-tbl__sort" onClick={() => toggleSort('attended')}>
                    Đã học{arrow('attended')}
                  </button>
                </th>
                <th scope="col">
                  <button type="button" className="ds-tbl__sort" onClick={() => toggleSort('balance')}>
                    Tồn{arrow('balance')}
                  </button>
                </th>
                <th scope="col">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const v = view(r);
                const color = flagColor(r.flag);
                const isOpen = expanded.has(r.studentId);
                return (
                  <Fragment key={r.studentId}>
                    <tr>
                      <td>
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          className="ds-expandbtn"
                          onClick={() => toggleExpand(r.studentId)}
                        >
                          {isOpen ? '▾' : '▸'} Chi tiết
                        </button>
                      </td>
                      <td>
                        <a className="ds-tbl__link" href={`/admin/collections/students/${r.studentId}`}>
                          {r.studentName}
                        </a>
                      </td>
                      <td>{r.location ? <span className="ds-tag-loc">{r.location}</span> : '—'}</td>
                      <td className="ds-tbl__num">{fmt(v.paid)}</td>
                      <td className="ds-tbl__num">{fmt(v.attended)}</td>
                      <td
                        className="ds-tbl__num"
                        style={{
                          color,
                          fontWeight: r.flag === 'low' || r.flag === 'negative' ? 800 : undefined,
                        }}
                      >
                        {v.balance === null ? '—' : fmt(v.balance)}
                      </td>
                      <td style={{ color }}>
                        {flagText(r.flag)}
                        {!lifetime && r.flag !== 'none' && (
                          <span className="ds-cellsub">{MODE_LABELS[r.mode]}</span>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={7} className="ds-expandcell">
                          <RowBreakdown row={r} />
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

/** Bảng đối soát GỌN trong dòng mở rộng (dùng dữ liệu sẵn có, không gọi server). */
function RowBreakdown({ row }: { row: SessionBalanceRow }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 2px' }}>
      <div className="ds-muted">
        Cách tính: <strong>{MODE_LABELS[row.mode]}</strong>
        {row.anchorDate ? (
          <>
            {' '}· mốc từ <strong>{fmtDate(row.anchorDate)}</strong>
          </>
        ) : null}
      </div>
      <div>
        Đã nộp <strong>{fmt(row.paid)}</strong> − Đã học <strong>{fmt(row.attended)}</strong> = Tồn{' '}
        <strong style={{ color: row.balance !== null && row.balance < 0 ? 'var(--ds-critical)' : undefined }}>
          {row.balance === null ? '—' : fmt(row.balance)}
        </strong>
      </div>
      {row.openingBalance !== null && row.openingDate && (
        <div>
          Số dư đầu kỳ (đến hết {fmtDate(row.openingDate)}): <strong>+{fmt(row.openingBalance)}</strong> buổi
        </div>
      )}
      <div>
        <span className="ds-muted">Phiếu thu: </span>
        {row.payments.length === 0 ? (
          <span className="ds-muted">chưa có</span>
        ) : (
          row.payments.map((p, i) => (
            <span
              key={i}
              style={{
                marginRight: 12,
                fontWeight: p.counted ? 700 : 400,
                color: p.counted ? undefined : 'var(--theme-elevation-450)',
              }}
            >
              {fmtDate(p.ngayNop)}: {fmt(p.soBuoiNop)}
              {p.counted ? ' ✓' : ''}
            </span>
          ))
        )}
      </div>
      <div>
        <span className="ds-muted">Đã học: </span>
        {fmt(row.attended)} buổi {row.anchorDate ? `từ ${fmtDate(row.anchorDate)}` : '(toàn bộ)'} ·{' '}
        <a className="ds-tbl__link" href={attendanceHref(row.studentId, row.mode, row.anchorDate)}>
          Xem điểm danh gốc →
        </a>
      </div>
      <div className="ds-muted">
        Đối soát toàn bộ: {fmt(row.lifetimePaid)} − {fmt(row.lifetimeAttended)} ={' '}
        <strong style={{ color: row.lifetimeBalance < 0 ? 'var(--ds-critical)' : undefined }}>
          {fmt(row.lifetimeBalance)}
        </strong>
      </div>
      <div>
        <a className="ds-tbl__link" href={sessionDetailHref(row.studentId)}>
          Mở trang đầy đủ →
        </a>
      </div>
    </div>
  );
}
