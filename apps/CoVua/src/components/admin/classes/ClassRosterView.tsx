import { DefaultTemplate } from '@payloadcms/next/templates';
import { Gutter } from '@payloadcms/ui';
import type { AdminViewServerProps } from 'payload';
import { loadClassOptions, loadEnrollableStudents } from '@/lib/operations/roster';
import { ClassRosterClient } from './ClassRosterClient';

/**
 * SĨ SỐ LỚP (admin view — staff tool, chỉ xem).
 *
 * Chọn lớp → danh sách HV đang học + trạng thái học + số buổi còn lại của chu kỳ
 * + SĐT phụ huynh. Danh sách lớp lọc theo cơ sở (fail-closed nếu chưa gán).
 */
export async function ClassRosterView(props: AdminViewServerProps) {
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
  const enrollableStudents = await loadEnrollableStudents(payload, user);

  // Cho phép mở sẵn 1 lớp qua `?class=ID` (vd bấm từ cột "Sĩ số hiện tại").
  const rawClass = Array.isArray(searchParams?.class)
    ? searchParams.class[0]
    : searchParams?.class;
  const initialClassId =
    typeof rawClass === 'string' && /^\d+$/.test(rawClass) ? Number(rawClass) : undefined;

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
          <h1>Sĩ số lớp</h1>
          <p style={{ color: 'var(--theme-elevation-500)' }}>
            Xem học viên đang học của một lớp (trạng thái, số buổi còn lại, SĐT phụ
            huynh) và <strong>thêm / rút học viên</strong> khỏi lớp. Lọc theo cơ sở.
          </p>
        </header>
        {classes.length === 0 ? (
          <p style={{ color: 'var(--theme-elevation-500)' }}>
            Chưa có lớp nào trong phạm vi của bạn. Nếu bạn là HLV/lễ tân, nhờ
            admin/manager gán <strong>Cơ sở</strong> trong hồ sơ tài khoản.
          </p>
        ) : (
          <ClassRosterClient
            classes={classes}
            enrollableStudents={enrollableStudents}
            initialClassId={initialClassId}
          />
        )}
      </Gutter>
    </DefaultTemplate>
  );
}

export default ClassRosterView;
