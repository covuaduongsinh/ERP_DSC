import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import type { AdminViewServerProps } from 'payload'
import { canViewReports } from '@/access'
import { DEFAULT_WEEKS } from '@/lib/kpi/compute'
import {
  formatDateUtc,
  formatPercent,
  formatVnd,
  formatWeekLabel,
  LEAD_SOURCE_LABELS,
} from '@/lib/kpi/format'
import { getKpiReport } from '@/lib/kpi/report'

const BASE_PATH = '/admin/bao-cao-kpi'
const WEEK_PRESETS = [8, 12, 24] as const

/**
 * Trang Báo cáo KPI (admin view — staff tool, CHỈ manager/admin).
 *
 * Render thuần server (read-only): gom 5 nhóm chỉ số từ `getKpiReport` (Local
 * API, overrideAccess:false). Gate quyền bằng `canViewReports` — role khác thấy
 * thông báo chặn và KHÔNG có truy vấn/không lộ số. Cửa sổ đổi qua `?weeks=N`.
 */
export async function KpiReportView(props: AdminViewServerProps) {
  const { initPageResult, params, searchParams } = props
  const {
    req,
    req: { user, payload, i18n },
    permissions,
    visibleEntities,
    locale,
  } = initPageResult

  if (!user) {
    return (
      <Gutter>
        <p>Bạn cần đăng nhập tài khoản nhân viên để sử dụng trang này.</p>
      </Gutter>
    )
  }

  const canView = canViewReports({ req }) === true

  const weeksRaw =
    searchParams && typeof searchParams.weeks === 'string'
      ? Number(searchParams.weeks)
      : DEFAULT_WEEKS

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
          <h1>Báo cáo KPI</h1>
          <p style={{ color: 'var(--theme-elevation-500)' }}>
            Tổng hợp chỉ số vận hành: lead theo tuần & nguồn, tỉ lệ chuyển đổi, tái tục, điểm danh
            trung bình, doanh thu và dòng tiền Thu − Chi.
          </p>
        </header>

        {canView ? (
          <ReportBody payload={payload} user={user} weeks={weeksRaw} />
        ) : (
          <p role="alert" style={{ color: 'var(--theme-warning-600)', fontWeight: 600 }}>
            Chỉ quản lý hoặc admin mới được xem báo cáo KPI.
          </p>
        )}
      </Gutter>
    </DefaultTemplate>
  )
}

export default KpiReportView

// ─────────────────────────────────────────────────────────────────────────────
// Thân báo cáo (chỉ render khi đủ quyền — truy vấn nằm trong đây)
// ─────────────────────────────────────────────────────────────────────────────

async function ReportBody({
  payload,
  user,
  weeks,
}: {
  payload: AdminViewServerProps['initPageResult']['req']['payload']
  user: AdminViewServerProps['initPageResult']['req']['user']
  weeks: number
}) {
  const report = await getKpiReport({ payload, user, weeks })
  const { window, leads, renewal, attendance, revenue, cashflow } = report

  return (
    <div>
      {/* Cửa sổ + preset */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <span style={{ color: 'var(--theme-elevation-600)' }}>
          Cửa sổ: <strong>{formatDateUtc(window.from)}</strong> →{' '}
          <strong>{formatDateUtc(window.to)}</strong> ({window.weeks} tuần, mốc Thứ Hai/UTC)
        </span>
        <span style={{ display: 'flex', gap: 8 }}>
          {WEEK_PRESETS.map((w) => {
            const active = w === window.weeks
            return (
              <Link
                key={w}
                href={`${BASE_PATH}?weeks=${w}`}
                style={{
                  padding: '2px 10px',
                  borderRadius: 6,
                  textDecoration: 'none',
                  border: '1px solid var(--theme-elevation-200)',
                  background: active ? 'var(--theme-elevation-150)' : 'transparent',
                  fontWeight: active ? 700 : 400,
                }}
              >
                {w} tuần
              </Link>
            )
          })}
        </span>
      </div>

      {/* 1) Funnel lead→thử→chính thức */}
      <Section
        title="Lead & tỉ lệ chuyển đổi"
        sql="leads WHERE created_at ∈ cửa sổ — đếm theo status; tỉ lệ = thử/tổng, chốt/thử, chốt/tổng"
      >
        <div style={statRowStyle}>
          <Stat label="Tổng lead" value={leads.funnel.total} />
          <Stat label="Đã liên hệ ↑" value={leads.funnel.contacted} />
          <Stat label="Học thử ↑" value={leads.funnel.trial} />
          <Stat label="Đã chốt" value={leads.funnel.official} />
          <Stat label="Không phù hợp" value={leads.funnel.unfit} />
        </div>
        <div style={statRowStyle}>
          <Stat label="Lead → Thử" value={formatPercent(leads.funnel.rateLeadToTrial)} accent />
          <Stat
            label="Thử → Chính thức"
            value={formatPercent(leads.funnel.rateTrialToOfficial)}
            accent
          />
          <Stat
            label="Lead → Chính thức"
            value={formatPercent(leads.funnel.rateLeadToOfficial)}
            accent
          />
        </div>
      </Section>

      {/* 2) Lead theo nguồn */}
      <Section title="Lead theo nguồn" sql="leads WHERE created_at ∈ cửa sổ — GROUP BY source">
        <Table headers={['Nguồn', 'Số lead', 'Tỉ trọng']}>
          {leads.bySource.map((s) => (
            <tr key={s.source}>
              <td style={tdStyle}>{LEAD_SOURCE_LABELS[s.source]}</td>
              <td style={tdNumStyle}>{s.count}</td>
              <td style={tdNumStyle}>{formatPercent(s.pct)}</td>
            </tr>
          ))}
        </Table>
      </Section>

      {/* 3) Lead theo tuần */}
      <Section
        title="Lead theo tuần"
        sql="leads — GROUP BY date_trunc('week', created_at) (Thứ Hai)"
      >
        <Table headers={['Tuần (bắt đầu)', 'Số lead']}>
          {leads.weekly.map((w) => (
            <tr key={w.weekStart.toISOString()}>
              <td style={tdStyle}>{formatWeekLabel(w.weekStart)}</td>
              <td style={tdNumStyle}>{w.count}</td>
            </tr>
          ))}
        </Table>
      </Section>

      {/* 4) Tái tục */}
      <Section
        title="Tái tục (toàn thời gian)"
        sql="tuition_cycles — COUNT(DISTINCT student có ≥2) / COUNT(DISTINCT student có ≥1)"
      >
        <div style={statRowStyle}>
          <Stat label="HV có ≥1 chu kỳ" value={renewal.withCycle} />
          <Stat label="HV có ≥2 chu kỳ" value={renewal.renewed} />
          <Stat label="Tỉ lệ tái tục" value={formatPercent(renewal.rate)} accent />
        </div>
      </Section>

      {/* 5) Điểm danh TB */}
      <Section
        title="Điểm danh trung bình"
        sql="attendance WHERE date ∈ cửa sổ — co_mat / (co_mat + vang + phep)"
      >
        <div style={statRowStyle}>
          <Stat label="Có mặt" value={attendance.present} />
          <Stat label="Vắng" value={attendance.absent} />
          <Stat label="Phép" value={attendance.excused} />
          <Stat label="Tổng buổi" value={attendance.total} />
          <Stat label="Tỉ lệ có mặt" value={formatPercent(attendance.presentRate)} accent />
        </div>
      </Section>

      {/* 6) Doanh thu */}
      <Section
        title="Doanh thu"
        sql="payments WHERE tinh_trang='da_nop' AND ngay_nop ∈ cửa sổ — SUM(hoc_phi + tien_sach)"
      >
        <div style={statRowStyle}>
          <Stat label="Doanh thu" value={formatVnd(revenue.total)} accent />
          <Stat label="Học phí" value={formatVnd(revenue.hocPhi)} />
          <Stat label="Tiền sách" value={formatVnd(revenue.tienSach)} />
          <Stat label="Mua khác (không tính)" value={formatVnd(revenue.muaKhac)} muted />
        </div>
        <Table headers={['Tuần (bắt đầu)', 'Doanh thu']}>
          {revenue.weekly.map((w) => (
            <tr key={w.weekStart.toISOString()}>
              <td style={tdStyle}>{formatWeekLabel(w.weekStart)}</td>
              <td style={tdNumStyle}>{formatVnd(w.amount)}</td>
            </tr>
          ))}
        </Table>
      </Section>

      {/* 7) Dòng tiền Thu − Chi */}
      <Section
        title="Dòng tiền (Thu − Hoàn − Chi)"
        sql="Thu = doanh thu; Hoàn = SUM(refunds.so_tien ∈ cửa sổ); Chi = SUM(expenses.amount ∈ cửa sổ); net = Thu − Hoàn − Chi"
      >
        <div style={statRowStyle}>
          <Stat label="Thu (doanh thu)" value={formatVnd(cashflow.revenue)} />
          <Stat label="Hoàn tiền" value={formatVnd(cashflow.refunds)} />
          <Stat label="Chi" value={formatVnd(cashflow.expense)} />
          <Stat
            label="Lợi nhuận (net)"
            value={formatVnd(cashflow.net)}
            accent={cashflow.net >= 0}
          />
        </div>
        <Table headers={['Tuần (bắt đầu)', 'Thu', 'Chi', 'Net']}>
          {cashflow.weekly.map((w) => (
            <tr key={w.weekStart.toISOString()}>
              <td style={tdStyle}>{formatWeekLabel(w.weekStart)}</td>
              <td style={tdNumStyle}>{formatVnd(w.revenue)}</td>
              <td style={tdNumStyle}>{formatVnd(w.expense)}</td>
              <td style={tdNumStyle}>{formatVnd(w.net)}</td>
            </tr>
          ))}
        </Table>
      </Section>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Mảnh trình bày (Server Components — không cần 'use client')
// ─────────────────────────────────────────────────────────────────────────────

const statRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  marginBottom: 12,
}

const tdStyle: CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid var(--theme-elevation-100)',
  textAlign: 'left',
}

const tdNumStyle: CSSProperties = {
  ...tdStyle,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
}

function Section({
  title,
  sql,
  children,
}: {
  title: string
  sql: string
  children: React.ReactNode
}) {
  return (
    <section
      style={{
        marginBottom: 24,
        padding: 16,
        borderRadius: 8,
        border: '1px solid var(--theme-elevation-150)',
        background: 'var(--theme-elevation-50)',
      }}
    >
      <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>{title}</h2>
      {children}
      <p
        style={{
          margin: '10px 0 0',
          fontSize: 12,
          color: 'var(--theme-elevation-450)',
        }}
      >
        ≈ {sql}
      </p>
    </section>
  )
}

function Stat({
  label,
  value,
  accent,
  muted,
}: {
  label: string
  value: string | number
  accent?: boolean
  muted?: boolean
}) {
  return (
    <div
      style={{
        flex: '1 1 140px',
        minWidth: 140,
        padding: '10px 12px',
        borderRadius: 8,
        border: '1px solid var(--theme-elevation-150)',
        background: 'var(--theme-elevation-0)',
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--theme-elevation-500)' }}>{label}</div>
      <div
        style={{
          marginTop: 4,
          fontSize: 22,
          fontWeight: 700,
          color: muted
            ? 'var(--theme-elevation-400)'
            : accent
              ? 'var(--theme-success-600)'
              : 'var(--theme-elevation-800)',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={h}
                scope="col"
                style={{
                  ...tdStyle,
                  textAlign: i === 0 ? 'left' : 'right',
                  fontWeight: 600,
                  borderBottom: '2px solid var(--theme-elevation-150)',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}
