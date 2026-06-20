/**
 * Đọc file Excel/CSV phía client — chỉ phục vụ preview UI.
 * Ghi DB / import thật do Claude Code (🔒).
 */

export type SpreadsheetPreview = {
  fileName: string
  headers: string[]
  rows: string[][]
  totalRowCount: number
  truncated: boolean
}

export const PREVIEW_ROW_LIMIT = 100

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls'] as const

export function isAcceptedSpreadsheetFile(file: File): boolean {
  const lower = file.name.toLowerCase()
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export async function parseSpreadsheetForPreview(
  file: File,
  rowLimit = PREVIEW_ROW_LIMIT,
): Promise<SpreadsheetPreview> {
  const lower = file.name.toLowerCase()

  if (lower.endsWith('.csv')) {
    return parseCsvFile(file, rowLimit)
  }

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    return parseExcelFile(file, rowLimit)
  }

  throw new Error('Chỉ hỗ trợ file .csv, .xlsx hoặc .xls.')
}

async function parseCsvFile(file: File, rowLimit: number): Promise<SpreadsheetPreview> {
  const text = await file.text()
  const matrix = parseCsvText(text)
  return matrixToPreview(file.name, matrix, rowLimit)
}

async function parseExcelFile(file: File, rowLimit: number): Promise<SpreadsheetPreview> {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })
  const sheetName = workbook.SheetNames[0]

  if (!sheetName) {
    throw new Error('File Excel không có sheet dữ liệu.')
  }

  const sheet = workbook.Sheets[sheetName]
  const rawRows = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
  })

  const matrix = rawRows.map((row) =>
    (Array.isArray(row) ? row : []).map((cell) => formatSpreadsheetCell(cell)),
  )

  return matrixToPreview(file.name, matrix, rowLimit)
}

function matrixToPreview(
  fileName: string,
  matrix: string[][],
  rowLimit: number,
): SpreadsheetPreview {
  const nonEmpty = matrix.filter((row) => row.some((cell) => cell.trim() !== ''))

  if (nonEmpty.length === 0) {
    return {
      fileName,
      headers: [],
      rows: [],
      totalRowCount: 0,
      truncated: false,
    }
  }

  const [headerRow, ...dataRows] = nonEmpty
  const headers = headerRow.map((cell, index) => {
    const trimmed = cell.trim()
    return trimmed || `Cột ${index + 1}`
  })

  const normalizedRows = dataRows.map((row) => {
    const padded = [...row]
    while (padded.length < headers.length) {
      padded.push('')
    }
    return padded.slice(0, headers.length).map((cell) => String(cell ?? '').trim())
  })

  const totalRowCount = normalizedRows.length
  const truncated = totalRowCount > rowLimit

  return {
    fileName,
    headers,
    rows: normalizedRows.slice(0, rowLimit),
    totalRowCount,
    truncated,
  }
}

function formatSpreadsheetCell(value: unknown): string {
  if (value == null) return ''
  if (value instanceof Date) {
    return value.toLocaleDateString('vi-VN')
  }
  return String(value).trim()
}

/** Parser CSV đơn giản (hỗ trợ ô có dấu phẩy trong ngoặc kép). */
export function parseCsvText(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (!inQuotes && char === ',') {
      row.push(cell)
      cell = ''
      continue
    }

    if (!inQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && next === '\n') {
        i += 1
      }
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      continue
    }

    cell += char
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  return rows.map((r) => r.map((c) => c.trim()))
}
