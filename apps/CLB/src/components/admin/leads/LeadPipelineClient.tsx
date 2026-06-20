'use client'

import { useState, useTransition, type DragEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  Phone,
  MessageCircle,
  ArrowRightLeft,
  X,
  CircleSlash,
  Clock,
  CheckCircle2,
} from 'lucide-react'
import { setLeadStage, type LeadStage } from '@/app/actions/setLeadStage'
import { convertLead } from '@/app/actions/convertLead'

export interface LeadActivity {
  type: string
  at: string | null
  note: string | null
}

export interface LeadCard {
  id: number
  fullName: string
  phone: string
  childAge: string | null
  source: string
  status: string
  note: string | null
  locationName: string | null
  nextFollowUpAt: string | null
  overdue: boolean
  converted: boolean
  activity: LeadActivity[]
}

const BOARD: { key: LeadStage; name: string; hint: string; color: string }[] = [
  { key: 'moi', name: 'Mới', hint: 'Chưa ai liên hệ', color: '#9aa1b4' },
  { key: 'da_lien_he', name: 'Đã liên hệ', hint: 'Đang tư vấn', color: 'var(--ds-blue-light)' },
  { key: 'dang_ky_hoc_thu', name: 'Đăng ký học thử', hint: 'Đã hẹn lịch', color: 'var(--ds-teal)' },
  { key: 'da_chot', name: 'Đã chốt', hint: 'Chuyển thành học viên', color: 'var(--ds-green)' },
]

const SOURCE_LABELS: Record<string, string> = {
  google: 'Google',
  facebook: 'Facebook',
  gioi_thieu: 'Giới thiệu',
  khac: 'Khác',
}

const ACTIVITY_LABELS: Record<string, string> = {
  lien_he: 'Liên hệ',
  ghi_chu: 'Ghi chú',
  doi_giai_doan: 'Đổi giai đoạn',
  hen_lich: 'Hẹn lịch',
  chuyen_doi: 'Chuyển đổi',
  khac: 'Khác',
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const t =
    parts.length >= 2 ? parts[parts.length - 2][0] + parts[parts.length - 1][0] : name.slice(0, 2)
  return (t || '?').toUpperCase()
}

export function LeadPipelineClient({ initialCards }: { initialCards: LeadCard[] }) {
  const router = useRouter()
  const [cards, setCards] = useState<LeadCard[]>(initialCards)
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [dragId, setDragId] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const showToast = (m: string) => {
    setToast(m)
    setTimeout(() => setToast(null), 2400)
  }

  const active = cards.find((c) => c.id === activeId) ?? null
  const visible = cards.filter((c) => sourceFilter === 'all' || c.source === sourceFilter)

  const moveCard = (id: number, status: string) =>
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)))

  const commitStage = (id: number, status: LeadStage, prevStatus: string) => {
    startTransition(async () => {
      const res = await setLeadStage({ leadId: id, status })
      if (!res.ok) {
        moveCard(id, prevStatus)
        showToast(res.message)
      } else {
        showToast('Đã cập nhật giai đoạn')
        router.refresh()
      }
    })
  }

  const onDrop = (e: DragEvent, colKey: LeadStage) => {
    e.preventDefault()
    setDragOver(null)
    const id = dragId
    setDragId(null)
    if (id == null) return
    const card = cards.find((c) => c.id === id)
    if (!card || card.status === colKey) return
    const prev = card.status
    moveCard(id, colKey) // optimistic
    commitStage(id, colKey, prev)
  }

  const markUnfit = (id: number) => {
    const card = cards.find((c) => c.id === id)
    if (!card) return
    removeAndCommitUnfit(card)
  }

  const removeAndCommitUnfit = (card: LeadCard) => {
    setCards((prev) => prev.filter((c) => c.id !== card.id))
    setActiveId(null)
    startTransition(async () => {
      const res = await setLeadStage({ leadId: card.id, status: 'khong_phu_hop' })
      if (!res.ok) {
        setCards((p) => [...p, card])
        showToast(res.message)
      } else {
        showToast('Đã đánh dấu không phù hợp')
        router.refresh()
      }
    })
  }

  const convert = (id: number) => {
    startTransition(async () => {
      const res = await convertLead({ leadId: id })
      if (res.ok) {
        setCards((prev) =>
          prev.map((c) => (c.id === id ? { ...c, status: 'da_chot', converted: true } : c)),
        )
        showToast(
          res.alreadyConverted
            ? 'Lead đã được chuyển đổi trước đó'
            : 'Đã chuyển đổi → Phụ huynh + Học viên',
        )
        router.refresh()
      } else {
        showToast(res.message ?? 'Chuyển đổi thất bại')
      }
    })
  }

  return (
    <div className="ds-leadpipe">
      <div className="ds-leadpipe__head">
        <h1 className="ds-pghead__h1">Lead tư vấn</h1>
        <div className="ds-leadpipe__filters">
          {['all', 'google', 'facebook', 'gioi_thieu', 'khac'].map((s) => (
            <button
              key={s}
              type="button"
              className={'ds-chip ds-chip--btn' + (sourceFilter === s ? ' is-on' : '')}
              onClick={() => setSourceFilter(s)}
            >
              {s === 'all' ? 'Tất cả nguồn' : SOURCE_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="ds-kanban">
        {BOARD.map((col) => {
          const colCards = visible.filter((c) => c.status === col.key)
          return (
            <div
              key={col.key}
              className={'ds-kcol' + (dragOver === col.key ? ' is-dragover' : '')}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(col.key)
              }}
              onDragLeave={() => setDragOver((d) => (d === col.key ? null : d))}
              onDrop={(e) => onDrop(e, col.key)}
            >
              <div className="ds-kcol__head">
                <span className="ds-kcol__dot" style={{ background: col.color }} />
                <b>{col.name}</b>
                <span className="ds-kcol__cnt">{colCards.length}</span>
              </div>
              <div className="ds-kcol__hint">{col.hint}</div>
              <div className="ds-kcol__body">
                {colCards.map((c) => (
                  <div
                    key={c.id}
                    className={'ds-lead' + (dragId === c.id ? ' is-dragging' : '')}
                    draggable
                    onDragStart={() => setDragId(c.id)}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => setActiveId(c.id)}
                  >
                    <div className="ds-lead__top">
                      <span className="ds-lead__name">{c.fullName}</span>
                      <span className="ds-src">{SOURCE_LABELS[c.source] ?? c.source}</span>
                    </div>
                    <div className="ds-lead__phone">
                      <Phone aria-hidden />
                      {c.phone}
                    </div>
                    <div className="ds-lead__meta">
                      {c.childAge && <span className="ds-chip ds-chip--sm">{c.childAge}</span>}
                      {c.locationName && <span className="ds-tag-loc">{c.locationName}</span>}
                      {c.converted && (
                        <span className="ds-badge ds-badge--success">Đã chuyển đổi</span>
                      )}
                    </div>
                    {c.note && <div className="ds-lead__note">{c.note}</div>}
                    {c.nextFollowUpAt && (
                      <div className="ds-lead__foot">
                        <span className={'ds-lead__follow' + (c.overdue ? ' is-overdue' : '')}>
                          <Clock aria-hidden />
                          {c.overdue ? 'Quá hạn · ' : ''}
                          {fmtDateTime(c.nextFollowUpAt)}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
                {colCards.length === 0 && <div className="ds-kcol__empty">Trống</div>}
              </div>
            </div>
          )
        })}
      </div>

      {active && (
        <>
          <div className="ds-scrim" onClick={() => setActiveId(null)} aria-hidden />
          <aside className="ds-drawer" role="dialog" aria-label={`Lead ${active.fullName}`}>
            <div className="ds-drawer__head">
              <span
                className="ds-avatar"
                style={{
                  background: 'linear-gradient(140deg, var(--ds-teal), var(--ds-blue-light))',
                }}
                aria-hidden
              >
                {initials(active.fullName)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: 16, fontWeight: 800 }}>{active.fullName}</b>
                <span style={{ fontSize: 12.5, color: 'var(--ds-text-muted)' }}>
                  {active.phone}
                  {active.childAge ? ` · ${active.childAge}` : ''}
                </span>
              </div>
              <button
                type="button"
                className="ds-iconbtn"
                onClick={() => setActiveId(null)}
                aria-label="Đóng"
              >
                <X aria-hidden />
              </button>
            </div>

            <div className="ds-drawer__body">
              <div className="ds-drawer__actions">
                <a className="ds-btn ds-btn--ghost" href={`tel:${active.phone.replace(/\s/g, '')}`}>
                  <Phone aria-hidden />
                  Gọi
                </a>
                <a
                  className="ds-btn ds-btn--ghost"
                  href={`https://zalo.me/${active.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle aria-hidden />
                  Zalo
                </a>
                {!active.converted && (
                  <button
                    type="button"
                    className="ds-btn ds-btn--primary"
                    disabled={isPending}
                    onClick={() => convert(active.id)}
                  >
                    <ArrowRightLeft aria-hidden />
                    Chuyển đổi
                  </button>
                )}
              </div>

              <div className="ds-drawer__sec">
                <div className="ds-overline">Giai đoạn</div>
                <div className="ds-stagebtns">
                  {BOARD.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      className={'ds-stagebtn' + (active.status === s.key ? ' is-on' : '')}
                      disabled={isPending || active.status === s.key}
                      onClick={() => {
                        const prev = active.status
                        moveCard(active.id, s.key)
                        commitStage(active.id, s.key, prev)
                      }}
                    >
                      <span className="ds-kcol__dot" style={{ background: s.color }} />
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ds-drawer__sec">
                <div className="ds-overline">Thông tin</div>
                <dl className="ds-kvlist">
                  <div>
                    <dt>Nguồn</dt>
                    <dd>{SOURCE_LABELS[active.source] ?? active.source}</dd>
                  </div>
                  {active.locationName && (
                    <div>
                      <dt>Cơ sở quan tâm</dt>
                      <dd>{active.locationName}</dd>
                    </div>
                  )}
                  {active.nextFollowUpAt && (
                    <div>
                      <dt>Hẹn liên hệ</dt>
                      <dd className={active.overdue ? 'is-overdue' : ''}>
                        {fmtDateTime(active.nextFollowUpAt)}
                      </dd>
                    </div>
                  )}
                  {active.note && (
                    <div>
                      <dt>Ghi chú</dt>
                      <dd>{active.note}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="ds-drawer__sec">
                <div className="ds-overline">Nhật ký chăm sóc</div>
                {active.activity.length === 0 ? (
                  <p className="ds-panel__empty">Chưa có hoạt động.</p>
                ) : (
                  <ul className="ds-timeline">
                    {active.activity.map((a, i) => (
                      <li key={i} className="ds-timeline__row">
                        <span className="ds-timeline__type">
                          {ACTIVITY_LABELS[a.type] ?? a.type}
                        </span>
                        <div className="ds-timeline__body">
                          {a.note && <div className="ds-timeline__note">{a.note}</div>}
                          <div className="ds-timeline__at">{fmtDateTime(a.at)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="ds-drawer__sec">
                <button
                  type="button"
                  className="ds-btn ds-btn--ghost ds-btn--danger"
                  disabled={isPending}
                  onClick={() => markUnfit(active.id)}
                >
                  <CircleSlash aria-hidden />
                  Đánh dấu không phù hợp
                </button>
              </div>
            </div>
          </aside>
        </>
      )}

      <div className={'ds-toast' + (toast ? ' is-show' : '')}>
        {toast && (
          <>
            <CheckCircle2 aria-hidden />
            {toast}
          </>
        )}
      </div>
    </div>
  )
}

export default LeadPipelineClient
