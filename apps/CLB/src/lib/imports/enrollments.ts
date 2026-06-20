import type { Payload } from 'payload'
import type { ImportOptions } from './types'
import { lookupStudent } from './student-lookup'

/**
 * Import idempotent GHI DANH (học viên ↔ lớp) vào collection `enrollments`.
 *
 * KHÓA ĐỊNH DANH: cặp (student, class). Chạy lại cùng file KHÔNG nhân đôi: cặp đã
 * có → update `dangHoc` (+ngày nếu có), chưa có → create.
 *
 * Học viên khớp qua `lookupStudent` (id / tên / tên+SĐT phụ huynh). Lớp khớp theo
 * Tên lớp (phải đã tồn tại — nhập Lớp trước). Thao tác DB `overrideAccess: true`.
 */

export type NormalizedRow = Record<string, string>

export type EnrollmentRowOutcome =
  | { row: number; status: 'created'; label: string; studentId: number; classId: number }
  | { row: number; status: 'updated'; label: string; studentId: number; classId: number }
  | { row: number; status: 'skipped'; label: string; message: string }
  | { row: number; status: 'error'; message: string; field?: string }

export type EnrollmentImportResult = {
  fileName: string
  totalRows: number
  created: number
  updated: number
  skipped: number
  errors: number
  outcomes: EnrollmentRowOutcome[]
}

function normalizeToken(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function pick(row: NormalizedRow, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = row[k]
    if (v != null && v.trim() !== '') return v.trim()
  }
  return undefined
}

const FALSE_TOKENS = new Set(['khong', 'no', 'false', '0', 'da_nghi', 'nghi', 'off'])

/** Parse YYYY-MM-DD hoặc DD/MM/YYYY → ISO (UTC nửa đêm); null nếu sai. */
function parseDate(raw: string): string | null {
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw.trim())
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toISOString()
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim())
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])).toISOString()
  return null
}

export async function importEnrollments(
  payload: Payload,
  fileName: string,
  rows: NormalizedRow[],
  opts: ImportOptions = {},
): Promise<EnrollmentImportResult> {
  const dryRun = opts.dryRun ?? false
  const result: EnrollmentImportResult = {
    fileName,
    totalRows: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    outcomes: [],
  }
  const record = (o: EnrollmentRowOutcome) => {
    result.outcomes.push(o)
    if (o.status === 'created') result.created += 1
    else if (o.status === 'updated') result.updated += 1
    else if (o.status === 'skipped') result.skipped += 1
    else result.errors += 1
  }

  // Nạp Lớp một lần để khớp theo Tên lớp.
  const classes = await payload.find({
    collection: 'classes',
    limit: 2000,
    overrideAccess: true,
    depth: 0,
  })
  const matchClass = (title: string): { id: number; title: string } | null => {
    const t = normalizeToken(title)
    const c = classes.docs.find((cl) => normalizeToken(String(cl.title ?? '')) === t)
    return c ? { id: c.id as number, title: String(c.title ?? '') } : null
  }

  // Nạp TOÀN BỘ ghi danh hiện có MỘT lần vào Map `"studentId|classId" → id` để
  // tra trùng tại bộ nhớ — bỏ ~N truy vấn `find` từng cặp (giảm timeout commit
  // file lớn). depth:0 ⇒ quan hệ trả id số trực tiếp.
  const existingMap = new Map<string, number>()
  for (let page = 1; ; page += 1) {
    const batch = await payload.find({
      collection: 'enrollments',
      limit: 1000,
      page,
      overrideAccess: true,
      depth: 0,
    })
    for (const d of batch.docs) {
      const sid =
        typeof d.student === 'number' ? d.student : (d.student as { id?: number } | null)?.id
      const cid = typeof d.class === 'number' ? d.class : (d.class as { id?: number } | null)?.id
      if (typeof sid === 'number' && typeof cid === 'number')
        existingMap.set(`${sid}|${cid}`, d.id as number)
    }
    if (!batch.hasNextPage) break
  }

  const seenInFile = new Set<string>()

  for (let i = 0; i < rows.length; i += 1) {
    const rowNumber = i + 1
    const row = rows[i]

    const tenHocVien = pick(row, 'ten_hoc_vien', 'hoc_vien', 'ho_ten', 'ten')
    const maHocVien = pick(row, 'ma_hoc_vien', 'mahocvien', 'id_hoc_vien')
    const sdtPh = pick(row, 'sdt_phu_huynh', 'sdt_ph', 'sdt')
    const tenLopRaw = pick(row, 'ten_lop', 'tenlop', 'lop', 'class')

    if (!tenLopRaw) {
      record({
        row: rowNumber,
        status: 'error',
        message: 'Thiếu Tên lớp (ten_lop).',
        field: 'ten_lop',
      })
      continue
    }
    // Một ô có thể chứa NHIỀU lớp (1 HV học nhiều lớp), ngăn bằng `;` hoặc `|`.
    const lopNames = tenLopRaw
      .split(/[;|]/)
      .map((s) => s.trim())
      .filter((s) => s !== '')
    if (lopNames.length === 0) {
      record({
        row: rowNumber,
        status: 'error',
        message: 'Thiếu Tên lớp (ten_lop).',
        field: 'ten_lop',
      })
      continue
    }

    // Lookup HV MỘT lần/dòng (dùng chung cho mọi lớp trong ô).
    const lookup = await lookupStudent({
      payload,
      studentCode: maHocVien,
      fullName: tenHocVien,
      parentPhone: sdtPh,
    })
    if (!lookup.ok) {
      record({ row: rowNumber, status: 'error', message: lookup.error, field: lookup.field })
      continue
    }
    const studentId = lookup.studentId
    const hvLabel = tenHocVien ?? maHocVien ?? String(studentId)

    const rawDangHoc = pick(row, 'dang_hoc', 'danghoc', 'active')
    const dangHoc = rawDangHoc ? !FALSE_TOKENS.has(normalizeToken(rawDangHoc)) : true
    const rawNgay = pick(row, 'ngay_bat_dau', 'ngaybatdau', 'start_date')
    const ngayIso = rawNgay ? parseDate(rawNgay) : null

    // Mỗi lớp trong ô → một ghi danh + một dòng kết quả.
    for (const lopName of lopNames) {
      const cls = matchClass(lopName)
      if (!cls) {
        record({
          row: rowNumber,
          status: 'error',
          message: `Lớp "${lopName}" chưa có trong hệ thống (nhập Lớp trước).`,
          field: 'ten_lop',
        })
        continue
      }
      const label = `${hvLabel} → ${cls.title}`

      const dedupeKey = `${studentId}|${cls.id}`
      if (seenInFile.has(dedupeKey)) {
        record({
          row: rowNumber,
          status: 'skipped',
          label,
          message: 'Trùng (học viên + lớp) — bỏ qua.',
        })
        continue
      }
      seenInFile.add(dedupeKey)

      const data: Record<string, unknown> = { student: studentId, class: cls.id, dangHoc }
      if (ngayIso) data.ngayBatDau = ngayIso

      try {
        const existingId = existingMap.get(dedupeKey)
        if (existingId != null) {
          if (!dryRun) {
            await payload.update({
              collection: 'enrollments',
              id: existingId,
              data,
              overrideAccess: true,
            })
          }
          record({ row: rowNumber, status: 'updated', label, studentId, classId: cls.id })
        } else if (dryRun) {
          record({ row: rowNumber, status: 'created', label, studentId, classId: cls.id })
        } else {
          const created = await payload.create({
            collection: 'enrollments',
            data: data as never,
            overrideAccess: true,
          })
          existingMap.set(dedupeKey, created.id as number)
          record({ row: rowNumber, status: 'created', label, studentId, classId: cls.id })
        }
      } catch (err) {
        record({
          row: rowNumber,
          status: 'error',
          message: `${label}: ${err instanceof Error ? err.message : 'Lỗi không xác định khi ghi DB.'}`,
        })
      }
    }
  }

  return result
}
