import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'
import { loadTeachingStats } from '@/lib/operations/teaching-stats'
import { loadTimetable } from '@/lib/operations/timetable'
import { formatLichHoc } from '@/lib/operations/schedule'

/**
 * Thống kê dạy (GĐ5 — staff tool, đọc-only). Đếm buổi theo GV và theo lớp trong
 * cửa sổ N tuần (mặc định 12, đổi qua ?weeks=) + Lịch theo GV (lớp + lịch tuần).
 * Dữ liệu branch-scoped (vai trò bị-khóa chỉ thấy cơ sở mình).
 */
function readWeeks(searchParams: AdminViewServerProps['searchParams']): number {
  const raw = (searchParams as Record<string, string | string[] | undefined> | undefined)?.weeks
  const v = Array.isArray(raw) ? raw[0] : raw
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.min(52, Math.floor(n)) : 12
}

const WEEK_OPTIONS = [4, 12, 24, 52]

export async function TeachingStatsView(props: AdminViewServerProps) {
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

  const weeks = readWeeks(searchParams)
  const stats = await loadTeachingStats(payload, user, weeks)
  const { classes } = await loadTimetable(payload, user)

  // Lịch theo GV: gom lớp + lịch tuần theo từng GV (chính + trợ giảng).
  const byCoach = new Map<number, { name: string; items: string[] }>()
  for (const c of classes) {
    if (c.trangThai === 'da_dong') continue
    const lich = formatLichHoc(c.slots)
    for (const co of c.coaches) {
      let e = byCoach.get(co.id)
      if (!e) {
        e = { name: co.name, items: [] }
        byCoach.set(co.id, e)
      }
      e.items.push(`${c.title}${lich ? ` — ${lich}` : ''}`)
    }
  }
  const coachSchedules = [...byCoach.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'))

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
          <h1>Thống kê dạy</h1>
          <p style={{ color: 'var(--theme-elevation-500)' }}>
            Đếm buổi theo giáo viên và theo lớp trong {weeks} tuần gần nhất (từ{' '}
            {stats.fromISO.slice(0, 10)}). Tổng {stats.totalSessions} buổi. Buổi dạy bù tính riêng;
            buổi hủy không tính “đã dạy”.
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--theme-elevation-500)' }}>Cửa sổ:</span>
            {WEEK_OPTIONS.map((w) => (
              <a
                key={w}
                href={`?weeks=${w}`}
                style={{ fontWeight: w === weeks ? 700 : 400, textDecoration: 'underline' }}
              >
                {w} tuần
              </a>
            ))}
          </div>
        </header>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Theo giáo viên</h2>
          {stats.perCoach.length === 0 ? (
            <p className="ds-muted">Chưa có buổi nào trong cửa sổ này.</p>
          ) : (
            <div className="ds-tbl-wrap">
              <table className="ds-tbl">
                <thead>
                  <tr>
                    <th scope="col">Giáo viên</th>
                    <th scope="col">Đã dạy</th>
                    <th scope="col">Dạy bù</th>
                    <th scope="col">Hủy</th>
                    <th scope="col">Số lớp</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.perCoach.map((r) => (
                    <tr key={r.coachId}>
                      <td>{r.name}</td>
                      <td>{r.daDay}</td>
                      <td>{r.bu}</td>
                      <td>{r.huy}</td>
                      <td>{r.soLop}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Theo lớp</h2>
          {stats.perClass.length === 0 ? (
            <p className="ds-muted">
              Chưa có buổi gắn lớp trong cửa sổ này (buổi lịch sử theo mã buổi không gắn lớp; sẽ có
              khi điểm danh/nhập buổi theo lớp).
            </p>
          ) : (
            <div className="ds-tbl-wrap">
              <table className="ds-tbl">
                <thead>
                  <tr>
                    <th scope="col">Lớp</th>
                    <th scope="col">Đã dạy</th>
                    <th scope="col">Dạy bù</th>
                    <th scope="col">Hủy</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.perClass.map((r) => (
                    <tr key={r.classId}>
                      <td>{r.title}</td>
                      <td>{r.daDay}</td>
                      <td>{r.bu}</td>
                      <td>{r.huy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Lịch theo giáo viên</h2>
          {coachSchedules.length === 0 ? (
            <p className="ds-muted">Chưa có lớp nào có lịch + GV trong phạm vi của bạn.</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {coachSchedules.map((c) => (
                <div
                  key={c.name}
                  style={{
                    border: '1px solid var(--theme-elevation-150)',
                    borderRadius: 6,
                    padding: 12,
                  }}
                >
                  <strong>{c.name}</strong>
                  <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                    {c.items.map((it, i) => (
                      <li key={i}>{it}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </Gutter>
    </DefaultTemplate>
  )
}

export default TeachingStatsView
