/**
 * Seed fixtures (idempotent) cho thử nghiệm import + test tấn công cách ly:
 *   - Coach "Phùng Đức Tường" (id có sẵn) được gán tenTat = "Tường" để minh họa
 *     coach link KHỚP (các GV khác trong file vẫn lệch link).
 *   - Phụ huynh A (0900000001) ↔ con "Nguyễn Doãn Long".
 *   - Phụ huynh B (0900000002) ↔ con "Đặng Minh Đức".
 * Hai tên học viên này có sẵn nhiều dòng trong NhanXetBuoi_long.csv để import
 * tạo ra nhiều bản ghi thật.
 *
 * Chạy: pnpm --filter web payload run scripts/seed-attendance-test.ts
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { normalizePhone } from '../src/lib/phone'

async function ensureStudent(payload: any, fullName: string): Promise<number> {
  const found = await payload.find({
    collection: 'students',
    where: { fullName: { equals: fullName } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  if (found.totalDocs > 0) return found.docs[0].id as number
  const created = await payload.create({
    collection: 'students',
    data: { fullName, enrollmentStatus: 'dang_hoc' },
    overrideAccess: true,
  })
  return created.id as number
}

async function ensureParent(
  payload: any,
  fullName: string,
  rawPhone: string,
  childId: number,
): Promise<number> {
  const phone = normalizePhone(rawPhone)
  const found = await payload.find({
    collection: 'parents',
    where: { phone: { equals: phone } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  if (found.totalDocs > 0) {
    const id = found.docs[0].id as number
    await payload.update({
      collection: 'parents',
      id,
      data: { children: [childId] },
      overrideAccess: true,
    })
    return id
  }
  const created = await payload.create({
    collection: 'parents',
    data: { fullName, phone, children: [childId] },
    overrideAccess: true,
  })
  return created.id as number
}

async function main() {
  const payload = await getPayload({ config: await config })

  // 1) Gán tenTat cho coach "Phùng Đức Tường" (minh họa coach link khớp).
  const tuong = await payload.find({
    collection: 'coaches',
    where: { name: { equals: 'Phùng Đức Tường' } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })
  if (tuong.totalDocs > 0 && !(tuong.docs[0] as any).tenTat) {
    await payload.update({
      collection: 'coaches',
      id: tuong.docs[0].id,
      data: { tenTat: 'Tường' },
      overrideAccess: true,
    })
    console.error(`[seed] coach "Phùng Đức Tường" (id ${tuong.docs[0].id}) → tenTat="Tường"`)
  }

  // 2) Học viên + phụ huynh (idempotent, cách ly hai phụ huynh).
  const studentA = await ensureStudent(payload, 'Nguyễn Doãn Long')
  const studentB = await ensureStudent(payload, 'Đặng Minh Đức')
  const parentA = await ensureParent(payload, 'PH Test A', '0900000001', studentA)
  const parentB = await ensureParent(payload, 'PH Test B', '0900000002', studentB)

  // Đồng bộ chiều Students.parents (nguồn sự thật cho access là Parents.children).
  await payload.update({
    collection: 'students',
    id: studentA,
    data: { parents: [parentA] },
    overrideAccess: true,
  })
  await payload.update({
    collection: 'students',
    id: studentB,
    data: { parents: [parentB] },
    overrideAccess: true,
  })

  console.error('[seed] OK', JSON.stringify({ studentA, studentB, parentA, parentB }))
  process.stderr.write(
    `\nFIXTURES\n  studentA(Nguyễn Doãn Long)=${studentA} parentA=${parentA} (0900000001)\n` +
      `  studentB(Đặng Minh Đức)=${studentB} parentB=${parentB} (0900000002)\n`,
  )
}

try {
  await main()
} catch (err) {
  console.error('✗ Seed thất bại:', err)
  process.exitCode = 1
}
process.exit(process.exitCode ?? 0)
