/**
 * Script import NHẬN XÉT MỖI BUỔI 2024 từ Lark → collection `attendance`.
 *
 * Bối cảnh: web `attendance` đã có 2025 + 2026 (nhập trước qua NhanXetBuoi_long.csv)
 * nhưng CHƯA có 2024. Script này GỘP nốt năm 2024 về cùng một bảng `attendance`
 * (web = nguồn sự thật duy nhất, bỏ mô hình tách-bảng-theo-năm của Lark).
 *
 * Nguồn: .lark-import/nhanxet2024.json + hocvien.json + giaovien.json
 *        (xuất bằng .lark-import/export.py).
 * Đích : `attendance` qua `importNhanXetBuoi` — idempotent theo khóa
 *        `co_so|buoi|ten_hoc_vien`. Bảng 2024 KHÔNG có "mã buổi" như CSV cũ ⇒
 *        dùng RECORD_ID 2024 làm `buoi` (ổn định, duy nhất ⇒ idempotent, không
 *        đụng khóa 2025/2026).
 *
 * Chạy (DRY-RUN mặc định, KHÔNG ghi DB):
 *   pnpm --filter @ds/web payload run scripts/import-nhanxet-2024-lark.ts
 * Ghi thật (payload run nuốt `--`, dùng positional `commit` hoặc COMMIT=1):
 *   COMMIT=1 pnpm --filter @ds/web payload run scripts/import-nhanxet-2024-lark.ts commit
 *
 * KHỚP: student theo TÊN (resolve link Tên HS → HocVien.name), coach theo tenTat
 * (resolve link GV → GiaoVien.Ten_tat → coaches.tenTat). status mặc định 'co_mat'
 * (giống cách 2025/2026 đã nhập; cột "có mặt" 2024 là select rác, bỏ qua).
 */
import fs from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { importNhanXetBuoi, type NormalizedRow } from '../src/lib/imports/nhan-xet-buoi'

type NhanXet2024 = {
  record_id: string
  ten_hs: string[] | null
  ngay: string | null
  gv: string[] | null
  co_so: string[] | string | null
  y_thuc: number | string | null
  lam_btvn: number | string | null
  nhan_xet: string | null
  giao_btvn: string | null
  kh_buoi_sau: string | null
  kien_thuc_moi: string | null
  link_lichess: string | null
  ghi_chu: string | null
}
type HocVienRecord = { record_id: string; name: string | null }
type GiaoVienRecord = { record_id: string; ten_tat: string | null }

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

  const rows2024 = readJson<NhanXet2024[]>('nhanxet2024.json')
  const hocvien = readJson<HocVienRecord[]>('hocvien.json')
  const giaovien = readJson<GiaoVienRecord[]>('giaovien.json')

  const hvMap = new Map<string, string>()
  for (const h of hocvien) hvMap.set(h.record_id, (h.name ?? '').trim())
  const gvMap = new Map<string, string>()
  for (const g of giaovien) gvMap.set(g.record_id, (g.ten_tat ?? '').trim())

  let noName = 0
  const rows: NormalizedRow[] = rows2024.map((r) => {
    const tenHsId = s(r.ten_hs)
    const ten = tenHsId ? (hvMap.get(tenHsId) ?? '') : ''
    if (!ten) noName += 1
    const gvId = s(r.gv)
    const tenTat = gvId ? (gvMap.get(gvId) ?? '') : ''
    return {
      // record_id 2024 làm mã buổi: ổn định + duy nhất ⇒ khóa idempotent.
      buoi: r.record_id,
      ten_hoc_vien: ten,
      ngay_hoc: s(r.ngay).slice(0, 10), // "2024-10-08 00:00:00" → "2024-10-08"
      co_so: s(r.co_so),
      gv_phu_trach: tenTat,
      y_thuc: s(r.y_thuc),
      lam_btvn: s(r.lam_btvn),
      nhan_xet: s(r.nhan_xet),
      giao_btvn: s(r.giao_btvn),
      kh_buoi_sau: s(r.kh_buoi_sau),
      kien_thuc_moi: s(r.kien_thuc_moi),
      link_lichess: s(r.link_lichess),
      ghi_chu: s(r.ghi_chu),
    }
  })

  console.error(
    `[import-nhanxet-2024-lark] ${rows.length} dòng 2024 | không resolve được tên HS: ${noName} | chế độ: ${commit ? 'GHI THẬT' : 'DRY-RUN'}`,
  )

  const payload = await getPayload({ config: await config })
  const result = await importNhanXetBuoi(payload, '2024 Nhận xét mỗi buổi — Lark', rows, {
    dryRun: !commit,
  })

  const lines: string[] = []
  lines.push(`\n=== Import Nhận xét 2024 (${commit ? 'GHI THẬT' : 'DRY-RUN'}) ===`)
  lines.push(`Tổng dòng              : ${result.totalRows}`)
  lines.push(`  ✅ ${commit ? 'Tạo mới' : 'SẼ tạo'}           : ${result.created}`)
  lines.push(`  ♻️  ${commit ? 'Cập nhật' : 'SẼ cập nhật'}      : ${result.updated}`)
  lines.push(`  ⏭️  Bỏ qua (trùng file): ${result.skipped}`)
  lines.push(`  ❌ Lỗi                : ${result.errors}`)
  lines.push(`     ↳ không khớp HV    : ${result.studentLinkMissing}`)
  lines.push(`     ↳ GV không khớp tenTat (vẫn ghi): ${result.coachLinkMissing}`)

  const linkMiss = result.outcomes.filter(
    (o) => o.status === 'error' && 'linkMiss' in o && o.linkMiss === 'student',
  )
  if (linkMiss.length > 0) {
    lines.push(`\n--- Dòng KHÔNG khớp học viên (${linkMiss.length}) — soát tay ---`)
    for (const o of linkMiss.slice(0, 40)) {
      if (o.status === 'error') lines.push(`  [dòng ${o.row}] ${o.message}`)
    }
    if (linkMiss.length > 40) lines.push(`  … và ${linkMiss.length - 40} dòng nữa`)
  }
  const otherErr = result.outcomes.filter(
    (o) => o.status === 'error' && !('linkMiss' in o && o.linkMiss === 'student'),
  )
  if (otherErr.length > 0) {
    lines.push(`\n--- Lỗi khác (${otherErr.length}) ---`)
    for (const o of otherErr.slice(0, 20)) {
      if (o.status === 'error')
        lines.push(`  [dòng ${o.row}] ${o.field ? `(${o.field}) ` : ''}${o.message}`)
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
