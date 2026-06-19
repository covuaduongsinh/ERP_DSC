import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import type { AdminViewServerProps } from 'payload';
import { hasRole } from '@/access';
import { formatVnd } from '@/lib/kpi/format';
import { loadPayroll } from '@/lib/operations/payroll';

/**
 * BẢNG LƯƠNG GIÁO VIÊN (admin view — tài chính, chỉ xem).
 *
 * Lương theo buổi đứng lớp: số buổi distinct (ngày+lớp) × đơn giá (Coaches.luongMoiBuoi).
 * Gate xem = tài chính (admin/manager/accountant) — đều là vai trò GLOBAL nên đọc
 * toàn trung tâm. Chọn THÁNG qua `?month=YYYY-MM` (mặc định tháng hiện tại).
 */

function resolveMonth(raw: unknown, now: Date): { monthStr: string; from: string; to: string } {
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth() + 1;
  if (typeof raw === 'string') {
    const mt = /^(\d{4})-(\d{2})$/.exec(raw);
    if (mt) {
      const yy = Number(mt[1]);
      const mm = Number(mt[2]);
      if (mm >= 1 && mm <= 12) {
        y = yy;
        m = mm;
      }
    }
  }
  const from = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const to = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  return {
    monthStr: `${y}-${String(m).padStart(2, '0')}`,
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

export async function PayrollView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props;
  const {
    req,
    req: { user, payload, i18n },
    permissions,
    visibleEntities,
    locale,
  } = initPageResult;

  if (!user || user.collection !== 'users') {
    return (
      <Gutter>
        <p>Bạn cần đăng nhập tài khoản nhân viên để sử dụng trang này.</p>
      </Gutter>
    );
  }

  const canView = hasRole('admin', 'manager', 'accountant')({ req }) === true;
  const { monthStr, from, to } = resolveMonth(searchParams?.month, new Date());

  const data = canView ? await loadPayroll(payload, user, from, to) : null;

  return (
    <DefaultTemplate
      i18n={i18n}
      locale={locale}
      params={params}
      payload={payload}
      permissions={permissions}
      searchParams={searchParams}
      user={user}
      visibleEntities={visibleEntities}
    >
      <Gutter>
        <header style={{ marginBottom: 16 }}>
          <h1>Bảng lương giáo viên</h1>
          <p style={{ color: 'var(--theme-elevation-500)' }}>
            Lương theo <strong>buổi đứng lớp</strong>: số buổi (gộp HV cùng buổi) ×
            đơn giá/buổi đặt ở hồ sơ Giáo viên. Chỉ tài chính xem.
          </p>
        </header>

        {!canView ? (
          <p role="alert" style={{ color: 'var(--theme-warning-600)', fontWeight: 600 }}>
            Chỉ kế toán, quản lý hoặc admin mới xem được bảng lương.
          </p>
        ) : (
          <>
            <form method="get" style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 16 }}>
              <label className="ds-field" style={{ marginBottom: 0 }}>
                Tháng
                <input className="ds-input" type="month" name="month" defaultValue={monthStr} />
              </label>
              <button type="submit" className="ds-btn">
                Xem
              </button>
            </form>

            {data && data.rows.length > 0 ? (
              <>
                <p className="ds-muted" style={{ marginBottom: 12 }}>
                  Tháng {monthStr} — {data.tongBuoi} buổi · tổng lương{' '}
                  <strong>{formatVnd(data.tongTien)}</strong>
                </p>
                <div className="ds-tbl-wrap">
                  <table className="ds-tbl">
                    <thead>
                      <tr>
                        <th scope="col">Giáo viên</th>
                        <th scope="col">Số buổi</th>
                        <th scope="col">Đơn giá/buổi</th>
                        <th scope="col">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((r) => (
                        <tr key={r.coachId}>
                          <td>{r.name}</td>
                          <td className="ds-tbl__num">{r.soBuoi}</td>
                          <td className="ds-tbl__num">
                            {r.luongMoiBuoi != null ? formatVnd(r.luongMoiBuoi) : '— (chưa set)'}
                          </td>
                          <td className="ds-tbl__num">
                            {r.luongMoiBuoi != null ? formatVnd(r.thanhTien) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="ds-muted" style={{ marginTop: 8, fontSize: 12 }}>
                  GV hiển thị “— (chưa set)” cần điền <strong>Lương mỗi buổi</strong> ở hồ sơ Giáo viên.
                </p>
              </>
            ) : (
              <p className="ds-muted">Không có buổi dạy nào trong tháng {monthStr}.</p>
            )}
          </>
        )}
      </Gutter>
    </DefaultTemplate>
  );
}

export default PayrollView;
