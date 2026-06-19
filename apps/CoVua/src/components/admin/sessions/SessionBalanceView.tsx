import Link from 'next/link';
import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import type { AdminViewServerProps } from 'payload';
import {
  loadSessionBalances,
  loadStudentSessionBreakdown,
} from '@/lib/operations/session-balance';
import { SessionBalanceClient } from './SessionBalanceClient';
import { SessionBalanceDetail } from './SessionBalanceDetail';

/**
 * SỐ BUỔI TỒN (admin view — staff tool, chỉ xem).
 *
 *  - `/admin/so-buoi-ton`              → danh sách MỌI học viên đang học (số buổi
 *    tồn = đã nộp − đã học); mỗi dòng mở rộng xem đối soát gọn.
 *  - `/admin/so-buoi-ton?student=<id>` → trang đối soát CHI TIẾT 1 học viên.
 *
 * Toàn cơ sở (branch-scope theo access HV). Xem `lib/operations/session-balance.ts`.
 */
function parseStudentId(raw: string | string[] | undefined): number | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

const backLinkStyle: React.CSSProperties = {
  color: 'var(--theme-text)',
  textDecoration: 'underline',
};

export async function SessionBalanceView(props: AdminViewServerProps) {
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

  const studentId = parseStudentId(
    searchParams?.student as string | string[] | undefined,
  );

  let body: React.ReactNode;
  if (studentId !== null) {
    const data = await loadStudentSessionBreakdown(payload, user, studentId);
    body = (
      <>
        <p style={{ marginBottom: 12 }}>
          <Link href="/admin/so-buoi-ton" style={backLinkStyle}>
            ← Quay lại danh sách số buổi tồn
          </Link>
        </p>
        {data ? (
          <SessionBalanceDetail data={data} />
        ) : (
          <p>Không tìm thấy học viên (hoặc ngoài phạm vi cơ sở của bạn).</p>
        )}
      </>
    );
  } else {
    const rows = await loadSessionBalances(payload, user);
    body = (
      <>
        <header style={{ marginBottom: 16 }}>
          <h1>Số buổi tồn</h1>
          <p style={{ color: 'var(--theme-elevation-500)' }}>
            Số buổi tồn = số buổi đã nộp − số buổi đã học, theo từng học viên đang
            học. Mặc định tính theo <strong>lần nộp gần nhất</strong>; học viên đã
            chốt số dư đầu kỳ thì tính theo số dư đó. Bấm <strong>Chi tiết</strong>{' '}
            để xem cách đối trừ; dòng <strong>âm</strong> / <strong>thiếu phiếu
            thu</strong> cần đối soát.
          </p>
        </header>
        <SessionBalanceClient rows={rows} />
      </>
    );
  }

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
      <Gutter>{body}</Gutter>
    </DefaultTemplate>
  );
}

export default SessionBalanceView;
