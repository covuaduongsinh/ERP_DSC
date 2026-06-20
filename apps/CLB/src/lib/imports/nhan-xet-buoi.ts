import type { Payload } from 'payload'
import type { ImportOptions } from './types'

/**
 * Import idempotent NHẬN XÉT BUỔI HỌC vào collection `attendance` từ file
 * NhanXetBuoi_long.csv.
 *
 * KHÓA ĐỊNH DANH (chống trùng): cột `khoa` = `co_so|buoi|ten_hoc_vien`. Chạy
 * lại cùng file KHÔNG nhân đôi: khóa đã có → update, chưa có → create. Hai dòng
 * cùng khóa trong CÙNG file → dòng sau ghi đè, dòng đó bị đánh dấu `skipped`.
 *
 * GẮN QUAN HỆ:
 * - student: khớp theo TÊN (`ten_hoc_vien`) — bỏ dấu, không phân biệt hoa/thường.
 *   Không khớp (0 hoặc >1 ứng viên) → KHÔNG ghi được (student bắt buộc) và tính
 *   vào "lệch link" (studentLinkMissing).
 * - coach: khớp theo TÊN TẮT (`gv_phu_trach` ↔ `coaches.tenTat`). Không khớp →
 *   vẫn ghi bản ghi nhưng để coach trống và tính vào "lệch link" (coachLinkMissing).
 *
 * Module KHÔNG `import 'server-only'` để dùng được ở cả Server Action lẫn script
 * CLI (`payload run`). Quyền ghi đã kiểm ở lớp gọi; thao tác DB dùng overrideAccess.
 */

export type NormalizedRow = Record<string, string>

export type NhanXetRowOutcome =
  | { row: number; status: 'created'; khoa: string; studentId: number; coachLinked: boolean }
  | { row: number; status: 'updated'; khoa: string; studentId: number; coachLinked: boolean }
  | { row: number; status: 'skipped'; khoa: string; message: string }
  | {
      row: number
      status: 'error'
      message: string
      field?: string
      khoa?: string
      /** Phân loại lệch link để báo cáo tách bạch. */
      linkMiss?: 'student' | 'coach'
    }

export type NhanXetImportResult = {
  fileName: string
  totalRows: number
  created: number
  updated: number
  skipped: number
  errors: number
  /** Số dòng không khớp được học viên (không ghi được). */
  studentLinkMissing: number
  /** Số bản ghi đã ghi nhưng GV phụ trách không khớp tenTat. */
  coachLinkMissing: number
  outcomes: NhanXetRowOutcome[]
}

/** Bỏ dấu tiếng Việt, đ→d, lower-case, gộp khoảng trắng (giữ ranh giới từ). */
export function normalizeName(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Chuẩn hóa GIỮ DẤU (chỉ lower-case + gộp khoảng trắng) — dùng để gỡ nhập nhằng
 * khi nhiều học viên trùng tên-không-dấu. Vd "Lê Thanh Hưng" ≠ "Lê Thành Hưng":
 * normalizeName gộp chung, normalizeExact phân biệt. Xem [[reference_vn_name_dedup]].
 */
export function normalizeExact(input: string): string {
  return input.normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ')
}

/** Bỏ dấu + mọi ký tự không phải [a-z0-9] → token gọn (cho tenTat). */
export function normalizeToken(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '')
}

function pick(row: NormalizedRow, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = row[k]
    if (v != null && v.trim() !== '') return v.trim()
  }
  return undefined
}

/**
 * Parse "Làm BTVN" về số. File chứa lẫn lộn: "1", "0.5", "0,5", "1/2", "'1/5",
 * "1+", "1-", "-1" (số) và "đã làm", "không mang", "Quyên: đã làm" (chữ — bỏ
 * qua, trả null, KHÔNG báo lỗi dòng).
 */
export function parseLamBTVN(raw: string): number | null {
  const s = raw.replace(/^'/, '').trim().replace(',', '.')
  if (!s) return null
  const frac = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(s)
  if (frac) {
    const d = Number(frac[2])
    return d === 0 ? null : Number(frac[1]) / d
  }
  const num = /^([+-]?\d+(?:\.\d+)?)\s*[+-]?$/.exec(s)
  if (num) {
    const n = Number(num[1])
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * Parse "Ý thức" (1–10). Lấy số nguyên đầu chuỗi ("8 (còn ăn kẹo...)" → 8).
 * Ngoài khoảng 1..10 ("11", "13") → null (bỏ qua, không báo lỗi).
 */
export function parseYThuc(raw: string): number | null {
  const m = /^\s*'?\s*(\d+)/.exec(raw)
  if (!m) return null
  const n = Number(m[1])
  return n >= 1 && n <= 10 ? n : null
}

/** Lấy id GV theo tenTat từ ô gv_phu_trach (có thể chứa nhiều tên/ghi chú). */
function matchCoach(
  rawGv: string | undefined,
  coachByTenTat: Map<string, number>,
): { has: boolean; coachId: number | null } {
  if (!rawGv) return { has: false, coachId: null }
  // Tách theo dấu phẩy / xuống dòng, thử khớp từng mảnh theo thứ tự.
  const parts = rawGv
    .split(/[,\n/]/)
    .map((p) => normalizeToken(p))
    .filter(Boolean)
  for (const p of parts) {
    const id = coachByTenTat.get(p)
    if (id != null) return { has: true, coachId: id }
  }
  return { has: true, coachId: null } // có ghi GV nhưng không khớp tenTat
}

type StudentRef = { id: number; fullName: string }

async function buildStudentIndex(payload: Payload): Promise<Map<string, StudentRef[]>> {
  const res = await payload.find({
    collection: 'students',
    pagination: false,
    overrideAccess: true,
    depth: 0,
  })
  const map = new Map<string, StudentRef[]>()
  for (const s of res.docs) {
    const fullName = String((s as { fullName?: string }).fullName ?? '')
    const key = normalizeName(fullName)
    if (!key) continue
    const arr = map.get(key) ?? []
    arr.push({ id: s.id as number, fullName })
    map.set(key, arr)
  }
  return map
}

/**
 * Khớp 1 tên trong CSV với roster:
 *  - 1 ứng viên (không-dấu) → chốt luôn.
 *  - nhiều ứng viên → thử khớp CHÍNH XÁC giữ dấu để gỡ nhập nhằng
 *    (vd "Lê Thành Hưng" vs "Lê Thanh Hưng"); đúng 1 → chốt, còn lại → mơ hồ.
 */
function matchStudent(
  ten: string,
  index: Map<string, StudentRef[]>,
): { ok: true; id: number } | { ok: false; count: number } {
  const cand = index.get(normalizeName(ten)) ?? []
  if (cand.length === 1) return { ok: true, id: cand[0].id }
  if (cand.length === 0) return { ok: false, count: 0 }
  const want = normalizeExact(ten)
  const exact = cand.filter((c) => normalizeExact(c.fullName) === want)
  if (exact.length === 1) return { ok: true, id: exact[0].id }
  return { ok: false, count: cand.length }
}

async function buildCoachIndex(payload: Payload): Promise<Map<string, number>> {
  const res = await payload.find({
    collection: 'coaches',
    pagination: false,
    overrideAccess: true,
    depth: 0,
  })
  const map = new Map<string, number>()
  for (const c of res.docs) {
    const id = c.id as number
    const tenTat = (c as { tenTat?: string }).tenTat
    if (tenTat) map.set(normalizeToken(tenTat), id)
    // Bí danh tên tắt (ngăn cách bởi dấu phẩy) — gom nhiều cách viết về một GV.
    const alias = (c as { tenTatAlias?: string }).tenTatAlias
    if (alias) {
      for (const a of alias.split(',')) {
        const tok = normalizeToken(a)
        if (tok && !map.has(tok)) map.set(tok, id)
      }
    }
  }
  return map
}

export async function importNhanXetBuoi(
  payload: Payload,
  fileName: string,
  rows: NormalizedRow[],
  opts: ImportOptions = {},
): Promise<NhanXetImportResult> {
  const dryRun = opts.dryRun ?? false
  const result: NhanXetImportResult = {
    fileName,
    totalRows: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    studentLinkMissing: 0,
    coachLinkMissing: 0,
    outcomes: [],
  }

  const record = (o: NhanXetRowOutcome) => {
    result.outcomes.push(o)
    if (o.status === 'created') result.created += 1
    else if (o.status === 'updated') result.updated += 1
    else if (o.status === 'skipped') result.skipped += 1
    else result.errors += 1
  }

  const studentIndex = await buildStudentIndex(payload)
  const coachIndex = await buildCoachIndex(payload)
  const seenInFile = new Set<string>()

  for (let i = 0; i < rows.length; i += 1) {
    const rowNumber = i + 1 // 1-based, không kể header
    const row = rows[i]

    const coSo = pick(row, 'co_so') ?? ''
    const buoi = pick(row, 'buoi') ?? ''
    const tenHV = pick(row, 'ten_hoc_vien', 'ho_ten') ?? ''

    // Khóa idempotent: ưu tiên cột khoa có sẵn, nếu thiếu thì tái dựng.
    const khoa = pick(row, 'khoa') ?? `${coSo}|${buoi}|${tenHV}`
    if (!tenHV || !buoi) {
      record({
        row: rowNumber,
        status: 'error',
        khoa,
        message: 'Thiếu buoi hoặc ten_hoc_vien — không tạo được khóa định danh.',
        field: !tenHV ? 'ten_hoc_vien' : 'buoi',
      })
      continue
    }

    if (seenInFile.has(khoa)) {
      record({
        row: rowNumber,
        status: 'skipped',
        khoa,
        message: `Trùng khóa "${khoa}" với dòng trước trong cùng file — dòng sau ghi đè, đánh dấu bỏ qua.`,
      })
      // Vẫn cho upsert ghi đè bên dưới? Không: bỏ qua để dòng đầu là nguồn sự thật.
      continue
    }
    seenInFile.add(khoa)

    // 1) Khớp học viên theo tên (gỡ nhập nhằng bằng khớp chính xác giữ dấu)
    const matched = matchStudent(tenHV, studentIndex)
    if (!matched.ok) {
      result.studentLinkMissing += 1
      record({
        row: rowNumber,
        status: 'error',
        khoa,
        linkMiss: 'student',
        message:
          matched.count === 0
            ? `Không khớp học viên tên "${tenHV}" (chưa có trong hệ thống).`
            : `Có ${matched.count} học viên trùng tên "${tenHV}" — không xác định được. Cần mã học viên để chốt.`,
        field: 'ten_hoc_vien',
      })
      continue
    }
    const studentId = matched.id

    // 2) Khớp GV theo tenTat (không khớp vẫn ghi, chỉ tính lệch link)
    const rawGv = pick(row, 'gv_phu_trach', 'gv', 'coach')
    const coach = matchCoach(rawGv, coachIndex)
    const coachLinked = coach.coachId != null
    if (coach.has && !coachLinked) result.coachLinkMissing += 1

    // 3) Ngày học (bắt buộc — Attendance.date required)
    const rawDate = pick(row, 'ngay_hoc', 'ngay', 'date')
    const date = rawDate ? parseDateString(rawDate) : null
    if (!date) {
      record({
        row: rowNumber,
        status: 'error',
        khoa,
        message: `Ngày học "${rawDate ?? ''}" trống/không hợp lệ (cần YYYY-MM-DD hoặc DD/MM/YYYY).`,
        field: 'ngay_hoc',
      })
      continue
    }

    // 4) Các field nhận xét
    const data: Record<string, unknown> = {
      student: studentId,
      date,
      // Không có cột trạng thái trong file nhận xét → mặc định "Có mặt"
      // (có nhận xét buổi ⇒ học viên có tham gia). Nhập tay vẫn sửa được.
      status: 'co_mat',
      khoa,
      buoi,
      coach: coach.coachId,
      nhanXet: pick(row, 'nhan_xet') ?? null,
      kienThucMoi: pick(row, 'kien_thuc_moi') ?? null,
      giaoBTVN: pick(row, 'giao_btvn') ?? null,
      khBuoiSau: pick(row, 'kh_buoi_sau') ?? null,
      sachDangHoc: pick(row, 'sach_dang_hoc') ?? null,
      linkLichess: pick(row, 'link_lichess', 'lichess') ?? null,
      note: pick(row, 'ghi_chu', 'note') ?? null,
    }
    const rawLam = pick(row, 'lam_btvn')
    data.lamBTVN = rawLam ? parseLamBTVN(rawLam) : null
    const rawY = pick(row, 'y_thuc')
    data.yThuc = rawY ? parseYThuc(rawY) : null

    // 5) Idempotent upsert theo khoa
    try {
      const existing = await payload.find({
        collection: 'attendance',
        where: { khoa: { equals: khoa } },
        limit: 1,
        overrideAccess: true,
        depth: 0,
      })

      // Cast: data field-set xây động theo dòng CSV; Payload generics yêu cầu
      // type literal sát collection. overrideAccess: true → bỏ qua field access;
      // runtime validation (required date/status, min/max yThuc) vẫn chạy.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const writeData = data as any
      if (existing.totalDocs > 0) {
        const doc = existing.docs[0]
        // dryRun: chỉ phân loại "sẽ cập nhật", KHÔNG ghi DB.
        if (!dryRun) {
          await payload.update({
            collection: 'attendance',
            id: doc.id,
            data: writeData,
            overrideAccess: true,
          })
        }
        record({ row: rowNumber, status: 'updated', khoa, studentId, coachLinked })
      } else {
        // dryRun: chỉ phân loại "sẽ tạo mới", KHÔNG ghi DB.
        if (!dryRun) {
          await payload.create({
            collection: 'attendance',
            data: writeData,
            overrideAccess: true,
          })
        }
        record({ row: rowNumber, status: 'created', khoa, studentId, coachLinked })
      }
    } catch (err) {
      record({
        row: rowNumber,
        status: 'error',
        khoa,
        message: err instanceof Error ? err.message : 'Lỗi không xác định khi ghi DB.',
      })
    }
  }

  return result
}

/**
 * Parse ngày phổ biến từ Excel/LARK → ISO `YYYY-MM-DD`, hoặc null.
 * (Bản gọn nội bộ để module không phụ thuộc 'server-only' parse.ts.)
 */
export function parseDateString(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(trimmed)
  if (iso) return formatYMD(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(trimmed)
  if (dmy) {
    let year = Number(dmy[3])
    if (year < 100) year += 2000
    return formatYMD(year, Number(dmy[2]), Number(dmy[1]))
  }
  const ts = Date.parse(trimmed)
  if (!Number.isNaN(ts)) {
    const dt = new Date(ts)
    return formatYMD(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
  }
  return null
}

function formatYMD(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null
  }
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
