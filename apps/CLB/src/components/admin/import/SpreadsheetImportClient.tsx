'use client'

import { Button } from '@payloadcms/ui'
import { useCallback, useId, useRef, useState } from 'react'
import {
  isAcceptedSpreadsheetFile,
  parseSpreadsheetForPreview,
  type SpreadsheetPreview,
} from '@/lib/spreadsheet-preview'
import { processImport, type ProcessImportResponse } from '@/app/actions/runImport'
import type { ImportKind } from '@/lib/imports/kinds'
import type { PreviewOutcome, PreviewResult } from '@/lib/imports/preview-types'

export type SpreadsheetImportClientProps = {
  title: string
  description: string
  keyDescription: string
  columnGuide: string[]
  importKind: ImportKind
  templateHref: string
  templateFileName: string
}

type Phase = 'idle' | 'checked' | 'done'
type Busy = null | 'checking' | 'committing'

/** Tối đa số dòng kết quả render ra bảng (ưu tiên lỗi/bỏ qua). */
const MAX_TABLE_ROWS = 400

export function SpreadsheetImportClient({
  title,
  description,
  keyDescription,
  columnGuide,
  importKind,
  templateHref,
  templateFileName,
}: SpreadsheetImportClientProps) {
  const inputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [busy, setBusy] = useState<Busy>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [rawPreview, setRawPreview] = useState<SpreadsheetPreview | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [dryResult, setDryResult] = useState<PreviewResult | null>(null)
  const [commitResult, setCommitResult] = useState<PreviewResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setPhase('idle')
    setBusy(null)
    setFile(null)
    setFileName(null)
    setRawPreview(null)
    setDryResult(null)
    setCommitResult(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0]
    setError(null)
    setRawPreview(null)
    setDryResult(null)
    setCommitResult(null)
    setPhase('idle')

    if (!selected) {
      setFile(null)
      setFileName(null)
      return
    }
    if (!isAcceptedSpreadsheetFile(selected)) {
      setError('Vui lòng chọn file .csv, .xlsx hoặc .xls.')
      setFile(null)
      setFileName(selected.name)
      return
    }

    setIsParsing(true)
    setFile(selected)
    setFileName(selected.name)
    try {
      setRawPreview(await parseSpreadsheetForPreview(selected))
    } catch (parseError) {
      setError(
        parseError instanceof Error
          ? parseError.message
          : 'Không đọc được file. Kiểm tra định dạng và thử lại.',
      )
    } finally {
      setIsParsing(false)
    }
  }, [])

  const callServer = useCallback(
    async (mode: 'preview' | 'commit'): Promise<PreviewResult | null> => {
      if (!file) {
        setError('Chưa chọn file.')
        return null
      }
      const formData = new FormData()
      formData.set('kind', importKind)
      formData.set('mode', mode)
      formData.set('file', file)
      const response: ProcessImportResponse = await processImport(formData)
      if (!response.ok) {
        setError(response.error)
        return null
      }
      return response.result
    },
    [file, importKind],
  )

  const handleCheck = useCallback(async () => {
    setBusy('checking')
    setError(null)
    try {
      const result = await callServer('preview')
      if (result) {
        setDryResult(result)
        setPhase('checked')
      }
    } catch (err) {
      setError(err instanceof Error ? `Lỗi gọi server: ${err.message}` : 'Lỗi gọi server.')
    } finally {
      setBusy(null)
    }
  }, [callServer])

  const handleCommit = useCallback(async () => {
    setBusy('committing')
    setError(null)
    try {
      const result = await callServer('commit')
      if (result) {
        setCommitResult(result)
        setPhase('done')
      }
    } catch (err) {
      setError(err instanceof Error ? `Lỗi gọi server: ${err.message}` : 'Lỗi gọi server.')
    } finally {
      setBusy(null)
    }
  }, [callServer])

  const writable = dryResult ? dryResult.created + dryResult.updated : 0

  return (
    <div className="spreadsheet-import">
      <header className="spreadsheet-import__header">
        <h1>{title}</h1>
        <p>{description}</p>
      </header>

      <section className="spreadsheet-import__guide" aria-labelledby={`${inputId}-guide`}>
        <h2 id={`${inputId}-guide`}>Cột trong file</h2>
        <ul>
          {columnGuide.map((column) => (
            <li key={column}>{column}</li>
          ))}
        </ul>
        <p className="spreadsheet-import__key">{keyDescription}</p>
        <p className="spreadsheet-import__note">
          Tải file mẫu đúng cột:{' '}
          <a href={templateHref} download={templateFileName}>
            {templateFileName}
          </a>
          . Điền dữ liệu rồi upload lại.
        </p>
      </section>

      <section className="spreadsheet-import__picker">
        <label htmlFor={inputId}>Chọn file Excel hoặc CSV</label>
        <input
          ref={fileInputRef}
          id={inputId}
          type="file"
          accept=".csv,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          onChange={handleFileChange}
          disabled={isParsing || busy !== null}
        />
        {fileName ? (
          <p className="spreadsheet-import__file">
            File đã chọn: <strong>{fileName}</strong>
            {isParsing ? ' — đang đọc…' : null}
          </p>
        ) : null}
      </section>

      {error ? (
        <p className="spreadsheet-import__error" role="alert">
          {error}
        </p>
      ) : null}

      {/* Bước 1: chọn file → xem nhanh dữ liệu thô → bấm Kiểm tra (dry-run). */}
      {rawPreview && phase === 'idle' ? (
        <section className="spreadsheet-import__preview" aria-labelledby={`${inputId}-raw`}>
          <div className="spreadsheet-import__preview-head">
            <h2 id={`${inputId}-raw`}>Xem nhanh dữ liệu</h2>
            <p>
              {rawPreview.totalRowCount} dòng dữ liệu
              {rawPreview.truncated ? ` (hiển thị ${rawPreview.rows.length} dòng đầu)` : ''}
            </p>
          </div>
          {rawPreview.headers.length === 0 ? (
            <p className="spreadsheet-import__error">File không có dòng tiêu đề hoặc dữ liệu.</p>
          ) : (
            <RawTable preview={rawPreview} />
          )}
          <div className="spreadsheet-import__actions">
            <Button
              buttonStyle="primary"
              type="button"
              disabled={busy !== null || rawPreview.totalRowCount === 0 || isParsing}
              onClick={handleCheck}
            >
              {busy === 'checking' ? 'Đang kiểm tra…' : 'Kiểm tra (xem trước)'}
            </Button>
            <Button buttonStyle="secondary" type="button" onClick={reset} disabled={busy !== null}>
              Chọn file khác
            </Button>
          </div>
        </section>
      ) : null}

      {/* Bước 2: kết quả dry-run → xác nhận ghi. */}
      {phase === 'checked' && dryResult ? (
        <section className="spreadsheet-import__result" aria-live="polite">
          <ResultBanner result={dryResult} />
          <NotesList notes={dryResult.notes} />
          <OutcomeTable result={dryResult} />
          <div className="spreadsheet-import__actions">
            <Button
              buttonStyle="primary"
              type="button"
              disabled={busy !== null || writable === 0}
              onClick={handleCommit}
            >
              {busy === 'committing' ? 'Đang ghi DB…' : `Xác nhận ghi ${writable} dòng`}
            </Button>
            <Button
              buttonStyle="secondary"
              type="button"
              onClick={handleCheck}
              disabled={busy !== null}
            >
              Kiểm tra lại
            </Button>
            <Button buttonStyle="secondary" type="button" onClick={reset} disabled={busy !== null}>
              Chọn file khác
            </Button>
          </div>
          {writable === 0 ? (
            <p className="spreadsheet-import__note">
              Không có dòng hợp lệ để ghi. Sửa các dòng lỗi trong file rồi kiểm tra lại.
            </p>
          ) : null}
        </section>
      ) : null}

      {/* Bước 3: kết quả ghi thật. */}
      {phase === 'done' && commitResult ? (
        <section className="spreadsheet-import__result" aria-live="polite">
          <ResultBanner result={commitResult} />
          <NotesList notes={commitResult.notes} />
          <OutcomeTable result={commitResult} />
          <div className="spreadsheet-import__actions">
            <Button buttonStyle="secondary" type="button" onClick={reset}>
              Nhập file khác
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  )
}

function RawTable({ preview }: { preview: SpreadsheetPreview }) {
  return (
    <div className="spreadsheet-import__table-wrap">
      <table className="spreadsheet-import__table">
        <thead>
          <tr>
            <th scope="col">#</th>
            {preview.headers.map((header) => (
              <th key={header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.rows.map((row, rowIndex) => (
            <tr key={`${rowIndex}-${row.join('|')}`}>
              <td>{rowIndex + 1}</td>
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`}>{cell || '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ResultBanner({ result }: { result: PreviewResult }) {
  const { dryRun, created, updated, skipped, errors, totalRows, fileName } = result
  const tone = errors === 0 ? 'success' : 'mixed'
  return (
    <div
      className={`spreadsheet-import__banner spreadsheet-import__banner--${
        dryRun ? 'pending' : tone
      }`}
    >
      <p>
        <strong>{fileName}</strong> — {totalRows} dòng: <strong>{created}</strong>{' '}
        {dryRun ? 'sẽ tạo mới' : 'đã tạo mới'}, <strong>{updated}</strong>{' '}
        {dryRun ? 'sẽ cập nhật' : 'đã cập nhật'}, <strong>{skipped}</strong> bỏ qua (trùng),{' '}
        <strong>{errors}</strong> lỗi.
      </p>
      {dryRun ? (
        <p>
          Đây là bản XEM TRƯỚC — chưa ghi gì vào hệ thống. Kiểm tra rồi bấm “Xác nhận ghi”. Dòng lỗi
          sẽ bị bỏ qua khi ghi.
        </p>
      ) : errors === 0 ? (
        <p>Đã ghi xong. Nhập lại cùng file sẽ chỉ cập nhật, không tạo trùng.</p>
      ) : (
        <p>Đã ghi các dòng hợp lệ. Sửa dòng lỗi rồi upload lại — dòng đã ghi không nhân đôi.</p>
      )}
    </div>
  )
}

function NotesList({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null
  return (
    <ul className="spreadsheet-import__notes">
      {notes.map((note) => (
        <li key={note}>{note}</li>
      ))}
    </ul>
  )
}

function statusLabel(status: PreviewOutcome['status'], dryRun: boolean): string {
  switch (status) {
    case 'created':
      return dryRun ? 'Sẽ tạo' : 'Đã tạo'
    case 'updated':
      return dryRun ? 'Sẽ cập nhật' : 'Đã cập nhật'
    case 'skipped':
      return 'Bỏ qua'
    case 'error':
      return 'Lỗi'
  }
}

function OutcomeTable({ result }: { result: PreviewResult }) {
  const { outcomes, dryRun } = result
  // Ưu tiên hiển thị dòng cần chú ý (lỗi + bỏ qua), rồi tới cập nhật/tạo.
  const problems = outcomes.filter((o) => o.status === 'error' || o.status === 'skipped')
  const oks = outcomes.filter((o) => o.status === 'created' || o.status === 'updated')
  const fill = Math.max(0, MAX_TABLE_ROWS - problems.length)
  const shown = [...problems, ...oks.slice(0, fill)].sort((a, b) => a.row - b.row)
  const hidden = outcomes.length - shown.length

  if (outcomes.length === 0) return null

  return (
    <>
      <div className="spreadsheet-import__table-wrap">
        <table className="spreadsheet-import__table">
          <thead>
            <tr>
              <th scope="col">Dòng</th>
              <th scope="col">Phân loại</th>
              <th scope="col">Định danh</th>
              <th scope="col">Chi tiết / lỗi</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((o) => (
              <tr key={`${o.row}-${o.status}`}>
                <td>{o.row}</td>
                <td>
                  <span className={`ds-badge ds-badge--${o.status}`}>
                    {statusLabel(o.status, dryRun)}
                  </span>
                </td>
                <td>{o.label || '—'}</td>
                <td>
                  {o.field ? <code>{o.field}</code> : null}
                  {o.field && o.detail ? ' — ' : null}
                  {o.detail ?? (o.status === 'error' || o.status === 'skipped' ? '' : '—')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hidden > 0 ? (
        <p className="spreadsheet-import__note">
          Đã hiển thị {shown.length}/{outcomes.length} dòng (ẩn {hidden} dòng tạo/cập nhật hợp lệ để
          gọn — mọi dòng lỗi/bỏ qua đều được hiện).
        </p>
      ) : null}
    </>
  )
}
