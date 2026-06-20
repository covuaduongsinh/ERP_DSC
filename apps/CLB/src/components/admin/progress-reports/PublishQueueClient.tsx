'use client'

import { Button } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useState, useTransition } from 'react'
import {
  publishProgressReports,
  type PublishProgressReportsActionResult,
} from '@/app/actions/publishProgressReports'

/** Một dòng nháp để hiển thị — đã rút gọn từ ProgressReport ở phía server. */
export interface DraftReportRow {
  id: number
  studentName: string
  period: string
  levelLabel: string | null
  coachName: string | null
  updatedAt: string
}

export interface PublishQueueClientProps {
  initialDrafts: DraftReportRow[]
  /** true nếu danh sách bị cắt bớt (còn nháp ngoài trang này). */
  truncated: boolean
}

type Phase = 'select' | 'confirm' | 'done'

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('vi-VN')
}

export function PublishQueueClient({ initialDrafts, truncated }: PublishQueueClientProps) {
  const router = useRouter()
  const [drafts, setDrafts] = useState<DraftReportRow[]>(initialDrafts)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [phase, setPhase] = useState<Phase>('select')
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<PublishProgressReportsActionResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const allSelected = drafts.length > 0 && selected.size === drafts.length
  const selectedCount = selected.size

  const selectedIds = useMemo(() => Array.from(selected), [selected])

  const toggleOne = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelected((prev) =>
      prev.size === drafts.length ? new Set() : new Set(drafts.map((d) => d.id)),
    )
  }, [drafts])

  const handlePublish = useCallback(() => {
    setError(null)
    setResult(null)
    startTransition(async () => {
      const response = await publishProgressReports({
        ids: selectedIds,
        confirm: true,
      })
      setResult(response)
      if (!response.ok) {
        setError(response.message)
        setPhase('select')
        return
      }
      // Bỏ khỏi danh sách những báo cáo đã xử lý xong (phát hành / đã phát hành
      // trước đó) — chúng không còn là nháp nữa.
      const resolved = new Set([...response.publishedIds, ...response.alreadyPublishedIds])
      setDrafts((prev) => prev.filter((d) => !resolved.has(d.id)))
      setSelected(new Set())
      setPhase('done')
      // Đồng bộ lại badge hàng đợi / số liệu khác trong admin.
      router.refresh()
    })
  }, [router, selectedIds])

  if (drafts.length === 0 && phase !== 'done') {
    return (
      <p className="ds-muted">
        Không còn báo cáo nháp nào. Mọi báo cáo đã được phát hành cho phụ huynh.
      </p>
    )
  }

  return (
    <div>
      {error ? (
        <p role="alert" className="ds-error">
          {error}
        </p>
      ) : null}

      {phase === 'done' && result?.ok ? (
        <div aria-live="polite" className="ds-notice ds-notice--success">
          <p className="ds-notice__title">Đã phát hành {result.published} báo cáo cho phụ huynh.</p>
          {result.alreadyPublishedIds.length > 0 ? (
            <p>
              {result.alreadyPublishedIds.length} báo cáo đã được phát hành từ trước — bỏ qua, không
              phát hành lại.
            </p>
          ) : null}
          {result.notFoundIds.length > 0 ? (
            <p>{result.notFoundIds.length} báo cáo không còn truy cập được — bỏ qua.</p>
          ) : null}
          {drafts.length > 0 ? <p>Vẫn còn {drafts.length} báo cáo nháp bên dưới.</p> : null}
        </div>
      ) : null}

      {phase === 'confirm' ? (
        <div className="ds-notice ds-notice--warning">
          <p className="ds-notice__title">Phát hành {selectedCount} báo cáo cho phụ huynh?</p>
          <p>
            Phụ huynh sẽ thấy ngay các báo cáo này trong cổng phụ huynh. Hãy chắc chắn nội dung đã
            hoàn thiện trước khi phát hành.
          </p>
          <div className="ds-btnrow">
            <Button
              buttonStyle="primary"
              type="button"
              disabled={isPending}
              onClick={handlePublish}
            >
              {isPending ? 'Đang phát hành…' : `Xác nhận phát hành ${selectedCount} báo cáo`}
            </Button>
            <Button
              buttonStyle="secondary"
              type="button"
              disabled={isPending}
              onClick={() => setPhase('select')}
            >
              Hủy
            </Button>
          </div>
        </div>
      ) : null}

      {drafts.length > 0 ? (
        <>
          {phase === 'select' ? (
            <div className="ds-toolbar">
              <Button
                buttonStyle="primary"
                type="button"
                disabled={selectedCount === 0 || isPending}
                onClick={() => {
                  setError(null)
                  setPhase('confirm')
                }}
              >
                {selectedCount === 0
                  ? 'Phát hành (chưa chọn)'
                  : `Phát hành ${selectedCount} báo cáo…`}
              </Button>
              <span className="ds-muted">
                {drafts.length} báo cáo nháp
                {truncated ? ' (hiển thị một phần — phát hành bớt rồi tải lại)' : ''}
              </span>
            </div>
          ) : null}

          <div className="ds-tbl-wrap">
            <table className="ds-tbl">
              <thead>
                <tr>
                  <th scope="col" style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      aria-label="Chọn tất cả"
                      checked={allSelected}
                      onChange={toggleAll}
                      disabled={phase !== 'select' || isPending}
                    />
                  </th>
                  <th scope="col">Học viên</th>
                  <th scope="col">Kỳ báo cáo</th>
                  <th scope="col">Cấp độ</th>
                  <th scope="col">HLV</th>
                  <th scope="col">Cập nhật</th>
                  <th scope="col">Mở</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Chọn báo cáo ${row.studentName} — ${row.period}`}
                        checked={selected.has(row.id)}
                        onChange={() => toggleOne(row.id)}
                        disabled={phase !== 'select' || isPending}
                      />
                    </td>
                    <td>{row.studentName}</td>
                    <td>{row.period}</td>
                    <td>{row.levelLabel ?? '—'}</td>
                    <td>{row.coachName ?? '—'}</td>
                    <td>{formatDate(row.updatedAt)}</td>
                    <td>
                      <a
                        className="ds-tbl__link"
                        href={`/admin/collections/progress-reports/${row.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Xem
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  )
}
