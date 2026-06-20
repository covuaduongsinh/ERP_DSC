/**
 * Script ENRICH HỌC VIÊN từ Lark Base — bảng "HocVien".
 *
 * Bổ sung cho Students các field SẴN CÓ trong schema mà sổ gốc còn thiếu:
 *   - dob              ← "Ngày sinh"      (cho nhắc sinh nhật)
 *   - enrollmentStatus ← "Tình trạng học" (chỉ 3 giá trị map được)
 *   - nickname         ← "Nickname"       (CHỈ điền khi Students đang trống)
 *
 * Nguồn: .lark-import/hocvien.json (xuất bằng .lark-import/export.py).
 * Đích : collection `students` (khớp theo TÊN, dedup giữ dấu — không đoán).
 *
 * Chạy (DRY-RUN mặc định, KHÔNG ghi DB):
 *   pnpm --filter @ds/web payload run scripts/enrich-students-lark.ts
 * Ghi thật vào DB:
 *   COMMIT=1 pnpm --filter @ds/web payload run scripts/enrich-students-lark.ts commit
 *
 * AN TOÀN: chỉ GHI ĐÈ dob khi khác giá trị cũ; enrollmentStatus chỉ đổi cho 3
 * giá trị hợp lệ (bỏ qua "Mới học thử"… không thuộc enum); nickname KHÔNG ghi đè
 * (chỉ điền chỗ trống). Idempotent: chạy lại không đổi gì nếu đã đồng bộ.
 */
import fs from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { normalizeName, normalizeExact, parseDateString } from '../src/lib/imports/nhan-xet-buoi'

type HocVienRecord = {
  record_id: string
  name: string | null
  ngay_sinh: string | null
  tinh_trang_hoc: string[] | string | null
  nickname: string | null
}

type EnrollmentStatus = 'dang_hoc' | 'tam_nghi' | 'da_nghi'
const STATUS_MAP: Record<string, EnrollmentStatus> = {
  'dang hoc': 'dang_hoc',
  'tam nghi': 'tam_nghi',
  'da nghi': 'da_nghi',
}

const DIR = path.resolve(process.cwd(), '..', '..', '.lark-import')

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

  const p = path.join(DIR, 'hocvien.json')
  if (!fs.existsSync(p)) {
    console.error(`✗ Không tìm thấy ${p}. Chạy: python .lark-import/export.py`)
    process.exit(1)
  }
  const hocvien = JSON.parse(fs.readFileSync(p, 'utf-8')) as HocVienRecord[]

  const payload = await getPayload({ config: await config })

  // Roster Students hiện tại → index theo tên (dedup giữ dấu khi trùng).
  type SRef = {
    id: number
    fullName: string
    dob: string | null
    nickname: string | null
    enrollmentStatus: string | null
  }
  const res = await payload.find({
    collection: 'students',
    pagination: false,
    overrideAccess: true,
    depth: 0,
  })
  const index = new Map<string, SRef[]>()
  for (const d of res.docs) {
    const ref: SRef = {
      id: d.id as number,
      fullName: String((d as { fullName?: string }).fullName ?? ''),
      dob: ((d as { dob?: string | null }).dob ?? null) as string | null,
      nickname: ((d as { nickname?: string | null }).nickname ?? null) as string | null,
      enrollmentStatus: ((d as { enrollmentStatus?: string | null }).enrollmentStatus ?? null) as
        | string
        | null,
    }
    const key = normalizeName(ref.fullName)
    if (!key) continue
    const arr = index.get(key) ?? []
    arr.push(ref)
    index.set(key, arr)
  }

  function match(name: string): SRef | { ambiguous: number } | null {
    const cand = index.get(normalizeName(name)) ?? []
    if (cand.length === 1) return cand[0]
    if (cand.length === 0) return null
    const want = normalizeExact(name)
    const exact = cand.filter((c) => normalizeExact(c.fullName) === want)
    if (exact.length === 1) return exact[0]
    return { ambiguous: cand.length }
  }

  let updated = 0
  let unchanged = 0
  let unmatched = 0
  let ambiguous = 0
  let setDob = 0
  let setStatus = 0
  let setNick = 0
  const unmatchedNames: string[] = []
  const ambiguousNames: string[] = []

  for (const h of hocvien) {
    const name = (h.name ?? '').replace(/\s+/g, ' ').trim()
    if (!name) continue
    const m = match(name)
    if (m === null) {
      unmatched += 1
      unmatchedNames.push(name)
      continue
    }
    if ('ambiguous' in m) {
      ambiguous += 1
      ambiguousNames.push(`${name} (×${m.ambiguous})`)
      continue
    }

    const data: Record<string, unknown> = {}

    // dob
    const rawDob = s(h.ngay_sinh).slice(0, 10)
    const dob = rawDob ? parseDateString(rawDob) : null
    if (dob) {
      const cur = m.dob ? String(m.dob).slice(0, 10) : null
      if (cur !== dob) {
        data.dob = dob
        setDob += 1
      }
    }

    // enrollmentStatus (chỉ 3 giá trị map được)
    const statusKey = normalizeName(s(h.tinh_trang_hoc))
    const mapped = STATUS_MAP[statusKey]
    if (mapped && m.enrollmentStatus !== mapped) {
      data.enrollmentStatus = mapped
      setStatus += 1
    }

    // nickname — chỉ điền khi đang trống
    const nick = (h.nickname ?? '').replace(/\s+/g, ' ').trim()
    if (nick && !(m.nickname ?? '').trim()) {
      data.nickname = nick
      setNick += 1
    }

    if (Object.keys(data).length === 0) {
      unchanged += 1
      continue
    }
    if (commit) {
      await payload.update({
        collection: 'students',
        id: m.id,
        data,
        overrideAccess: true,
      })
    }
    updated += 1
  }

  const lines: string[] = []
  lines.push(`\n=== Enrich Học viên từ HocVien (Lark) [${commit ? 'GHI THẬT' : 'DRY-RUN'}] ===`)
  lines.push(`HocVien đọc            : ${hocvien.length}`)
  lines.push(`  ✏️  HV ${commit ? 'đã' : 'sẽ'} cập nhật     : ${updated}`)
  lines.push(`      ↳ set ngày sinh   : ${setDob}`)
  lines.push(`      ↳ set tình trạng  : ${setStatus}`)
  lines.push(`      ↳ điền nickname   : ${setNick}`)
  lines.push(`  ✅ Không đổi (đã đồng bộ): ${unchanged}`)
  lines.push(`  ❓ Không khớp Students  : ${unmatched}`)
  lines.push(`  ⚠ Trùng tên (bỏ qua)   : ${ambiguous}`)
  if (unmatchedNames.length) {
    lines.push(`\n--- HV không khớp Students (${unmatchedNames.length}) — soát tay ---`)
    for (const n of unmatchedNames) lines.push(`  ${n}`)
  }
  if (ambiguousNames.length) {
    lines.push(`\n--- HV trùng tên trong Students (${ambiguousNames.length}) — soát tay ---`)
    for (const n of ambiguousNames) lines.push(`  ${n}`)
  }
  process.stderr.write(lines.join('\n') + '\n')
  process.exitCode = 0
}

try {
  await main()
} catch (err) {
  console.error('✗ Enrich thất bại:', err)
  process.exitCode = 1
}
process.exit(process.exitCode ?? 0)
