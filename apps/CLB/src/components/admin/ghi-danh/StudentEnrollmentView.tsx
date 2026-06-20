import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'
import { loadEnrollableStudents } from '@/lib/operations/roster'
import { loadTimetable } from '@/lib/operations/timetable'
import { StudentEnrollmentClient, type EnrollClass } from './StudentEnrollmentClient'

/**
 * Ghi danh theo HỌC VIÊN (GĐ — student-centric). Chọn 1 HV → tích nhiều lớp
 * (checklist) → lưu. Cảnh báo mềm nếu các lớp tích trùng giờ. Bổ sung cho màn
 * "Sĩ số lớp" (class-centric). Branch-scoped theo cơ sở của nhân viên.
 */
export async function StudentEnrollmentView(props: AdminViewServerProps) {
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

  const students = await loadEnrollableStudents(payload, user)
  const { classes: timetable } = await loadTimetable(payload, user)
  const classes: EnrollClass[] = timetable
    .filter((c) => c.trangThai !== 'da_dong')
    .map((c) => ({
      id: c.id,
      title: c.title,
      location: c.locationName,
      slots: c.slots.map((s) => ({
        thu: s.thu,
        gioBatDau: s.gioBatDau,
        gioKetThuc: s.gioKetThuc,
        phong: s.phong ?? null,
      })),
    }))

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
          <h1>Ghi danh theo học viên</h1>
          <p style={{ color: 'var(--theme-elevation-500)' }}>
            Chọn một học viên rồi tích các lớp em ấy đang học (có thể nhiều lớp). Hệ thống cảnh báo
            nếu các lớp tích bị trùng giờ. Bấm Lưu để cập nhật ghi danh. (Quản lý theo lớp: dùng màn
            “Sĩ số lớp”.)
          </p>
        </header>
        {students.length === 0 || classes.length === 0 ? (
          <p style={{ color: 'var(--theme-elevation-500)' }}>
            {students.length === 0
              ? 'Chưa có học viên trong phạm vi của bạn.'
              : 'Chưa có lớp đang mở trong phạm vi của bạn — tạo/nhập lớp trước.'}
          </p>
        ) : (
          <StudentEnrollmentClient students={students} classes={classes} />
        )}
      </Gutter>
    </DefaultTemplate>
  )
}

export default StudentEnrollmentView
