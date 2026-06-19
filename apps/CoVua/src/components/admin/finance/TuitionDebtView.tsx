import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import type { AdminViewServerProps } from 'payload';
import { loadTuitionDebt } from '@/lib/operations/debt';
import { TuitionDebtClient } from './TuitionDebtClient';

/**
 * CÔNG NỢ HỌC PHÍ (admin view — staff tool, chỉ xem).
 *
 * Hai nhóm: (1) gói sắp/hết buổi-hạn chưa gia hạn (cần nhắc đóng tiếp);
 * (2) phiếu thu trạng thái "Chờ". Phạm vi toàn cơ sở (như KPI/hàng đợi).
 */
export async function TuitionDebtView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props;
  const {
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

  const debt = await loadTuitionDebt(payload, user);

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
          <h1>Công nợ học phí</h1>
          <p style={{ color: 'var(--theme-elevation-500)' }}>
            Học viên <strong>sắp hết số buổi tồn</strong> (cần nhắc đóng kỳ tiếp)
            và các phiếu thu còn trạng thái “Chờ”. Toàn cơ sở. Xem đầy đủ số buổi
            tồn &amp; đối soát ở mục <strong>Số buổi tồn</strong>.
          </p>
        </header>
        <TuitionDebtClient
          lowStudents={debt.lowStudents}
          pendingPayments={debt.pendingPayments}
        />
      </Gutter>
    </DefaultTemplate>
  );
}

export default TuitionDebtView;
