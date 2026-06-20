/**
 * Sinh nội dung file xuất từ headers + rows.
 *  - CSV: papaparse (unparse). Thêm BOM UTF-8 để Excel mở đúng tiếng Việt.
 *  - XLSX: SheetJS (xlsx). Number giữ kiểu số (Excel tính tổng được).
 *
 * Chỉ chạy ở server (API route) — KHÔNG import vào client bundle.
 */
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import type { ExportCellValue } from './columns'

export type ExportFormat = 'csv' | 'xlsx'

/** null → ô trống; number/string giữ nguyên cho papaparse tự escape. */
function csvCell(value: ExportCellValue): string | number {
  return value === null || value === undefined ? '' : value
}

/** Render CSV với BOM UTF-8. */
export function toCsv(headers: string[], rows: ExportCellValue[][]): string {
  const csv = Papa.unparse(
    { fields: headers, data: rows.map((row) => row.map(csvCell)) },
    { newline: '\r\n' },
  )
  return '﻿' + csv
}

/** Render XLSX (Buffer). null → ô trống; number giữ kiểu số. */
export function toXlsx(headers: string[], rows: ExportCellValue[][], sheetName: string): Buffer {
  const aoa: Array<Array<string | number | null>> = [
    headers,
    ...rows.map((row) => row.map((cell) => (cell === undefined ? null : cell))),
  ]
  const worksheet = XLSX.utils.aoa_to_sheet(aoa)
  const workbook = XLSX.utils.book_new()
  // Tên sheet Excel tối đa 31 ký tự, không chứa : \ / ? * [ ]
  const safeSheet = sheetName.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31)
  XLSX.utils.book_append_sheet(workbook, worksheet, safeSheet)
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

/** Tên file có ngày: <base>_YYYY-MM-DD.<ext> (giờ địa phương). */
export function exportFileName(fileBase: string, format: ExportFormat): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${fileBase}_${y}-${m}-${d}.${format}`
}

export const EXPORT_CONTENT_TYPE: Record<ExportFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}
