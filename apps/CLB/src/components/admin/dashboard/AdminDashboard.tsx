import { cookies } from 'next/headers'
import Link from 'next/link'
import { Gutter } from '@payloadcms/ui'
import type { AdminViewServerProps } from 'payload'
import {
  RefreshCw,
  BatteryLow,
  Calculator,
  FilePenLine,
  CalendarClock,
  CircleCheckBig,
  ArrowUpRight,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Class, Location, User } from '@/payload-types'
import { DRAFT_QUEUE_SINCE, getStaffQueueCounts } from '@/lib/staff-queues'
import { ADMIN_BRANCH_COOKIE, getBranchContext } from '@/lib/admin-branch'
import { getRoleKpis } from '@/lib/kpi/forRole'
import { ROLE_META, primaryRole } from '@/components/admin/nav/adminNavConfig'
import { formatLichHoc } from '@/lib/operations/schedule'

/**
 * Bảng điều khiển /admin (override `admin.components.views.dashboard`).
 *
 * Bám design_handoff_admin_dsc/design/dashboard.jsx (role-aware): hàng đợi "việc
 * cần xử lý" + KPI theo vai trò + phễu pipeline + lớp tại cơ sở. Mọi số liệu THẬT
 * qua Local API `overrideAccess:false` (hàng đợi/KPI tự lọc theo role). Gập
 * StaffQueuesPanel (beforeDashboard cũ) vào đây.
 */

type QueueTone = 'critical' | 'warning' | 'info'

const draftReportsHref =
  '/admin/collections/progress-reports' +
  '?where[and][0][publishedAt][exists]=false' +
  `&where[and][1][createdAt][greater_than_equal]=${encodeURIComponent(DRAFT_QUEUE_SINCE)}`

function todayLabel(): string {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date())
  } catch {
    return new Date().toLocaleDateString('vi-VN')
  }
}

export async function AdminDashboard(props: AdminViewServerProps) {
  // Dashboard là "default view" của Payload: RootPage ĐÃ bọc trong DefaultTemplate
  // (nơi render Nav). KHÔNG tự bọc DefaultTemplate lần nữa (gây sidebar đôi) — chỉ
  // trả nội dung trong <Gutter>, đúng như DefaultDashboard gốc của Payload.
  const { initPageResult } = props
  const {
    req: { user, payload },
  } = initPageResult

  if (!user || user.collection !== 'users') {
    return (
      <Gutter>
        <p>Bạn cần đăng nhập tài khoản nhân viên để xem bảng điều khiển.</p>
      </Gutter>
    )
  }
  const staff = user as User
  const role = primaryRole(staff.role) // vai trò ưu tiên cao nhất (chọn bộ KPI + màu)
  const meta = ROLE_META[role]

  const cookieStore = await cookies()
  const branch = getBranchContext(staff, cookieStore.get(ADMIN_BRANCH_COOKIE)?.value)

  const queue = await getStaffQueueCounts()
  const kpis = await getRoleKpis({ payload, user: staff, role, queue, branchActive: branch.active })

  // Lớp tại các cơ sở đang chọn (read=anyone; lọc IN nếu không phải 'all').
  const classesRes = await payload.find({
    collection: 'classes',
    ...(branch.active !== 'all' && branch.active.length > 0
      ? { where: { location: { in: branch.active } } }
      : {}),
    depth: 1,
    limit: 8,
    sort: 'title',
    pagination: false,
    user: staff,
    overrideAccess: false,
  })
  const classes = classesRes.docs as Class[]

  const queueItems: {
    key: string
    label: string
    count: number
    href: string
    hint: string
    tone: QueueTone
    icon: LucideIcon
  }[] = [
    {
      key: 'renewal',
      label: 'Gia hạn đang chờ',
      count: queue.pendingRenewalRequests,
      href: '/admin/duyet-gia-han',
      hint: 'Phụ huynh xin gia hạn, chờ xử lý',
      tone: 'warning',
      icon: RefreshCw,
    },
    {
      key: 'low',
      label: 'Sắp hết buổi',
      count: queue.lowSessionStudents,
      href: '/admin/cong-no',
      hint: 'Học viên sắp hết số buổi tồn',
      tone: 'warning',
      icon: BatteryLow,
    },
    {
      key: 'reconcile',
      label: 'Cần đối soát buổi',
      count: queue.reconcileStudents,
      href: '/admin/so-buoi-ton',
      hint: 'Tồn âm hoặc chưa có phiếu thu',
      tone: 'info',
      icon: Calculator,
    },
    {
      key: 'draft',
      label: 'Báo cáo còn nháp',
      count: queue.draftProgressReports,
      href: draftReportsHref,
      hint: 'Nhận xét định kỳ chưa phát hành',
      tone: 'info',
      icon: FilePenLine,
    },
  ]
  const pendingQueue = queueItems.filter((q) => q.count > 0)
  const totalWork = pendingQueue.reduce((a, q) => a + q.count, 0)

  return (
    <Gutter className="dashboard">
      <div className="ds-dash">
        <header className="ds-pghead">
          <div>
            <h1 className="ds-pghead__h1">Bảng điều khiển</h1>
            <p className="ds-pghead__sub">
              {todayLabel()} ·{' '}
              {branch.locked
                ? 'Cơ sở của bạn'
                : branch.active === 'all'
                  ? 'Toàn hệ thống'
                  : 'Lọc theo cơ sở đang chọn'}{' '}
              · góc nhìn <b style={{ color: meta.color }}>{meta.label}</b>
            </p>
          </div>
          <span className="ds-chip">
            <CircleCheckBig
              className="ds-chip__ic"
              style={{ color: totalWork ? 'var(--ds-warning)' : 'var(--ds-success)' }}
              aria-hidden
            />
            {totalWork} việc cần xử lý
          </span>
        </header>

        {/* Hàng đợi việc cần xử lý */}
        {pendingQueue.length > 0 ? (
          <section>
            <div className="ds-overline">Việc cần xử lý</div>
            <div className="ds-qgrid">
              {pendingQueue.map((q) => {
                const Icon = q.icon
                return (
                  <Link key={q.key} href={q.href} className={`ds-qcard ds-qcard--${q.tone}`}>
                    <div className="ds-qcard__top">
                      <span className="ds-qcard__ic">
                        <Icon aria-hidden />
                      </span>
                      <span className="ds-qcard__count ds-tnum">{q.count}</span>
                    </div>
                    <div className="ds-qcard__label">{q.label}</div>
                    <div className="ds-qcard__hint">{q.hint}</div>
                    <span className="ds-qcard__go">
                      <ArrowUpRight aria-hidden />
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        ) : (
          <div className="ds-panel ds-empty">
            <span className="ds-empty__ic">
              <CircleCheckBig aria-hidden />
            </span>
            <div>
              <b>Không có việc tồn đọng trong phạm vi của bạn</b>
              <div className="ds-empty__sub">Tập trung vào lớp & buổi học hôm nay bên dưới.</div>
            </div>
          </div>
        )}

        {/* KPI theo vai trò */}
        <div className="ds-kpirow">
          {kpis.map((k) => (
            <div className="ds-kpi" key={k.label}>
              <div className="ds-kpi__top">{k.label}</div>
              <div className="ds-kpi__val ds-tnum">{k.value}</div>
              <div className="ds-kpi__sub">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Lớp tại cơ sở */}
        <div className="ds-grid2">
          <div className="ds-panel">
            <div className="ds-panel__head">
              <CalendarClock className="ds-panel__ic" aria-hidden />
              <h2 className="ds-panel__t">Lớp đang mở</h2>
              <span className="ds-chip ds-chip--sm">{classes.length}</span>
            </div>
            <div className="ds-panel__body">
              {classes.length === 0 ? (
                <p className="ds-panel__empty">Không có lớp trong phạm vi này.</p>
              ) : (
                <ul className="ds-classlist">
                  {classes.map((c) => {
                    const loc = c.location as Location | number | null | undefined
                    const locName = loc && typeof loc === 'object' ? loc.name : null
                    return (
                      <li key={c.id} className="ds-classitem">
                        <Link
                          href={`/admin/collections/classes/${c.id}`}
                          className="ds-classitem__link"
                        >
                          <b>{c.title}</b>
                          <span>
                            {locName ? `${locName} · ` : ''}
                            {formatLichHoc(c.lichHoc) || 'Chưa có lịch'}
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </Gutter>
  )
}

export default AdminDashboard
