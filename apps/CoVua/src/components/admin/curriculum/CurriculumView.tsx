import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import type { AdminViewServerProps } from 'payload';
import { canManageCurriculum } from '@/access';
import { CurriculumClient } from './CurriculumClient';

/**
 * Màn "Soạn khung lộ trình" (V2) — biên soạn giáo trình mẫu theo cấp (Tốt…Vua),
 * danh sách bài CÓ THỨ TỰ. TÀI SẢN DÙNG CHUNG toàn công ty (không branch-scope).
 *
 * Chỉ admin/manager (`canManageCurriculum`) — gate THẬT ở đây (server) + lặp lại
 * trong core/Server Action. Khung dùng để "Áp khung lộ trình" ở trang Lập kế hoạch.
 */
export async function CurriculumView(props: AdminViewServerProps) {
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

  const canManage = canManageCurriculum({ req }) === true;

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
          <h1>Soạn khung lộ trình</h1>
          <p style={{ color: 'var(--theme-elevation-500)' }}>
            Biên soạn <strong>giáo trình mẫu theo cấp</strong> (Tốt → Mã → Tượng → Xe →
            Hậu → Vua) — danh sách bài có thứ tự để mọi cơ sở dạy đồng nhất. Ở trang{' '}
            <strong>Lập kế hoạch buổi học</strong>, HLV bấm “Áp khung lộ trình” để điền
            sẵn nội dung các buổi theo khung này. Khung dùng chung toàn công ty.
          </p>
        </header>
        {canManage ? (
          <CurriculumClient />
        ) : (
          <p style={{ color: 'var(--theme-elevation-500)' }}>
            Chỉ <strong>quản lý</strong> hoặc <strong>admin</strong> mới được biên soạn
            khung lộ trình. Bạn vẫn xem được và áp khung ở trang Lập kế hoạch buổi học.
          </p>
        )}
      </Gutter>
    </DefaultTemplate>
  );
}

export default CurriculumView;
