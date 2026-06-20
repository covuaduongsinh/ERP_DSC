/**
 * Script ĐỒNG BỘ HỌC VIÊN còn thiếu từ Lark Base — bảng "HocVien".
 *
 * TẠO MỚI vào `students` các HV có trong Lark HocVien nhưng CHƯA có trong
 * Students (khớp theo tên, dedup giữ dấu). HV đã có (1 hoặc nhiều bản ghi cùng
 * tên) → BỎ QUA (không đụng — enrich/khớp tay lo). Idempotent: chạy lại 0 tạo mới.
 *
 * Set khi tạo: fullName, dob←Ngày sinh, nickname←Nickname, location←cơ sở,
 * enrollmentStatus←Tình trạng học (3 giá trị; còn lại mặc định 'dang_hoc').
 *
 * Nguồn: .lark-import/hocvien.json. Chạy:
 *   pnpm --filter @ds/web payload run scripts/sync-students-lark.ts            (DRY-RUN)
 *   COMMIT=1 pnpm --filter @ds/web payload run scripts/sync-students-lark.ts commit
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
  co_so: string[] | string | null
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
function foldLoose(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
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

  // Index Students theo tên
  const res = await payload.find({
    collection: 'students',
    pagination: false,
    overrideAccess: true,
    depth: 0,
  })
  const index = new Map<string, { id: number; fullName: string }[]>()
  for (const d of res.docs) {
    const fullName = String((d as { fullName?: string }).fullName ?? '')
    const key = normalizeName(fullName)
    if (!key) continue
    const arr = index.get(key) ?? []
    arr.push({ id: d.id as number, fullName })
    index.set(key, arr)
  }

  // Locations: cơ sở → id
  const locRes = await payload.find({
    collection: 'locations',
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })
  const locations = locRes.docs.map((l) => ({
    id: l.id as number,
    fold: foldLoose((l as { name?: string }).name ?? ''),
  }))
  function matchLocation(raw: string): number | undefined {
    const main = raw.split(';')[0]?.replace(/\s+/g, ' ').trim() ?? ''
    if (!main) return undefined
    const needle = foldLoose(main)
    return locations.find((l) => l.fold.includes(needle))?.id
  }

  function existsInStudents(name: string): boolean {
    const cand = index.get(normalizeName(name)) ?? []
    if (cand.length >= 1) return true
    return false
  }

  let created = 0
  let existed = 0
  let noName = 0
  const createdNames: string[] = []

  const seen = new Set<string>()
  for (const h of hocvien) {
    const name = (h.name ?? '').replace(/\s+/g, ' ').trim()
    if (!name) {
      noName += 1
      continue
    }
    if (existsInStudents(name)) {
      existed += 1
      continue
    }
    const k = normalizeExact(name)
    if (seen.has(k)) {
      // 2 HV cùng tên trong Lark mà chưa có trong Students → tạo 1, tránh nhân đôi
      existed += 1
      continue
    }
    seen.add(k)

    const rawDob = s(h.ngay_sinh).slice(0, 10)
    const dob = rawDob ? parseDateString(rawDob) : null
    const mapped = STATUS_MAP[normalizeName(s(h.tinh_trang_hoc))]
    const nick = (h.nickname ?? '').replace(/\s+/g, ' ').trim()
    const locId = matchLocation(s(h.co_so))

    const data: Record<string, unknown> = {
      fullName: name,
      enrollmentStatus: mapped ?? 'dang_hoc',
    }
    if (dob) data.dob = dob
    if (nick) data.nickname = nick
    if (locId !== undefined) data.location = locId

    if (commit) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await payload.create({ collection: 'students', data: data as any, overrideAccess: true })
    }
    created += 1
    createdNames.push(name)
  }

  const lines: string[] = []
  lines.push(
    `\n=== Đồng bộ Học viên thiếu từ HocVien (Lark) [${commit ? 'GHI THẬT' : 'DRY-RUN'}] ===`,
  )
  lines.push(`HocVien đọc            : ${hocvien.length}`)
  lines.push(`  ✅ ${commit ? 'Đã tạo mới' : 'SẼ tạo mới'}      : ${created}`)
  lines.push(`  ⏭️  Đã có trong Students: ${existed}`)
  lines.push(`  ❓ Thiếu tên (bỏ qua)  : ${noName}`)
  if (createdNames.length) {
    lines.push(`\n--- HV ${commit ? 'đã' : 'sẽ'} tạo mới (${createdNames.length}) ---`)
    for (const n of createdNames) lines.push(`  ${n}`)
  }
  process.stderr.write(lines.join('\n') + '\n')
  process.exitCode = 0
}

try {
  await main()
} catch (err) {
  console.error('✗ Sync thất bại:', err)
  process.exitCode = 1
}
process.exit(process.exitCode ?? 0)
