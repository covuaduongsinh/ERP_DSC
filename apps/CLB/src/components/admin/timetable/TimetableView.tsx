import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'
import { DAY_ORDER, DAY_LABEL, parseHm, type DayOfWeek } from '@/lib/operations/schedule'
import { loadTimetable } from '@/lib/operations/timetable'

/**
 * THỜI KHÓA BIỂU TUẦN (admin view — staff, chỉ xem).
 *
 * Lưới T2–CN theo cơ sở: mỗi buổi (lichHoc) thành một thẻ trong cột thứ tương ứng,
 * kèm GV/phòng/trạng thái. Banner cảnh báo TRÙNG LỊCH (GV hoặc phòng cùng giờ).
 * Lọc theo cơ sở (fail-closed nếu nhân viên bị-khóa chưa gán cơ sở).
 */

const TRANG_THAI_LABEL: Record<string, string> = {
  dang_mo: 'Đang mở',
  tam_dung: 'Tạm dừng',
  da_dong: 'Đã đóng',
}

interface Chip {
  classId: number
  title: string
  start: number
  gioBatDau: string
  gioKetThuc: string
  phong: string | null
  coaches: string
  trangThai: string | null
  conflict: boolean
}

export async function TimetableView(props: AdminViewServerProps) {
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

  const { classes, conflicts } = await loadTimetable(payload, user)

  // Khóa cảnh báo theo (lớp, thứ) để tô đậm thẻ bị trùng.
  const conflictKeys = new Set<string>()
  for (const c of conflicts) {
    conflictKeys.add(`${c.a.id}|${c.thu}`)
    conflictKeys.add(`${c.b.id}|${c.thu}`)
  }

  const byDay = new Map<DayOfWeek, Chip[]>()
  for (const day of DAY_ORDER) byDay.set(day, [])
  for (const cls of classes) {
    const coaches = cls.coaches.map((c) => c.name).join(' · ')
    for (const s of cls.slots) {
      const list = byDay.get(s.thu as DayOfWeek)
      if (!list) continue
      list.push({
        classId: cls.id,
        title: cls.title,
        start: parseHm(s.gioBatDau) ?? 0,
        gioBatDau: s.gioBatDau,
        gioKetThuc: s.gioKetThuc,
        phong: s.phong ?? null,
        coaches,
        trangThai: cls.trangThai,
        conflict: conflictKeys.has(`${cls.id}|${s.thu}`),
      })
    }
  }
  for (const list of byDay.values()) list.sort((a, b) => a.start - b.start)
  const totalSlots = classes.reduce((n, c) => n + c.slots.length, 0)

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
          <h1>Thời khóa biểu tuần</h1>
          <p style={{ color: 'var(--theme-elevation-500)' }}>
            Lịch các lớp theo cơ sở. Đặt lịch ở từng lớp (mục <strong>Lịch học</strong>). Cảnh báo
            bên dưới nếu một giáo viên hoặc phòng bị xếp trùng giờ.
          </p>
        </header>

        {conflicts.length > 0 ? (
          <div role="alert" className="ds-error" style={{ marginBottom: 16 }}>
            <strong>⚠ {conflicts.length} cảnh báo trùng lịch:</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {conflicts.map((c, i) => (
                <li key={i}>
                  {c.kind === 'coach' ? 'Trùng GV' : 'Trùng phòng'} (
                  {DAY_LABEL[c.thu as DayOfWeek] ?? c.thu}): <strong>{c.a.title}</strong> ×{' '}
                  <strong>{c.b.title}</strong> — {c.detail}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {totalSlots === 0 ? (
          <p className="ds-muted">
            Chưa có lớp nào đặt lịch (hoặc ngoài phạm vi cơ sở của bạn). Mở một lớp → điền mục{' '}
            <strong>Lịch học</strong> để hiện ở đây.
          </p>
        ) : (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', alignItems: 'flex-start' }}>
            {DAY_ORDER.map((day) => {
              const list = byDay.get(day) ?? []
              return (
                <div key={day} style={{ flex: '1 0 140px', minWidth: 140 }}>
                  <div
                    className="ds-muted"
                    style={{ fontWeight: 600, marginBottom: 6, textAlign: 'center' }}
                  >
                    {DAY_LABEL[day]}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {list.length === 0 ? (
                      <div
                        className="ds-muted"
                        style={{ textAlign: 'center', fontSize: 12, opacity: 0.6 }}
                      >
                        —
                      </div>
                    ) : (
                      list.map((chip, i) => (
                        <a
                          key={`${chip.classId}-${i}`}
                          href={`/admin/collections/classes/${chip.classId}`}
                          style={{
                            display: 'block',
                            padding: '6px 8px',
                            borderRadius: 6,
                            textDecoration: 'none',
                            border: chip.conflict
                              ? '1px solid var(--theme-error-500)'
                              : '1px solid var(--theme-elevation-150)',
                            background: chip.conflict
                              ? 'var(--theme-error-50)'
                              : 'var(--theme-elevation-50)',
                          }}
                        >
                          <div style={{ fontWeight: 600, fontSize: 13 }}>
                            {chip.conflict ? '⚠ ' : ''}
                            {chip.gioBatDau}–{chip.gioKetThuc}
                          </div>
                          <div style={{ fontSize: 13 }}>{chip.title}</div>
                          <div className="ds-muted" style={{ fontSize: 12 }}>
                            {chip.coaches || '—'}
                            {chip.phong ? ` · ${chip.phong}` : ''}
                            {chip.trangThai && chip.trangThai !== 'dang_mo'
                              ? ` · ${TRANG_THAI_LABEL[chip.trangThai] ?? chip.trangThai}`
                              : ''}
                          </div>
                        </a>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Gutter>
    </DefaultTemplate>
  )
}

export default TimetableView
