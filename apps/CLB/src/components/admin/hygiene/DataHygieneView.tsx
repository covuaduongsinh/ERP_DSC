import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import Link from 'next/link'
import type { AdminViewServerProps } from 'payload'
import { loadDataHygiene } from '@/lib/operations/hygiene'

/**
 * DỮ LIỆU CẦN HOÀN THIỆN (admin view — staff tool, chỉ xem).
 *
 * Siết mềm: KHÔNG khóa schema, phơi bản ghi thiếu dữ liệu quan trọng (cơ sở, cấp
 * chính, phụ huynh; chu kỳ thiếu ngày hết) để nhân viên dọn dần. HV scope theo
 * cơ sở của nhân viên.
 */
export async function DataHygieneView(props: AdminViewServerProps) {
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

  const signals = await loadDataHygiene(payload, user)
  const total = signals.reduce((sum, s) => sum + s.count, 0)

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
        <header className="ds-pghead" style={{ marginBottom: 18 }}>
          <div>
            <h1 className="ds-pghead__h1">Dữ liệu cần hoàn thiện</h1>
            <p className="ds-pghead__sub">
              Các bản ghi còn thiếu thông tin quan trọng — dọn dần để báo cáo & phân quyền chính
              xác. Hệ thống không khóa cứng, chỉ nhắc.
            </p>
          </div>
        </header>

        {total === 0 ? (
          <p className="ds-success">
            Không có dữ liệu nào cần hoàn thiện trong phạm vi của bạn. 🎉
          </p>
        ) : (
          <div>
            {signals.map((s) => (
              <section key={s.key} className="ds-section">
                <h2 className="ds-section__title" style={{ marginBottom: 4 }}>
                  {s.label}{' '}
                  <span className={s.count > 0 ? 'ds-count--warn' : 'ds-count--ok'}>
                    ({s.count})
                  </span>
                </h2>
                <p className="ds-muted" style={{ margin: '0 0 8px' }}>
                  {s.hint}
                </p>
                {s.count === 0 ? (
                  <p className="ds-muted">Không có. ✓</p>
                ) : (
                  <ul className="ds-samplelist">
                    {s.samples.map((sample) => (
                      <li key={sample.id}>
                        <Link className="ds-tbl__link" href={sample.href}>
                          {sample.label}
                        </Link>
                      </li>
                    ))}
                    {s.count > s.samples.length ? (
                      <li className="ds-samplelist__more">
                        … và {s.count - s.samples.length} bản ghi khác
                      </li>
                    ) : null}
                  </ul>
                )}
              </section>
            ))}
          </div>
        )}
      </Gutter>
    </DefaultTemplate>
  )
}

export default DataHygieneView
