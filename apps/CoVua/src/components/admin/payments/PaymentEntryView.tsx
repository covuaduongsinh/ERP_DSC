import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import type { AdminViewServerProps } from 'payload';
import type { Location, Student } from '@/payload-types';
import { PaymentEntryClient, type StudentOption } from './PaymentEntryClient';

/** Trần roster nạp ra form (chọn học viên). */
const STUDENT_LIMIT = 2000;

/** Suy cơ sở (kim_lien/vinh_phuc) từ tên Location (bỏ dấu, không phân biệt hoa). */
function guessCoSo(name: string | null | undefined): '' | 'kim_lien' | 'vinh_phuc' {
  if (!name) return '';
  const n = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (n.includes('kim lien')) return 'kim_lien';
  if (n.includes('vinh phuc')) return 'vinh_phuc';
  return '';
}

/**
 * Form NHẬP THU học phí (admin view — staff tool). Thay đường nhập Thu rời rạc
 * ở Lark (Deal HP/book/Tổng) bằng một form gọn ghi thẳng vào `payments`.
 *
 * Server nạp roster học viên (Local API, overrideAccess:false + user) ⇒ access
 * control collection vẫn là hàng rào. Bất kỳ nhân viên đăng nhập nào cũng mở
 * được; hành vi GHI do Server Action + collection access (create=staffOnly) gate.
 */
export async function PaymentEntryView(props: AdminViewServerProps) {
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

  const { docs } = await payload.find({
    collection: 'students',
    user,
    overrideAccess: false,
    depth: 1, // populate location để lấy tên cơ sở
    pagination: false,
    limit: STUDENT_LIMIT,
    sort: 'fullName',
    select: { fullName: true, location: true },
  });

  const students: StudentOption[] = (docs as Student[]).map((s) => {
    const loc = s.location as Location | number | null | undefined;
    const locName = loc && typeof loc === 'object' ? loc.name : null;
    return {
      id: s.id,
      fullName: s.fullName,
      location: locName ?? null,
      coSo: guessCoSo(locName),
    };
  });

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
          <h1>Nhập học phí (Thu)</h1>
          <p style={{ color: 'var(--theme-elevation-500)' }}>
            Ghi nhanh một phiếu thu cho học viên. Mỗi phiếu = một lần nộp (học phí
            + tiền sách + mua khác). Cơ sở tự gợi ý theo học viên — kiểm lại trước
            khi lưu.
          </p>
        </header>
        <PaymentEntryClient students={students} />
      </Gutter>
    </DefaultTemplate>
  );
}

export default PaymentEntryView;
