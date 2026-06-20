import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'
import { canPlanSessions } from '@/access'
import { loadClassOptions } from '@/lib/operations/roster'
import { SessionPlanningClient } from './SessionPlanningClient'

/**
 * Màn "Lập kế hoạch buổi học" (V1 — staff tool). Chọn lớp + khoảng ngày → xem
 * trước chuỗi buổi sinh từ lịch tuần → xác nhận sinh buổi `du_kien`. Soạn nội dung
 * từng buổi, hủy buổi, tạo buổi bù.
 *
 * Sinh/hủy/bù chỉ admin/manager (`canPlanSessions`); coach/lễ tân cùng cơ sở vẫn
 * soạn được NỘI DUNG buổi. Lớp lọc theo cơ sở của nhân viên (branch-scope).
 */
export async function SessionPlanningView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props
  const {
    req,
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

  const canPlan = canPlanSessions({ req }) === true
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
          <h1>Lập kế hoạch buổi học</h1>
          <p style={{ color: 'var(--theme-elevation-500)' }}>
            Chọn lớp và khoảng ngày, xem trước rồi sinh trước chuỗi buổi <strong>dự kiến</strong> từ
            lịch học tuần, sau đó soạn nội dung từng buổi. Buổi dự kiến{' '}
            <strong>chưa tính học phí</strong> (chỉ buổi có điểm danh “có mặt” mới trừ buổi).
          </p>
        </header>
        {classes.length === 0 ? (
          <p style={{ color: 'var(--theme-elevation-500)' }}>
            Chưa có lớp nào trong phạm vi của bạn. Nếu bạn là HLV/lễ tân, nhờ admin/manager gán{' '}
            <strong>Cơ sở</strong> trong hồ sơ tài khoản.
          </p>
        ) : (
          <SessionPlanningClient classes={classes} canPlan={canPlan} />
        )}
      </Gutter>
    </DefaultTemplate>
  )
}

export default SessionPlanningView
