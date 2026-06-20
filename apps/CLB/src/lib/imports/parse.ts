import 'server-only'
import * as XLSX from 'xlsx'
import { parseCsvText } from '@/lib/spreadsheet-preview'
import type { NormalizedRow } from './types'

/**
 * Đọc file Excel/CSV phía server cho luồng import thật.
 *
 * Chú ý: KHÔNG dựa vào preview client; client preview chỉ phục vụ UX. Server
 * tự parse lại để chống sửa giả mạo dữ liệu giữa client → server.
 */
export async function parseSpreadsheetServer(
  file: File,
): Promise<{ headers: string[]; rows: NormalizedRow[] }> {
  const lower = file.name.toLowerCase()
  const buffer = await file.arrayBuffer()

  let matrix: string[][]
  if (lower.endsWith('.csv')) {
    const text = new TextDecoder('utf-8').decode(buffer)
    matrix = parseCsvText(text)
  } else if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    matrix = parseExcelMatrix(buffer)
  } else {
    throw new Error('Chỉ hỗ trợ file .csv, .xlsx hoặc .xls.')
  }

  const nonEmpty = matrix.filter((row) => row.some((cell) => cell.trim() !== ''))
  if (nonEmpty.length === 0) {
    return { headers: [], rows: [] }
  }

  const [headerRow, ...dataRows] = nonEmpty
  const headers = headerRow.map((cell) => normalizeHeader(cell))

  const rows: NormalizedRow[] = dataRows.map((raw) => {
    const obj: NormalizedRow = {}
    headers.forEach((header, idx) => {
      if (!header) return
      const cell = raw[idx]
      obj[header] = cell == null ? '' : String(cell).trim()
    })
    return obj
  })

  return { headers, rows }
}

function parseExcelMatrix(buffer: ArrayBuffer): string[][] {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new Error('File Excel không có sheet dữ liệu.')
  }
  const sheet = workbook.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false, // chuyển date → chuỗi theo cellDates
  })

  return rawRows.map((row) => (Array.isArray(row) ? row : []).map((cell) => formatCell(cell)))
}

function formatCell(value: unknown): string {
  if (value == null) return ''
  if (value instanceof Date) {
    // YYYY-MM-DD để parseDateString xử lý dễ
    const y = value.getFullYear()
    const m = String(value.getMonth() + 1).padStart(2, '0')
    const d = String(value.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return String(value)
}

/**
 * Chuẩn hóa header: lower-case, bỏ dấu tiếng Việt, đổi khoảng trắng → "_".
 * Cho phép nhân viên đặt cột là "Mã học viên", "MA_HOC_VIEN", "ma hoc vien"
 * đều map về cùng một khóa `ma_hoc_vien`.
 */
export function normalizeHeader(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/**
 * Lấy giá trị từ row theo danh sách alias header (dùng để hỗ trợ tên cột
 * khác nhau giữa các file export LARK/Excel khác nhau).
 */
export function pick(row: NormalizedRow, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = row[k]
    if (v != null && v !== '') return v
  }
  return undefined
}

/**
 * Parse ngày theo các định dạng phổ biến từ Excel/LARK:
 *  - YYYY-MM-DD, YYYY/MM/DD
 *  - DD/MM/YYYY, D/M/YYYY, DD-MM-YYYY
 *  - DD/MM/YY (giả định 20YY)
 * Trả ISO date `YYYY-MM-DD` hoặc null nếu không parse được.
 */
export function parseDateString(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // ISO: YYYY-MM-DD hoặc YYYY/MM/DD
  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(trimmed)
  if (iso) {
    const [, y, m, d] = iso
    return formatYMD(Number(y), Number(m), Number(d))
  }

  // DD/MM/YYYY hoặc DD-MM-YYYY (cũng chấp DD.MM.YYYY)
  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(trimmed)
  if (dmy) {
    const [, d, m, y] = dmy
    let year = Number(y)
    if (year < 100) year += 2000
    return formatYMD(year, Number(m), Number(d))
  }

  // Fallback: thử Date.parse — tránh nhận chuỗi sai
  const ts = Date.parse(trimmed)
  if (!Number.isNaN(ts)) {
    const dt = new Date(ts)
    return formatYMD(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
  }

  return null
}

function formatYMD(y: number, m: number, d: number): string | null {
  if (
    !Number.isInteger(y) ||
    !Number.isInteger(m) ||
    !Number.isInteger(d) ||
    m < 1 ||
    m > 12 ||
    d < 1 ||
    d > 31 ||
    y < 1900 ||
    y > 2100
  ) {
    return null
  }
  // Kiểm thực tế ngày hợp lệ (vd 31/02)
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null
  }
  const mm = String(m).padStart(2, '0')
  const dd = String(d).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}
