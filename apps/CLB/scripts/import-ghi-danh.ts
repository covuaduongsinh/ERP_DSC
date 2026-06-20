/**
 * Script import GHI DANH (học viên ↔ lớp) từ goi-y-ghi-danh.csv vào collection
 * `enrollments`. Dùng KHI luồng commit trên /admin bị timeout với file lớn:
 * script chạy qua `payload run` kết nối thẳng DB (không có giới hạn thời gian
 * của serverless Vercel) và tái dùng nguyên `importEnrollments` (cùng logic
 * khớp + idempotent với UI).
 *
 * Chạy:
 *   # Dry-run (KHÔNG ghi) — kiểm chứng trước:
 *   pnpm --filter @ds/web payload run scripts/import-ghi-danh.ts
 *   # Ghi THẬT vào DB:
 *   pnpm --filter @ds/web payload run scripts/import-ghi-danh.ts commit
 *   # CSV khác mặc định (gốc repo: ../../goi-y-ghi-danh.csv):
 *   pnpm --filter @ds/web payload run scripts/import-ghi-danh.ts commit duong-dan.csv
 *
 * Idempotent theo cặp (student, class): chạy lại KHÔNG nhân đôi (cặp đã có →
 * update `dangHoc`/ngày, chưa có → create). Không cần DDL: bảng `enrollments`
 * đã có trên prod (migration 20260601_140000).
 */
import fs from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { parseCsvText } from '../src/lib/spreadsheet-preview'
import { importEnrollments, type NormalizedRow } from '../src/lib/imports/enrollments'

/** Chuẩn hóa header → snake_case không dấu (khớp key importer mong đợi). */
function normalizeHeader(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

async function main() {
  const args = process.argv.slice(2)
  const commit = args.includes('commit')
  const pathArg = args.find((a) => a !== 'commit')
  const csvPath = path.resolve(
    process.cwd(),
    pathArg ?? path.join('..', '..', 'goi-y-ghi-danh.csv'),
  )

  console.error(`[import-ghi-danh] file: ${csvPath}`)
  console.error(`[import-ghi-danh] chế độ: ${commit ? 'COMMIT (ghi thật)' : 'DRY-RUN (không ghi)'}`)

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
  const headers = headerRow.map((h) => normalizeHeader(h))
  const rows: NormalizedRow[] = dataRows.map((raw) => {
    const obj: NormalizedRow = {}
    headers.forEach((h, idx) => {
      if (h) obj[h] = (raw[idx] ?? '').trim()
    })
    return obj
  })

  console.error(`[import-ghi-danh] đọc ${rows.length} dòng dữ liệu.`)

  const payload = await getPayload({ config: await config })
  const countEnrollments = async () =>
    (await payload.count({ collection: 'enrollments', overrideAccess: true })).totalDocs

  const before = await countEnrollments()
  const result = await importEnrollments(payload, path.basename(csvPath), rows, {
    dryRun: !commit,
  })
  const after = await countEnrollments()

  const errors = result.outcomes.filter((o) => o.status === 'error')

  const lines: string[] = []
  lines.push(`\n=== Import Ghi danh: ${result.fileName} ===`)
  lines.push(`Chế độ                   : ${commit ? 'COMMIT (đã ghi)' : 'DRY-RUN (không ghi)'}`)
  lines.push(`Tổng dòng dữ liệu        : ${result.totalRows}`)
  lines.push(`  ✅ Tạo mới             : ${result.created}`)
  lines.push(`  ♻️  Cập nhật            : ${result.updated}`)
  lines.push(`  ⏭️  Bỏ qua (trùng)      : ${result.skipped}`)
  lines.push(`  ❌ Lỗi                 : ${result.errors}`)
  lines.push(`Số enrollments trong DB  : ${before} → ${after} (chênh ${after - before})`)

  if (errors.length > 0) {
    lines.push(`\n--- Dòng lỗi (${errors.length}) ---`)
    for (const o of errors) {
      if (o.status === 'error') {
        const field = o.field ? ` (cột ${o.field})` : ''
        lines.push(`  [dòng ${o.row}] LỖI${field}: ${o.message}`)
      }
    }
  }

  process.stderr.write(lines.join('\n') + '\n')
  process.exitCode = result.errors > 0 ? 2 : 0
}

// Top-level await: `payload run` chờ script xong trước khi thoát.
try {
  await main()
} catch (err) {
  console.error('✗ Import thất bại:', err)
  process.exitCode = 1
}
// Payload giữ pool DB mở → buộc thoát sau khi đã flush báo cáo.
process.exit(process.exitCode ?? 0)
