import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import type { AdminViewServerProps } from 'payload';
import { loadClassOptions } from '@/lib/operations/roster';
import { BuoiHocClient, type CoachOption } from './BuoiHocClient';

/**
 * Màn "Buổi học" (GĐ4 — staff tool). Chọn lớp + ngày → nhập NỘI DUNG BUỔI (cấp lớp:
 * GV thực dạy, kiến thức mới, BTVN, kế hoạch, sách) + ĐIỂM DANH & NHẬN XÉT từng HV,
 * lưu một lần. Hỗ trợ hủy buổi / tạo buổi bù. Lớp lọc theo cơ sở của nhân viên.
 */
export async function BuoiHocView(props: AdminViewServerProps) {
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

  const classes = await loadClassOptions(payload, user);

  const coachesRes = await payload.find({
    collection: 'coaches',
    limit: 500,
    depth: 0,
    overrideAccess: false,
    user,
    sort: 'tenTat',
  });
  const coaches: CoachOption[] = coachesRes.docs.map((c) => ({
    id: c.id,
    name: String(c.hoTen ?? c.name ?? c.tenTat ?? `GV #${c.id}`),
  }));

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
          <h1>Buổi học</h1>
          <p style={{ color: 'var(--theme-elevation-500)' }}>
            Chọn lớp và ngày, nhập nội dung buổi (kiến thức mới, BTVN, kế hoạch) và
            điểm danh + nhận xét từng học viên, rồi lưu. Lưu lại cùng ngày sẽ cập
            nhật, không tạo trùng. Có thể hủy buổi hoặc tạo buổi dạy bù.
          </p>
        </header>
        {classes.length === 0 ? (
          <p style={{ color: 'var(--theme-elevation-500)' }}>
            Chưa có lớp nào trong phạm vi của bạn. Nếu bạn là HLV/lễ tân, nhờ
            admin/manager gán <strong>Cơ sở</strong> trong hồ sơ tài khoản.
          </p>
        ) : (
          <BuoiHocClient classes={classes} coaches={coaches} />
        )}
      </Gutter>
    </DefaultTemplate>
  );
}

export default BuoiHocView;
