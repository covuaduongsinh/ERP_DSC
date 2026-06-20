/**
 * Script import Huấn luyện viên / Giáo viên từ CSV vào collection `coaches`.
 *
 * Chạy:
 *   pnpm --filter web payload run scripts/import-coaches.ts <duong-dan.csv>
 *   (mặc định: sample-imports/giao-vien-ok.csv)
 *
 * Idempotent theo `tenTat`: chạy lại KHÔNG nhân đôi. In báo cáo created /
 * updated / skipped (trùng trong file) / error (thiếu/không hợp lệ) theo dòng.
 */
import fs from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { parseCsvText } from '../src/lib/spreadsheet-preview'
import { importCoaches, normalizeToken, type NormalizedRow } from '../src/lib/imports/coaches'

async function main() {
  console.error('[import-coaches] bắt đầu, argv:', process.argv.slice(2))
  const arg = process.argv[2]
  const csvPath = path.resolve(process.cwd(), arg ?? 'sample-imports/GiaoVien_da_chuan_hoa.csv')

  if (!fs.existsSync(csvPath)) {
    console.error(`✗ Không tìm thấy file CSV: ${csvPath}`)
    process.exit(1)
  }

  const text = fs.readFileSync(csvPath, 'utf-8').replace(/^﻿/, '')
  const matrix = parseCsvText(text).filter((r) => r.some((c) => c.trim() !== ''))

  if (matrix.length < 2) {
    console.error('✗ File không có dòng dữ liệu sau dòng tiêu đề.')
    process.exit(1)
  }

  const [headerRow, ...dataRows] = matrix
  const headers = headerRow.map((h) => normalizeToken(h))
  const rows: NormalizedRow[] = dataRows.map((raw) => {
    const obj: NormalizedRow = {}
    headers.forEach((h, idx) => {
      if (h) obj[h] = (raw[idx] ?? '').trim()
    })
    return obj
  })

  console.error(`[import-coaches] đọc ${rows.length} dòng dữ liệu từ ${csvPath}`)
  const payload = await getPayload({ config: await config })
  const fileName = path.basename(csvPath)
  const result = await importCoaches(payload, fileName, rows)

  // ── In báo cáo ──────────────────────────────────────────────────────
  // Ghi qua stderr (đồng bộ, không bị mất khi process thoát) thay vì stdout.
  const lines: string[] = []
  lines.push(`\n=== Import Coaches: ${result.fileName} ===`)
  lines.push(`Tổng dòng dữ liệu : ${result.totalRows}`)
  lines.push(`  ✅ Tạo mới       : ${result.created}`)
  lines.push(`  ♻️  Cập nhật      : ${result.updated}`)
  lines.push(`  ⏭️  Bỏ qua (trùng): ${result.skipped}`)
  lines.push(`  ❌ Lỗi           : ${result.errors}`)

  const problems = result.outcomes.filter((o) => o.status === 'skipped' || o.status === 'error')
  if (problems.length > 0) {
    lines.push('\n--- Dòng cần xem lại ---')
    for (const o of problems) {
      if (o.status === 'skipped') {
        lines.push(`  [dòng ${o.row}] TRÙNG: ${o.message}`)
      } else if (o.status === 'error') {
        const field = o.field ? ` (cột ${o.field})` : ''
        lines.push(`  [dòng ${o.row}] LỖI${field}: ${o.message}`)
      }
    }
  }
  process.stderr.write(lines.join('\n') + '\n')

  process.exitCode = result.errors > 0 ? 2 : 0
}

// Top-level await để `payload run` chờ script chạy xong trước khi thoát
// (nếu chỉ gọi main() rồi bỏ, harness thoát sớm khi await đầu tiên nhường CPU).
try {
  await main()
} catch (err) {
  console.error('✗ Import thất bại:', err)
  process.exitCode = 1
}
// Payload giữ pool DB mở → buộc thoát sau khi đã flush báo cáo.
process.exit(process.exitCode ?? 0)
