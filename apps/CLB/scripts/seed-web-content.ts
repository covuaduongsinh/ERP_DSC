/**
 * Seed nội dung website curated (idempotent) cho các mục cố định:
 *   - web-programs: Nhập môn / Cơ bản / Nâng cao
 *   - web-locations: Cơ sở Vĩnh Phúc + Cơ sở Kim Liên (kèm lịch học)
 *   - web-coaches: 4 HLV (Tường/An/Trúc/Phương Anh) — STUB tên + vai trò + thứ tự;
 *     ẢNH & TIỂU SỬ bổ sung tay trong admin (script không upload ảnh được).
 *
 * Idempotent: tìm theo `name`, bỏ qua nếu đã tồn tại. Chạy lại an toàn.
 *
 * Chạy: pnpm --filter @ds/web payload run scripts/seed-web-content.ts
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'

const PROGRAMS = [
  { name: 'Nhập môn', order: 1 },
  { name: 'Cơ bản', order: 2 },
  { name: 'Nâng cao', order: 3 },
]

const LOCATIONS = [
  {
    name: 'Cơ sở Vĩnh Phúc',
    address: 'Số 16 phố Vĩnh Phúc, Ba Đình, Hà Nội',
    mapUrl: 'https://maps.app.goo.gl/wgAzh5aVYR4UehGf8',
    lichHocNgay: 'Thứ 2 · Thứ 6',
    lichHocGio: [{ gio: 'Ca 1: 18h00–19h15' }, { gio: 'Ca 2: 19h15–20h30' }],
    order: 1,
  },
  {
    name: 'Cơ sở Kim Liên',
    address: 'Số 22, ngõ 11 Lương Định Của, Hà Nội',
    mapUrl: 'https://maps.app.goo.gl/FzkyiPQUz3CSwRH96',
    lichHocNgay: 'Tối Thứ 3 · Thứ 5 · Thứ 7',
    lichHocGio: [{ gio: '19h30–20h45' }],
    order: 2,
  },
]

// STUB — bổ sung ảnh/tiểu sử/danh hiệu tay trong admin.
const COACHES = [
  { name: 'Tường', role: 'Huấn luyện viên', order: 1 },
  { name: 'An', role: 'Huấn luyện viên', order: 2 },
  { name: 'Trúc', role: 'Huấn luyện viên', order: 3 },
  { name: 'Phương Anh', role: 'Huấn luyện viên', order: 4 },
]

async function ensure(payload: any, collection: string, name: string, data: object) {
  const found = await payload.find({
    collection,
    where: { name: { equals: name } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  if (found.totalDocs > 0) {
    console.error(`[seed] ${collection} "${name}" đã có (id ${found.docs[0].id}) — bỏ qua`)
    return found.docs[0].id
  }
  const created = await payload.create({
    collection,
    data: { name, ...data },
    overrideAccess: true,
  })
  console.error(`[seed] ${collection} "${name}" → tạo mới (id ${created.id})`)
  return created.id
}

async function main() {
  const payload = await getPayload({ config: await config })

  for (const p of PROGRAMS) {
    await ensure(payload, 'web-programs', p.name, { order: p.order })
  }
  for (const loc of LOCATIONS) {
    const { name, ...rest } = loc
    await ensure(payload, 'web-locations', name, rest)
  }
  for (const c of COACHES) {
    const { name, ...rest } = c
    await ensure(payload, 'web-coaches', name, rest)
  }

  console.error('[seed] OK — web-programs + web-locations + web-coaches đã sẵn sàng.')
}

try {
  await main()
} catch (err) {
  console.error('✗ Seed thất bại:', err)
  process.exitCode = 1
}
process.exit(process.exitCode ?? 0)
