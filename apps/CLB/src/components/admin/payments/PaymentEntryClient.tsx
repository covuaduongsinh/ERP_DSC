'use client'

import { Button } from '@payloadcms/ui'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { createPayment } from '@/app/actions/createPayment'
import type { CoSo, TinhTrang } from '@/lib/payments/create'

/** Học viên rút gọn để chọn + gợi ý cơ sở. */
export interface StudentOption {
  id: number
  fullName: string
  location: string | null
  /** Gợi ý cơ sở suy từ location (staff vẫn sửa được). */
  coSo: '' | CoSo
}

export interface PaymentEntryClientProps {
  students: StudentOption[]
}

interface RecentEntry {
  paymentId: number
  label: string
}

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10)
}

/** "1200000" → "1.200.000" cho dễ đọc trong nhãn. */
function vnd(n: number): string {
  return n.toLocaleString('vi-VN')
}

/** Parse ô số: rỗng → undefined; bỏ ký tự phân cách; sai → undefined. */
function parseNum(raw: string): number | undefined {
  const cleaned = raw.replace(/[^\d.-]/g, '')
  if (cleaned === '') return undefined
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : undefined
}

export function PaymentEntryClient({ students }: PaymentEntryClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [recent, setRecent] = useState<RecentEntry[]>([])

  // Form state
  const [filter, setFilter] = useState('')
  const [studentId, setStudentId] = useState<number | ''>('')
  const [ngayNop, setNgayNop] = useState(todayInputValue())
  const [hocPhi, setHocPhi] = useState('')
  const [tienSach, setTienSach] = useState('')
  const [muaKhac, setMuaKhac] = useState('')
  const [soBuoiNop, setSoBuoiNop] = useState('')
  const [coSo, setCoSo] = useState<'' | CoSo>('')
  const [tinhTrang, setTinhTrang] = useState<TinhTrang>('da_nop')
  const [ghiChu, setGhiChu] = useState('')

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const list = q ? students.filter((s) => s.fullName.toLowerCase().includes(q)) : students
    return list.slice(0, 200) // an toàn nếu roster lớn
  }, [students, filter])

  const studentById = useMemo(() => {
    const m = new Map<number, StudentOption>()
    for (const s of students) m.set(s.id, s)
    return m
  }, [students])

  const onPickStudent = (idStr: string) => {
    const id = idStr ? Number(idStr) : ''
    setStudentId(id)
    setError(null)
    // Auto gợi ý cơ sở theo học viên (chỉ khi staff chưa tự chọn).
    if (id !== '') {
      const s = studentById.get(id)
      if (s && s.coSo) setCoSo(s.coSo)
    }
  }

  const resetForNext = () => {
    setHocPhi('')
    setTienSach('')
    setMuaKhac('')
    setSoBuoiNop('')
    setGhiChu('')
    setStudentId('')
    setFilter('')
    // Giữ ngayNop + coSo + tinhTrang để nhập loạt nhanh.
  }

  const submit = () => {
    setError(null)
    if (studentId === '') {
      setError('Chưa chọn học viên.')
      return
    }
    startTransition(async () => {
      const res = await createPayment({
        student: studentId,
        ngayNop,
        hocPhi: parseNum(hocPhi),
        tienSach: parseNum(tienSach),
        muaKhac: parseNum(muaKhac),
        soBuoiNop: parseNum(soBuoiNop),
        coSo: coSo || '',
        tinhTrang,
        ghiChu,
      })
      if (!res.ok) {
        setError(res.message)
        return
      }
      const s = studentById.get(studentId)
      const total = (parseNum(hocPhi) ?? 0) + (parseNum(tienSach) ?? 0) + (parseNum(muaKhac) ?? 0)
      setRecent((prev) => [
        {
          paymentId: res.paymentId,
          label: `${s?.fullName ?? 'HV'} — ${ngayNop} — ${vnd(total)}đ`,
        },
        ...prev,
      ])
      resetForNext()
      router.refresh()
    })
  }

  return (
    <div>
      {error ? (
        <p role="alert" className="ds-error">
          {error}
        </p>
      ) : null}

      <div className="ds-card" style={{ maxWidth: 720 }}>
        <div className="ds-formrow">
          <label className="ds-field ds-field--wide">
            Học viên
            <input
              className="ds-input"
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Gõ tên để lọc…"
              disabled={isPending}
            />
            <select
              className="ds-select"
              value={studentId === '' ? '' : String(studentId)}
              onChange={(e) => onPickStudent(e.target.value)}
              disabled={isPending}
              size={6}
              style={{ minHeight: 140 }}
            >
              <option value="">— Chọn học viên —</option>
              {filtered.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.fullName}
                  {s.location ? ` — ${s.location}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="ds-formrow">
          <label className="ds-field">
            Ngày nộp
            <input
              className="ds-input"
              type="date"
              value={ngayNop}
              onChange={(e) => setNgayNop(e.target.value)}
              disabled={isPending}
            />
          </label>
          <label className="ds-field">
            Cơ sở
            <select
              className="ds-select"
              value={coSo}
              onChange={(e) => setCoSo(e.target.value as '' | CoSo)}
              disabled={isPending}
            >
              <option value="">—</option>
              <option value="kim_lien">Kim Liên</option>
              <option value="vinh_phuc">Vĩnh Phúc</option>
            </select>
          </label>
          <label className="ds-field">
            Tình trạng
            <select
              className="ds-select"
              value={tinhTrang}
              onChange={(e) => setTinhTrang(e.target.value as TinhTrang)}
              disabled={isPending}
            >
              <option value="da_nop">Đã nộp</option>
              <option value="cho">Chờ</option>
            </select>
          </label>
        </div>

        <div className="ds-formrow">
          <label className="ds-field">
            Học phí (đ)
            <input
              className="ds-input"
              inputMode="numeric"
              value={hocPhi}
              onChange={(e) => setHocPhi(e.target.value)}
              disabled={isPending}
            />
          </label>
          <label className="ds-field">
            Tiền sách (đ)
            <input
              className="ds-input"
              inputMode="numeric"
              value={tienSach}
              onChange={(e) => setTienSach(e.target.value)}
              disabled={isPending}
            />
          </label>
          <label className="ds-field">
            Mua khác (đ)
            <input
              className="ds-input"
              inputMode="numeric"
              value={muaKhac}
              onChange={(e) => setMuaKhac(e.target.value)}
              disabled={isPending}
            />
          </label>
          <label className="ds-field">
            Số buổi nộp
            <input
              className="ds-input"
              inputMode="numeric"
              value={soBuoiNop}
              onChange={(e) => setSoBuoiNop(e.target.value)}
              disabled={isPending}
            />
          </label>
        </div>

        <label className="ds-field ds-field--wide" style={{ marginBottom: 12 }}>
          Ghi chú (tùy chọn)
          <textarea
            className="ds-input ds-input--full"
            value={ghiChu}
            onChange={(e) => setGhiChu(e.target.value)}
            disabled={isPending}
            rows={2}
          />
        </label>

        <Button
          buttonStyle="primary"
          type="button"
          disabled={isPending || studentId === ''}
          onClick={submit}
        >
          {isPending ? 'Đang lưu…' : 'Lưu phiếu thu'}
        </Button>
      </div>

      {recent.length > 0 ? (
        <section className="ds-section" style={{ marginTop: 20, maxWidth: 720 }}>
          <h2 className="ds-section__title">Đã lưu trong phiên này ({recent.length})</h2>
          <ul className="ds-samplelist">
            {recent.map((r) => (
              <li key={r.paymentId}>
                ✅ {r.label}{' '}
                <a className="ds-tbl__link" href={`/admin/collections/payments/${r.paymentId}`}>
                  (mở #{r.paymentId})
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
