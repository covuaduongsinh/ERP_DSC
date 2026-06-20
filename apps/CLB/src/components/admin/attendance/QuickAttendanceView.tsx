import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'
import { loadClassOptions } from '@/lib/operations/roster'
import { QuickAttendanceClient } from './QuickAttendanceClient'

/**
 * ĐIỂM DANH NHANH cả lớp (admin view — staff tool).
 *
 * Chọn lớp + ngày → lưới tick có mặt/vắng/phép cho từng HV đang học → ghi một
 * lần. Idempotent theo (student, ngày) ⇒ bấm lại không nhân đôi. Danh sách lớp
 * lọc theo cơ sở của nhân viên (fail-closed nếu chưa gán cơ sở).
 */
export async function QuickAttendanceView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props
  const {
    req: { user, payload, i18n },
    permissions,
    visibleEntities,
    locale,
  } = initPageResult

  if (!user || user.collection !== 'users') {
    return (
      <Gutter>
        <p>Bạn cần đăng nhập tài khoản nhân viên để sử dụng trang này.</p>
      </Gutter>
    )
  }

  const classes = await loadClassOptions(payload, user)

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
          <h1>Điểm danh nhanh</h1>
          <p style={{ color: 'var(--theme-elevation-500)' }}>
            Chọn lớp và ngày, tick có mặt/vắng/phép cho cả lớp rồi lưu một lần. Ghi lại cùng ngày sẽ
            cập nhật, không tạo trùng — buổi “có mặt” tự cộng vào số buổi đã học của chu kỳ.
          </p>
        </header>
        {classes.length === 0 ? (
          <p style={{ color: 'var(--theme-elevation-500)' }}>
            Chưa có lớp nào trong phạm vi của bạn. Nếu bạn là HLV/lễ tân, nhờ admin/manager gán{' '}
            <strong>Cơ sở</strong> trong hồ sơ tài khoản.
          </p>
        ) : (
          <QuickAttendanceClient classes={classes} />
        )}
      </Gutter>
    </DefaultTemplate>
  )
}

export default QuickAttendanceView
