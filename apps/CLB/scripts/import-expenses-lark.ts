/**
 * Script import TÀI CHÍNH – vế CHI từ Lark Base.
 *
 * Nguồn: .lark-import/khoanchi.json (→ expense-categories) +
 *        .lark-import/tonghopchi.json (→ expenses)
 *        (xuất bằng .lark-import/export.py).
 * Đích : collection `expense-categories` + `expenses` (idempotent).
 *
 * Chạy (DRY-RUN mặc định, KHÔNG ghi DB):
 *   pnpm --filter @ds/web payload run scripts/import-expenses-lark.ts
 * Ghi thật (payload run nuốt flag `--`, dùng positional `commit` hoặc COMMIT=1):
 *   COMMIT=1 pnpm --filter @ds/web payload run scripts/import-expenses-lark.ts commit
 *
 * GHI CHÚ: bảng Chi trên Lark gần như TRỐNG (1 phiếu chi + 2 danh mục thật) — vế
 * CHI chủ yếu sẽ được nhập trực tiếp trên website từ nay. Script này chỉ để di
 * trú phần ít ỏi đã có + làm pipeline lặp lại được.
 */
import fs from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import {
  importExpenseCategories,
  importExpenses,
  type CategoryRow,
  type ExpenseRow,
} from '../src/lib/imports/expenses'

type KhoanChiRecord = {
  record_id: string
  name: string | null
  mo_ta: string | null
  ghi_chu: string | null
}
type TongHopChiRecord = {
  record_id: string
  thuoc_khoan: string[] | null
  so_tien: number | string | null
  ngay_chi: string | null
  nguoi_nhan: string[] | string | null
  httt: string[] | string | null
  ky_hieu: string | null
}

const DIR = path.resolve(process.cwd(), '..', '..', '.lark-import')

function readJson<T>(file: string): T {
  const p = path.join(DIR, file)
  if (!fs.existsSync(p)) {
    console.error(`✗ Không tìm thấy ${p}. Chạy: python .lark-import/export.py`)
    process.exit(1)
  }
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as T
}

function s(v: unknown): string {
  if (v == null) return ''
  if (Array.isArray(v)) return v.length ? String(v[0]) : ''
  return String(v)
}

async function main() {
  const commit =
    process.argv.includes('--commit') ||
    process.argv.includes('commit') ||
    process.env.COMMIT === '1'

  const khoanchi = readJson<KhoanChiRecord[]>('khoanchi.json')
  const tonghopchi = readJson<TongHopChiRecord[]>('tonghopchi.json')

  const catRows: CategoryRow[] = khoanchi.map((k) => ({
    larkId: k.record_id,
    name: k.name ?? undefined,
    description: k.mo_ta ?? k.ghi_chu ?? undefined,
  }))

  const expRows: ExpenseRow[] = tonghopchi.map((t) => ({
    larkId: t.record_id,
    categoryLarkId: t.thuoc_khoan && t.thuoc_khoan.length ? t.thuoc_khoan[0] : undefined,
    amountRaw: s(t.so_tien),
    spentAtRaw: s(t.ngay_chi).slice(0, 10), // "2024-10-01 00:00:00" → "2024-10-01"
    nguoiNhan: s(t.nguoi_nhan),
    httt: s(t.httt),
    kyHieu: t.ky_hieu ?? undefined,
  }))

  console.error(
    `[import-expenses-lark] danh mục: ${catRows.length} (có tên: ${catRows.filter((c) => c.name && c.name.trim()).length}) | phiếu chi: ${expRows.length} | chế độ: ${commit ? 'GHI THẬT' : 'DRY-RUN'}`,
  )

  const payload = await getPayload({ config: await config })

  const catRes = await importExpenseCategories(payload, catRows, { dryRun: !commit })
  const expRes = await importExpenses(payload, 'Tổng hợp Chi — Lark', expRows, catRes.idByLarkId, {
    dryRun: !commit,
  })

  const lines: string[] = []
  lines.push(`\n=== Import CHI (${commit ? 'GHI THẬT' : 'DRY-RUN'}) ===`)
  lines.push(`Danh mục chi:`)
  lines.push(`  ✅ ${commit ? 'Tạo mới' : 'SẼ tạo'}     : ${catRes.created}`)
  lines.push(`  ♻️  ${commit ? 'Cập nhật' : 'SẼ cập nhật'}: ${catRes.updated}`)
  lines.push(`  ⏭️  Bỏ qua (trống/trùng): ${catRes.skipped}`)
  lines.push(`  ❌ Lỗi      : ${catRes.errors}`)
  lines.push(`Phiếu chi (tổng ${expRes.totalRows}):`)
  lines.push(`  ✅ ${commit ? 'Tạo mới' : 'SẼ tạo'}     : ${expRes.created}`)
  lines.push(`  ♻️  ${commit ? 'Cập nhật' : 'SẼ cập nhật'}: ${expRes.updated}`)
  lines.push(`  ⏭️  Bỏ qua  : ${expRes.skipped}`)
  lines.push(`  ❌ Lỗi      : ${expRes.errors}`)

  const reviews = expRes.outcomes.filter((o) => o.status === 'error' || o.status === 'skipped')
  if (reviews.length > 0) {
    lines.push(`\n--- Phiếu chi cần soát (${reviews.length}) ---`)
    for (const o of reviews) {
      if (o.status === 'error')
        lines.push(`  [dòng ${o.row}] LỖI${o.field ? ` (${o.field})` : ''}: ${o.message}`)
      else if (o.status === 'skipped') lines.push(`  [dòng ${o.row}] BỎ QUA: ${o.message}`)
    }
  }

  process.stderr.write(lines.join('\n') + '\n')
  process.exitCode = 0
}

try {
  await main()
} catch (err) {
  console.error('✗ Import thất bại:', err)
  process.exitCode = 1
}
process.exit(process.exitCode ?? 0)
