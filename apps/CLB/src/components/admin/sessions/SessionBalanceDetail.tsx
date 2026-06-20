import type { SessionBalanceMode, StudentSessionBreakdown } from '@/lib/operations/session-balance'
import { attendanceHref, paymentsHref } from '@/lib/operations/session-balance-links'

/**
 * ĐỐI SOÁT CHI TIẾT 1 học viên (server component) — trang
 * `/admin/so-buoi-ton?student=<id>`. Phơi bày toàn bộ phép tính + danh sách
 * buổi học + link bản ghi gốc để nhân viên kiểm chứng số liệu.
 */

const MODE_LABELS: Record<SessionBalanceMode, string> = {
  opening: 'Chốt số dư đầu kỳ',
  last_payment: 'Lần nộp gần nhất',
  none: 'Chưa có phiếu thu',
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN')
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

export function SessionBalanceDetail({ data }: { data: StudentSessionBreakdown }) {
  const r = data.result
  const balanceText = r.balance === null ? '—' : fmtNum(r.balance)
  const balanceColor =
    r.balance === null
      ? 'var(--ds-text-muted)'
      : r.balance < 0
        ? 'var(--ds-critical)'
        : r.balance <= 3
          ? 'var(--ds-warning)'
          : 'var(--ds-success)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <header className="ds-pghead">
        <div>
          <h1 className="ds-pghead__h1">{data.studentName}</h1>
          <p className="ds-pghead__sub">
            {data.location ?? '—'} ·{' '}
            <a className="ds-tbl__link" href={`/admin/collections/students/${data.studentId}`}>
              Mở hồ sơ học viên
            </a>
          </p>
        </div>
      </header>

      {/* Cách tính + công thức */}
      <section className="ds-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="ds-muted">
          Cách tính: <strong>{MODE_LABELS[r.mode]}</strong>
          {r.anchorDate ? (
            <>
              {' '}
              · mốc từ <strong>{fmtDate(r.anchorDate)}</strong>
            </>
          ) : null}
        </div>
        <div style={{ fontSize: '1.15em' }}>
          Đã nộp <strong>{fmtNum(r.paid)}</strong> − Đã học <strong>{fmtNum(r.attended)}</strong> =
          Tồn <strong style={{ color: balanceColor }}>{balanceText}</strong>
          {r.mode === 'none' && (
            <span className="ds-muted"> (chưa có phiếu thu / số dư ⇒ chưa tính được)</span>
          )}
        </div>
      </section>

      {/* Phiếu thu (đã nộp) */}
      <section className="ds-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 12,
          }}
        >
          <h2 className="ds-section__title" style={{ margin: 0 }}>
            Phiếu thu đã nộp
          </h2>
          <a className="ds-tbl__link" href={paymentsHref(data.studentId)}>
            Xem phiếu thu gốc →
          </a>
        </div>
        <p className="ds-muted" style={{ margin: 0 }}>
          Dòng <strong>được tính</strong> (in đậm) là phần cộng vào “Đã nộp” của kỳ hiện tại.
        </p>
        {data.openingBalance !== null && data.openingDate && (
          <div style={{ fontWeight: 700 }}>
            Số dư đầu kỳ (đến hết {fmtDate(data.openingDate)}): +{fmtNum(data.openingBalance)} buổi
          </div>
        )}
        {data.payments.length === 0 ? (
          <p className="ds-muted" style={{ margin: 0 }}>
            Chưa có phiếu thu “Đã nộp”.
          </p>
        ) : (
          <div className="ds-tbl-wrap" style={{ maxWidth: 480 }}>
            <table className="ds-tbl">
              <thead>
                <tr>
                  <th scope="col">Ngày nộp</th>
                  <th scope="col">Số buổi nộp</th>
                  <th scope="col">Tính vào kỳ?</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p, i) => (
                  <tr
                    key={i}
                    style={{
                      fontWeight: p.counted ? 700 : 400,
                      color: p.counted ? undefined : 'var(--theme-elevation-450)',
                    }}
                  >
                    <td>{fmtDate(p.ngayNop)}</td>
                    <td className="ds-tbl__num">{fmtNum(p.soBuoiNop)}</td>
                    <td>{p.counted ? '✓ Có' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Buổi đã học trong kỳ */}
      <section className="ds-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 12,
          }}
        >
          <h2 className="ds-section__title" style={{ margin: 0 }}>
            Buổi đã học {r.anchorDate ? `(từ ${fmtDate(r.anchorDate)})` : '(toàn bộ)'}:{' '}
            {data.attendedSinceDates.length}
          </h2>
          <a className="ds-tbl__link" href={attendanceHref(data.studentId, r.mode, r.anchorDate)}>
            Xem điểm danh gốc →
          </a>
        </div>
        {data.attendedSinceDates.length === 0 ? (
          <p className="ds-muted" style={{ margin: 0 }}>
            Không có buổi “Có mặt” trong kỳ.
          </p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {data.attendedSinceDates.map((d, i) => (
              <span key={i} className="ds-chip ds-chip--sm">
                {fmtDate(d)}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Đối soát toàn bộ lịch sử */}
      <section className="ds-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h2 className="ds-section__title" style={{ margin: 0 }}>
          Đối soát toàn bộ lịch sử
        </h2>
        <div>
          Tổng đã nộp <strong>{fmtNum(r.lifetimePaid)}</strong> − Tổng đã học{' '}
          <strong>{fmtNum(r.lifetimeAttended)}</strong> ={' '}
          <strong style={{ color: r.lifetimeBalance < 0 ? 'var(--ds-critical)' : undefined }}>
            {fmtNum(r.lifetimeBalance)}
          </strong>
        </div>
        <p className="ds-muted" style={{ margin: 0 }}>
          Số âm = phiếu thu lịch sử còn thiếu so với số buổi đã học (cần bổ sung phiếu thu hoặc chốt
          số dư đầu kỳ).
        </p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <a className="ds-tbl__link" href={paymentsHref(data.studentId)}>
            Tất cả phiếu thu →
          </a>
          <a className="ds-tbl__link" href={attendanceHref(data.studentId, 'none', null)}>
            Tất cả điểm danh có mặt →
          </a>
        </div>
      </section>
    </div>
  )
}

export default SessionBalanceDetail
