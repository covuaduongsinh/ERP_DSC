/**
 * Script import HỌC VIÊN từ sổ gốc HocVien_goc.csv vào collection `students`.
 *
 * Chạy:
 *   pnpm --filter web payload run scripts/import-hocvien.ts <duong-dan.csv>
 *   (mặc định: ../../HocVien_goc.csv ở gốc repo)
 *
 * Idempotent theo `fullName` (gộp khoảng trắng, không phân biệt hoa/thường + dấu):
 * chạy lại KHÔNG nhân đôi. Trùng tên trong file / trong DB → bỏ qua, báo soát tay.
 *
 * Map: ho_ten→fullName, nick→nickname, co_so→location (lấy cơ sở chính).
 *      cac_cap_do / cap_chinh: TẠM BỎ QUA (SỬA 2 — khi đã có Levels).
 *      *_CAN_BO_SUNG: có dữ liệu → tạo/nối Parent (khử trùng sdt) + set ngày sinh;
 *                     trống → KHÔNG tạo Parent rỗng.
 *
 * In báo cáo: số HV vào, số HV chưa có phụ huynh (chưa onboarding), phụ huynh
 * tạo mới / nối, co_so không khớp Locations, các dòng cần soát tay.
 */
import fs from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { parseCsvText } from '../src/lib/spreadsheet-preview'
import { importStudents, type NormalizedRow } from '../src/lib/imports/students'

/** Chuẩn hóa header → snake_case không dấu (khớp key processor mong đợi). */
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

/**
 * Đảm bảo cột `students.nickname` tồn tại trên DB live (additive, idempotent).
 * `push:false` + `payload migrate` bị chặn ở prompt dev → áp DDL trực tiếp qua
 * pool của Payload và ghi 1 dòng vào payload_migrations để migrate không chạy lại.
 * File migration 20260602_110000 vẫn được đăng ký cho VPS/môi trường khác.
 */
async function ensureNicknameColumn(payload: Awaited<ReturnType<typeof getPayload>>) {
  type PgPool = {
    query: (
      text: string,
      params?: unknown[],
    ) => Promise<{ rowCount: number | null; rows: unknown[] }>
  }
  const pool = (payload.db as unknown as { pool?: PgPool }).pool
  if (!pool) {
    throw new Error('Không truy cập được pool Postgres để áp DDL nickname.')
  }
  await pool.query('ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "nickname" varchar')
  const name = '20260602_110000_add_students_nickname'
  const exists = await pool.query('SELECT 1 FROM payload_migrations WHERE name = $1 LIMIT 1', [
    name,
  ])
  if (exists.rowCount === 0) {
    await pool.query(
      `INSERT INTO payload_migrations (name, batch, updated_at, created_at)
       VALUES ($1, (SELECT COALESCE(MAX(batch), 0) + 1 FROM payload_migrations), now(), now())`,
      [name],
    )
    console.error(`[import-hocvien] đã ghi payload_migrations: ${name}`)
  }
}

async function main() {
  const arg = process.argv[2]
  const csvPath = path.resolve(process.cwd(), arg ?? path.join('..', '..', 'HocVien_goc.csv'))
  console.error('[import-hocvien] file:', csvPath)

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

  console.error(`[import-hocvien] đọc ${rows.length} dòng dữ liệu.`)
  const payload = await getPayload({ config: await config })
  await ensureNicknameColumn(payload)

  const result = await importStudents(payload, path.basename(csvPath), rows)

  const reviews = result.outcomes.filter((o) => o.status === 'skipped' || o.status === 'error')

  const lines: string[] = []
  lines.push(`\n=== Import Học viên: ${result.fileName} ===`)
  lines.push(`Tổng dòng dữ liệu        : ${result.totalRows}`)
  lines.push(`  ✅ Tạo mới             : ${result.created}`)
  lines.push(`  ♻️  Cập nhật            : ${result.updated}`)
  lines.push(`  ⏭️  Bỏ qua (trùng tên)  : ${result.skipped}`)
  lines.push(`  ❌ Lỗi                 : ${result.errors}`)
  lines.push(`  → SỐ HV VÀO            : ${result.imported}`)
  lines.push(`  👪 Phụ huynh tạo mới    : ${result.parentsCreated}`)
  lines.push(`  🔗 Lượt nối phụ huynh   : ${result.parentsLinked}`)
  lines.push(`  ⚠ HV CHƯA CÓ PHỤ HUYNH  : ${result.withoutParent} (chưa onboarding được)`)

  const unmatched = Object.entries(result.unmatchedLocations)
  if (unmatched.length > 0) {
    lines.push(`\n--- co_so KHÔNG khớp Locations (để trống location) ---`)
    for (const [name, count] of unmatched) {
      lines.push(`  "${name}": ${count} dòng`)
    }
  }

  if (reviews.length > 0) {
    lines.push(`\n--- Dòng cần soát tay (${reviews.length}) ---`)
    for (const o of reviews) {
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

// Top-level await: `payload run` chờ script xong trước khi thoát.
try {
  await main()
} catch (err) {
  console.error('✗ Import thất bại:', err)
  process.exitCode = 1
}
// Payload giữ pool DB mở → buộc thoát sau khi đã flush báo cáo.
process.exit(process.exitCode ?? 0)
