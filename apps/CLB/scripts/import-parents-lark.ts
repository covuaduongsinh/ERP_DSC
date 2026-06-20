/**
 * Script import PHỤ HUYNH từ Lark Base — bảng "Contact".
 *
 * Nguồn: .lark-import/contact.json + hocvien.json (xuất bằng .lark-import/export.py).
 * Đích : collection `parents` (importParents — idempotent theo phone, gắn con
 *        hai chiều với Students).
 *
 * Chạy (DRY-RUN mặc định, KHÔNG ghi DB):
 *   pnpm --filter @ds/web payload run scripts/import-parents-lark.ts
 * Ghi thật vào DB (payload run nuốt flag `--`, dùng positional `commit` hoặc COMMIT=1):
 *   COMMIT=1 pnpm --filter @ds/web payload run scripts/import-parents-lark.ts commit
 *
 * Contact KHÔNG có SĐT → bỏ qua (Parents.phone bắt buộc + unique = login). Con
 * (Tên con số 1/2) resolve qua link → HocVien.Học viên → khớp Students theo tên.
 */
import fs from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { importParents, type ParentImportRow } from '../src/lib/imports/parents'

type ContactRecord = {
  record_id: string
  full_name: string | null
  phone: string | null
  email: string | null
  zalo: string | null
  con1: string[] | null
  con2: string[] | null
}
type HocVienRecord = { record_id: string; name: string | null }

const DIR = path.resolve(process.cwd(), '..', '..', '.lark-import')

function readJson<T>(file: string): T {
  const p = path.join(DIR, file)
  if (!fs.existsSync(p)) {
    console.error(`✗ Không tìm thấy ${p}. Chạy: python .lark-import/export.py`)
    process.exit(1)
  }
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as T
}

async function main() {
  // `payload run` nuốt flag dạng `--commit`; nhận thêm positional `commit` + env.
  const commit =
    process.argv.includes('--commit') ||
    process.argv.includes('commit') ||
    process.env.COMMIT === '1'
  const contacts = readJson<ContactRecord[]>('contact.json')
  const hocvien = readJson<HocVienRecord[]>('hocvien.json')
  const hvMap = new Map<string, string>()
  for (const h of hocvien) hvMap.set(h.record_id, (h.name ?? '').trim())

  const rows: ParentImportRow[] = contacts.map((c) => {
    const childIds = [...(c.con1 ?? []), ...(c.con2 ?? [])]
    const childrenNames = childIds
      .map((id) => hvMap.get(id) ?? '')
      .map((n) => n.trim())
      .filter((n) => n.length > 0)
    return {
      fullName: (c.full_name ?? '').trim(),
      phone: (c.phone ?? '').trim(),
      email: (c.email ?? '').trim() || undefined,
      zaloId: (c.zalo ?? '').trim() || undefined,
      childrenNames,
    }
  })

  console.error(
    `[import-parents-lark] ${rows.length} contact | có SĐT: ${rows.filter((r) => r.phone).length} | chế độ: ${commit ? 'GHI THẬT' : 'DRY-RUN'}`,
  )

  const payload = await getPayload({ config: await config })
  const result = await importParents(payload, 'Contact — Lark', rows, {
    dryRun: !commit,
  })

  const lines: string[] = []
  lines.push(`\n=== Import Phụ huynh: ${result.fileName} (${commit ? 'GHI THẬT' : 'DRY-RUN'}) ===`)
  lines.push(`Tổng contact            : ${result.totalRows}`)
  lines.push(`  ✅ ${commit ? 'Tạo mới' : 'SẼ tạo'}            : ${result.created}`)
  lines.push(`  ♻️  ${commit ? 'Cập nhật' : 'SẼ cập nhật'}       : ${result.updated}`)
  lines.push(`  ⏭️  Bỏ qua             : ${result.skipped}`)
  lines.push(`     ↳ thiếu SĐT        : ${result.missingPhone} (cần bổ sung tay)`)
  lines.push(`  ❌ Lỗi                 : ${result.errors}`)
  lines.push(`  🔗 Lượt gắn con        : ${result.childrenLinked}`)

  const childMiss = Object.entries(result.childrenMissing)
  if (childMiss.length > 0) {
    lines.push(`\n--- Tên con KHÔNG khớp Students (${childMiss.length}) — soát tay ---`)
    for (const [name, count] of childMiss) {
      lines.push(`  "${name}"${count > 1 ? ` ×${count}` : ''}`)
    }
  }

  const errs = result.outcomes.filter((o) => o.status === 'error')
  if (errs.length > 0) {
    lines.push(`\n--- Dòng lỗi (${errs.length}) ---`)
    for (const o of errs) {
      if (o.status === 'error') {
        lines.push(`  [dòng ${o.row}] LỖI${o.field ? ` (${o.field})` : ''}: ${o.message}`)
      }
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
