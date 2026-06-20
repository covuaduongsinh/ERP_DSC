import type { Payload } from 'payload'
import type { ImportOptions } from './types'

/**
 * Import idempotent danh sách Huấn luyện viên / Giáo viên vào collection
 * `coaches` từ file GiaoVien_da_chuan_hoa.csv.
 *
 * KHÓA ĐỊNH DANH: `tenTat` (tên tắt) — chống trùng. Chạy lại cùng file KHÔNG
 * nhân đôi: dòng đã có → update, chưa có → create.
 *
 * Báo cáo theo dòng: created / updated / skipped (trùng tenTat trong cùng file)
 * / error (thiếu tenTat, vai trò / trạng thái / elo không hợp lệ).
 *
 * Module này KHÔNG `import 'server-only'` để dùng được cả ở Server Action lẫn
 * script CLI (`payload run`). Quyền ghi đã được kiểm ở lớp gọi; mọi thao tác DB
 * dùng `overrideAccess: true`.
 */

export type NormalizedRow = Record<string, string>

export type CoachRowOutcome =
  | { row: number; status: 'created'; tenTat: string; coachId: number }
  | { row: number; status: 'updated'; tenTat: string; coachId: number }
  | { row: number; status: 'skipped'; tenTat: string; message: string }
  | { row: number; status: 'error'; message: string; field?: string }

export type CoachImportResult = {
  fileName: string
  totalRows: number
  created: number
  updated: number
  skipped: number
  errors: number
  outcomes: CoachRowOutcome[]
}

type VaiTro = 'gv' | 'tro_giang' | 'tap_su'
type TrangThai = 'dang_day' | 'nghi'

/** Bỏ dấu tiếng Việt, lower-case, gộp khoảng trắng/ký tự → '_'. */
export function normalizeToken(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/** Lấy giá trị đầu tiên không rỗng theo danh sách alias header (đã normalize). */
function pick(row: NormalizedRow, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = row[k]
    if (v != null && v.trim() !== '') return v.trim()
  }
  return undefined
}

const VAI_TRO_ALIASES: Record<string, VaiTro> = {
  gv: 'gv',
  giao_vien: 'gv',
  hlv: 'gv',
  tro_giang: 'tro_giang',
  tg: 'tro_giang',
  // "trợ giảng (đang thực tập)" → vẫn là vai trò Trợ giảng (phần "đang thực
  // tập" là chú thích trạng thái, xem TRANG_THAI_ALIASES).
  tro_giang_dang_thuc_tap: 'tro_giang',
  tap_su: 'tap_su',
  ts: 'tap_su',
}

const TRANG_THAI_ALIASES: Record<string, TrangThai> = {
  dang_day: 'dang_day',
  dang_lam: 'dang_day',
  active: 'dang_day',
  nghi: 'nghi',
  da_nghi: 'nghi',
  nghi_viec: 'nghi',
  inactive: 'nghi',
  // "Đang thực tập" → coi là Nghỉ (chưa chính thức đứng lớp).
  dang_thuc_tap: 'nghi',
}

export async function importCoaches(
  payload: Payload,
  fileName: string,
  rows: NormalizedRow[],
  opts: ImportOptions = {},
): Promise<CoachImportResult> {
  const dryRun = opts.dryRun ?? false
  const result: CoachImportResult = {
    fileName,
    totalRows: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    outcomes: [],
  }

  const record = (o: CoachRowOutcome) => {
    result.outcomes.push(o)
    if (o.status === 'created') result.created += 1
    else if (o.status === 'updated') result.updated += 1
    else if (o.status === 'skipped') result.skipped += 1
    else result.errors += 1
  }

  // Theo dõi tenTat đã xử lý trong CÙNG file để báo trùng (không ghi đè lẫn nhau).
  const seenInFile = new Set<string>()

  for (let i = 0; i < rows.length; i += 1) {
    const rowNumber = i + 1 // 1-based, không kể header
    const row = rows[i]

    // 1) tenTat — khóa bắt buộc
    const tenTat = pick(row, 'ten_tat', 'tentat', 'ma', 'ma_gv')
    if (!tenTat) {
      record({
        row: rowNumber,
        status: 'error',
        message: 'Thiếu Tên tắt (tenTat) — không thể định danh để import.',
        field: 'tenTat',
      })
      continue
    }

    const dedupeKey = normalizeToken(tenTat)
    if (seenInFile.has(dedupeKey)) {
      record({
        row: rowNumber,
        status: 'skipped',
        tenTat,
        message: `Trùng Tên tắt "${tenTat}" với dòng trước trong cùng file — bỏ qua để không nhân đôi.`,
      })
      continue
    }
    seenInFile.add(dedupeKey)

    // 2) Các field còn lại
    const hoTen = pick(row, 'ho_ten', 'hoten', 'ho_va_ten', 'ten')
    const sdt = pick(row, 'sdt', 'so_dien_thoai', 'dien_thoai', 'phone')
    const email = pick(row, 'email', 'mail', 'e_mail')
    const rawElo = pick(row, 'elo')
    const rawVaiTro = pick(row, 'vai_tro', 'vaitro', 'chuc_vu')
    const rawTrangThai = pick(row, 'trang_thai', 'trangthai', 'tinh_trang')

    let vaiTro: VaiTro | undefined
    if (rawVaiTro) {
      vaiTro = VAI_TRO_ALIASES[normalizeToken(rawVaiTro)]
      if (!vaiTro) {
        record({
          row: rowNumber,
          status: 'error',
          message: `Vai trò "${rawVaiTro}" không hợp lệ. Dùng: GV | Trợ giảng | Tập sự.`,
          field: 'vaiTro',
        })
        continue
      }
    }

    let trangThai: TrangThai | undefined
    if (rawTrangThai) {
      trangThai = TRANG_THAI_ALIASES[normalizeToken(rawTrangThai)]
      if (!trangThai) {
        record({
          row: rowNumber,
          status: 'error',
          message: `Trạng thái "${rawTrangThai}" không hợp lệ. Dùng: Đang dạy | Nghỉ.`,
          field: 'trangThai',
        })
        continue
      }
    }

    let elo: number | undefined
    if (rawElo) {
      const n = Number(rawElo.replace(/[^0-9.-]/g, ''))
      if (!Number.isFinite(n)) {
        record({
          row: rowNumber,
          status: 'error',
          message: `Elo "${rawElo}" không phải số hợp lệ.`,
          field: 'elo',
        })
        continue
      }
      elo = n
    }

    // 3) Idempotent upsert theo tenTat
    try {
      const existing = await payload.find({
        collection: 'coaches',
        where: { tenTat: { equals: tenTat } },
        limit: 1,
        overrideAccess: true,
        depth: 0,
      })

      // Chỉ cập nhật các field có mặt trong file (tránh xóa dữ liệu đã nhập tay).
      const hrData: Record<string, unknown> = {}
      if (hoTen !== undefined) hrData.hoTen = hoTen
      if (sdt !== undefined) hrData.sdt = sdt
      if (email !== undefined) hrData.email = email
      if (elo !== undefined) hrData.elo = elo
      if (vaiTro !== undefined) hrData.vaiTro = vaiTro
      if (trangThai !== undefined) hrData.trangThai = trangThai

      if (existing.totalDocs > 0) {
        const doc = existing.docs[0]
        // dryRun: chỉ phân loại "sẽ cập nhật", KHÔNG ghi DB.
        if (!dryRun) {
          await payload.update({
            collection: 'coaches',
            id: doc.id,
            data: hrData,
            overrideAccess: true,
          })
        }
        record({ row: rowNumber, status: 'updated', tenTat, coachId: doc.id })
      } else if (dryRun) {
        // Chưa tạo nên chưa có id thật → 0 (chỉ dùng để xem trước).
        record({ row: rowNumber, status: 'created', tenTat, coachId: 0 })
      } else {
        const created = await payload.create({
          collection: 'coaches',
          data: {
            tenTat,
            // `name` (tên hiển thị công khai) bắt buộc → suy ra từ hoTen, fallback tenTat.
            name: hoTen ?? tenTat,
            ...hrData,
          },
          overrideAccess: true,
        })
        record({ row: rowNumber, status: 'created', tenTat, coachId: created.id })
      }
    } catch (err) {
      record({
        row: rowNumber,
        status: 'error',
        message: err instanceof Error ? err.message : 'Lỗi không xác định khi ghi DB.',
      })
    }
  }

  return result
}
