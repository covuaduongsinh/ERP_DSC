import type { ImportKind } from './kinds'

/**
 * Kiểu kết quả CHUNG cho luồng import (dùng cả ở Server Action lẫn UI client).
 *
 * Tách riêng khỏi `run.ts` (module 'server-only') để client component import
 * được type mà không kéo theo phụ thuộc server.
 */

export type PreviewStatus = 'created' | 'updated' | 'skipped' | 'error'

export type PreviewOutcome = {
  row: number
  status: PreviewStatus
  /** Định danh người-đọc-được của dòng (tên / khóa). */
  label: string
  /** Thông điệp lỗi / cảnh báo mềm. */
  detail?: string
  /** Cột gây lỗi (nếu có). */
  field?: string
}

export type PreviewResult = {
  kind: ImportKind
  fileName: string
  /** true ⇒ chỉ xem trước, chưa ghi DB. */
  dryRun: boolean
  totalRows: number
  /** Số dòng SẼ tạo (dryRun) hoặc ĐÃ tạo (commit). */
  created: number
  updated: number
  skipped: number
  errors: number
  outcomes: PreviewOutcome[]
  /** Ghi chú tổng kết riêng từng loại (đã có phụ huynh chưa, GV lệch link…). */
  notes: string[]
}
