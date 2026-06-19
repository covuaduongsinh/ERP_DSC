'use client';

import { useMemo, useState } from 'react';
import type { DebtStudentRow, PendingPaymentRow } from '@/lib/operations/debt';

export interface TuitionDebtClientProps {
  lowStudents: DebtStudentRow[];
  pendingPayments: PendingPaymentRow[];
}

type SortKey = 'balance' | 'studentName';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN');
}

function formatVnd(n: number | null): string {
  return typeof n === 'number' && n > 0 ? `${n.toLocaleString('vi-VN')}đ` : '—';
}

const CO_SO_LABELS: Record<string, string> = {
  kim_lien: 'Kim Liên',
  vinh_phuc: 'Vĩnh Phúc',
};

export function TuitionDebtClient({
  lowStudents,
  pendingPayments,
}: TuitionDebtClientProps) {
  const [sortKey, setSortKey] = useState<SortKey>('balance');
  const [asc, setAsc] = useState(true);

  const sortedStudents = useMemo(() => {
    const rows = [...lowStudents];
    rows.sort((a, b) => {
      const cmp =
        sortKey === 'balance'
          ? a.balance - b.balance
          : a.studentName.localeCompare(b.studentName, 'vi');
      return asc ? cmp : -cmp;
    });
    return rows;
  }, [lowStudents, sortKey, asc]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setAsc(true);
    }
  };

  const arrow = (key: SortKey) => (key === sortKey ? (asc ? ' ▲' : ' ▼') : '');

  return (
    <div>
      <section className="ds-section">
        <h2 className="ds-section__title">Cần nhắc gia hạn ({sortedStudents.length})</h2>
        {sortedStudents.length === 0 ? (
          <p className="ds-muted">Không có học viên nào sắp hết buổi tồn. 🎉</p>
        ) : (
          <div className="ds-tbl-wrap">
            <table className="ds-tbl">
              <thead>
                <tr>
                  <th scope="col">
                    <button type="button" className="ds-tbl__sort" onClick={() => toggleSort('studentName')}>
                      Học viên{arrow('studentName')}
                    </button>
                  </th>
                  <th scope="col">Cơ sở</th>
                  <th scope="col">
                    <button type="button" className="ds-tbl__sort" onClick={() => toggleSort('balance')}>
                      Buổi còn lại{arrow('balance')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedStudents.map((r) => {
                  const low = r.balance <= 3;
                  return (
                    <tr key={r.studentId}>
                      <td>
                        <a className="ds-tbl__link" href={`/admin/collections/students/${r.studentId}`}>
                          {r.studentName}
                        </a>
                      </td>
                      <td>{r.location ? <span className="ds-tag-loc">{r.location}</span> : '—'}</td>
                      <td className={'ds-tbl__num' + (low ? ' is-low' : '')}>{r.balance}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="ds-section">
        <h2 className="ds-section__title">Phiếu thu chờ ({pendingPayments.length})</h2>
        {pendingPayments.length === 0 ? (
          <p className="ds-muted">Không có phiếu thu nào ở trạng thái “Chờ”.</p>
        ) : (
          <div className="ds-tbl-wrap">
            <table className="ds-tbl">
              <thead>
                <tr>
                  <th scope="col">Học viên</th>
                  <th scope="col">Ngày nộp</th>
                  <th scope="col">Học phí</th>
                  <th scope="col">Tiền sách</th>
                  <th scope="col">Mua khác</th>
                  <th scope="col">Cơ sở</th>
                </tr>
              </thead>
              <tbody>
                {pendingPayments.map((p) => (
                  <tr key={p.paymentId}>
                    <td>{p.studentName}</td>
                    <td>{formatDate(p.ngayNop)}</td>
                    <td className="ds-tbl__num">{formatVnd(p.hocPhi)}</td>
                    <td className="ds-tbl__num">{formatVnd(p.tienSach)}</td>
                    <td className="ds-tbl__num">{formatVnd(p.muaKhac)}</td>
                    <td>{p.coSo ? <span className="ds-tag-loc">{CO_SO_LABELS[p.coSo] ?? p.coSo}</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
