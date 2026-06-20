'use client'

import { Button } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { updateSessionContentAction } from '@/app/actions/sessionFeedback'
import { listTemplatesAction, loadTemplateAction } from '@/app/actions/curriculum'
import type { TemplateLesson, TemplateSummary } from '@/lib/operations/curriculum-templates'

/** Nội dung buổi (cấp lớp) — 5 field text trên `class-sessions`. */
export interface ClassContentValue {
  mucTieu: string | null
  kienThucMoi: string | null
  giaoBTVN: string | null
  khBuoiSau: string | null
  sachDangHoc: string | null
}

/**
 * Editor NỘI DUNG BUỔI (cấp lớp) cho một `class-sessions`. Lưu qua
 * `updateSessionContentAction` (overrideAccess:false + actor ⇒ branch-scope là
 * hàng rào: chỉ sửa được buổi cùng cơ sở). Dùng chung cho trang Nhận xét buổi và
 * trang Lập kế hoạch buổi học.
 *
 * `enableTemplateFill` (V2.1): hiện khối "Điền từ khung lộ trình" cho phép chọn 1
 * khung + 1 bài BẤT KỲ rồi điền nội dung bài đó vào các ô (linh hoạt, theo từng
 * buổi — khác "Áp khung" hàng loạt map cứng bài N↔buổi N). Chỉ prefill form; người
 * dùng sửa rồi bấm Lưu. `khBuoiSau` không bị đụng.
 */
export function ClassContentEditor({
  sessionId,
  content,
  enableTemplateFill = false,
}: {
  sessionId: number
  content: ClassContentValue
  enableTemplateFill?: boolean
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    mucTieu: content.mucTieu ?? '',
    kienThucMoi: content.kienThucMoi ?? '',
    giaoBTVN: content.giaoBTVN ?? '',
    khBuoiSau: content.khBuoiSau ?? '',
    sachDangHoc: content.sachDangHoc ?? '',
  })
  const [saving, startSave] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const set = (k: keyof typeof form, v: string) => {
    setForm((p) => ({ ...p, [k]: v }))
    setSaved(false)
  }

  const onSave = () => {
    setError(null)
    startSave(async () => {
      const res = await updateSessionContentAction(sessionId, {
        mucTieu: form.mucTieu || null,
        kienThucMoi: form.kienThucMoi || null,
        giaoBTVN: form.giaoBTVN || null,
        khBuoiSau: form.khBuoiSau || null,
        sachDangHoc: form.sachDangHoc || null,
      })
      if (!res.ok) {
        setError(res.message)
        return
      }
      setSaved(true)
      router.refresh()
    })
  }

  /** Điền 4 ô từ một bài mẫu — bỏ qua ô bài để trống (tránh xóa nội dung đang gõ). */
  const fillFromLesson = (lesson: TemplateLesson) => {
    setForm((p) => ({
      ...p,
      mucTieu: lesson.mucTieu ?? p.mucTieu,
      sachDangHoc: lesson.sachDangHoc ?? p.sachDangHoc,
      kienThucMoi: lesson.kienThucMoi ?? p.kienThucMoi,
      giaoBTVN: lesson.giaoBTVN ?? p.giaoBTVN,
    }))
    setSaved(false)
  }

  return (
    <fieldset
      style={{ border: '1px solid var(--theme-elevation-150)', borderRadius: 6, padding: 12 }}
    >
      <legend style={{ padding: '0 6px', fontWeight: 600 }}>Nội dung buổi (cả lớp)</legend>
      {error && (
        <p role="alert" className="ds-error" style={{ margin: '0 0 8px' }}>
          {error}
        </p>
      )}
      {saved && (
        <p aria-live="polite" className="ds-success" style={{ margin: '0 0 8px' }}>
          Đã lưu nội dung buổi.
        </p>
      )}

      {enableTemplateFill && <TemplateFillPicker onFill={fillFromLesson} disabled={saving} />}

      <label className="ds-field" style={{ display: 'block' }}>
        Mục tiêu
        <textarea
          className="ds-input ds-input--full"
          rows={2}
          value={form.mucTieu}
          onChange={(e) => set('mucTieu', e.target.value)}
          disabled={saving}
        />
      </label>
      <label className="ds-field" style={{ display: 'block', marginTop: 8 }}>
        Sách đang học
        <input
          className="ds-input ds-input--full"
          type="text"
          value={form.sachDangHoc}
          onChange={(e) => set('sachDangHoc', e.target.value)}
          disabled={saving}
        />
      </label>
      <label className="ds-field" style={{ display: 'block', marginTop: 8 }}>
        Kiến thức mới
        <textarea
          className="ds-input ds-input--full"
          rows={2}
          value={form.kienThucMoi}
          onChange={(e) => set('kienThucMoi', e.target.value)}
          disabled={saving}
        />
      </label>
      <label className="ds-field" style={{ display: 'block', marginTop: 8 }}>
        Giao BTVN
        <textarea
          className="ds-input ds-input--full"
          rows={2}
          value={form.giaoBTVN}
          onChange={(e) => set('giaoBTVN', e.target.value)}
          disabled={saving}
        />
      </label>
      <label className="ds-field" style={{ display: 'block', marginTop: 8 }}>
        Kế hoạch buổi sau
        <textarea
          className="ds-input ds-input--full"
          rows={2}
          value={form.khBuoiSau}
          onChange={(e) => set('khBuoiSau', e.target.value)}
          disabled={saving}
        />
      </label>
      <div style={{ marginTop: 10 }}>
        <Button buttonStyle="primary" type="button" disabled={saving} onClick={onSave}>
          {saving ? 'Đang lưu…' : 'Lưu nội dung buổi'}
        </Button>
      </div>
    </fieldset>
  )
}

/**
 * Khối "Điền từ khung lộ trình" (V2.1) — chọn 1 khung + 1 bài BẤT KỲ rồi điền nội
 * dung bài đó vào ô của buổi. Tái dùng `listTemplatesAction`/`loadTemplateAction`
 * (không server action mới). Chỉ điền form; KHÔNG tự lưu.
 */
function TemplateFillPicker({
  onFill,
  disabled,
}: {
  onFill: (lesson: TemplateLesson) => void
  disabled: boolean
}) {
  const [open, setOpen] = useState(false)
  const [templates, setTemplates] = useState<TemplateSummary[] | null>(null)
  const [templateId, setTemplateId] = useState<number>(0)
  const [lessons, setLessons] = useState<TemplateLesson[] | null>(null)
  const [lessonIdx, setLessonIdx] = useState<number>(0)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, startBusy] = useTransition()

  // Nạp danh sách khung (đang dùng) khi mở khối lần đầu.
  useEffect(() => {
    if (!open || templates !== null) return
    startBusy(async () => {
      const res = await listTemplatesAction({ onlyActive: true })
      if (!res.ok) {
        setTemplates([])
        setMsg(res.message)
        return
      }
      setTemplates(res.templates)
      if (res.templates[0]) setTemplateId(res.templates[0].id)
    })
  }, [open, templates])

  // Nạp bài của khung đã chọn.
  useEffect(() => {
    if (!open || !templateId) return
    startBusy(async () => {
      const res = await loadTemplateAction(templateId)
      if (!res.ok) {
        setLessons([])
        setMsg(res.message)
        return
      }
      setLessons(res.template.baiHoc)
      setLessonIdx(0)
      setMsg(null)
    })
  }, [open, templateId])

  const onFillClick = () => {
    const lesson = lessons?.[lessonIdx]
    if (!lesson) return
    onFill(lesson)
    setMsg('Đã điền nội dung bài vào các ô bên dưới — kiểm tra rồi bấm “Lưu nội dung buổi”.')
  }

  if (!open) {
    return (
      <div style={{ marginBottom: 10 }}>
        <Button
          buttonStyle="secondary"
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          Điền từ khung lộ trình…
        </Button>
      </div>
    )
  }

  return (
    <div
      style={{
        border: '1px dashed var(--theme-elevation-200)',
        borderRadius: 6,
        padding: 10,
        marginBottom: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        <strong>Điền từ khung lộ trình</strong>
        <button type="button" className="ds-tbl__link" onClick={() => setOpen(false)}>
          Đóng
        </button>
      </div>
      {templates && templates.length === 0 ? (
        <p className="ds-muted" style={{ margin: 0 }}>
          Chưa có khung lộ trình nào (đang dùng). Tạo khung ở trang{' '}
          <strong>Soạn khung lộ trình</strong>.
        </p>
      ) : (
        <>
          <div
            className="ds-formrow"
            style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}
          >
            <label className="ds-field" style={{ flex: '1 1 200px' }}>
              Khung
              <select
                className="ds-select"
                value={templateId}
                onChange={(e) => setTemplateId(Number(e.target.value))}
                disabled={disabled || busy}
              >
                {(templates ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.tenKhung}
                    {t.capDo ? ` · ${t.capDo}` : ''} · {t.soBai} bài
                  </option>
                ))}
              </select>
            </label>
            <label className="ds-field" style={{ flex: '1 1 220px' }}>
              Bài
              <select
                className="ds-select"
                value={lessonIdx}
                onChange={(e) => setLessonIdx(Number(e.target.value))}
                disabled={disabled || busy || !lessons?.length}
              >
                {(lessons ?? []).map((l, i) => (
                  <option key={i} value={i}>
                    Bài {i + 1}
                    {l.tieuDe ? ` · ${l.tieuDe}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <Button
              buttonStyle="secondary"
              type="button"
              disabled={disabled || busy || !lessons?.length}
              onClick={onFillClick}
            >
              Điền vào ô bên dưới
            </Button>
          </div>
          <p className="ds-muted" style={{ margin: '6px 0 0' }}>
            Điền <strong>Mục tiêu · Sách · Kiến thức mới · Giao BTVN</strong> từ bài đã chọn (ô bài
            trống thì giữ nguyên). “Kế hoạch buổi sau” không bị đụng.
          </p>
        </>
      )}
      {msg && (
        <p aria-live="polite" className="ds-success" style={{ margin: '6px 0 0' }}>
          {msg}
        </p>
      )}
    </div>
  )
}

export default ClassContentEditor
