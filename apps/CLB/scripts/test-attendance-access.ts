/**
 * TEST TẤN CÔNG cách ly dữ liệu Attendance giữa hai phụ huynh.
 *
 * Kịch bản: Phụ huynh A (con "Nguyễn Doãn Long") TUYỆT ĐỐI không lấy được bản
 * ghi Attendance của con Phụ huynh B ("Đặng Minh Đức"), kể cả khi:
 *   (1) Gọi REST trực tiếp /api/attendance/<id> và ĐỔI ID trên URL sang bản ghi
 *       của con người khác (IDOR).
 *   (2) Liệt kê /api/attendance — chỉ thấy bản ghi con MÌNH.
 *   (3) Gọi Local API overrideAccess:false giả lập req.user = phụ huynh A.
 *
 * Chạy (cần dev server đang chạy ở :3005):
 *   pnpm --filter web payload run scripts/test-attendance-access.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { getPayload } from 'payload'
import config from '../src/payload.config'
import { createParentSessionToken, PARENT_SESSION_COOKIE } from '../src/lib/parent-session'

const BASE = process.env.DS_TEST_BASE_URL ?? 'http://localhost:3005'

/** Bảo đảm có PARENT_SESSION_SECRET (đọc .env nếu payload run chưa nạp). */
function ensureEnv() {
  if (process.env.PARENT_SESSION_SECRET) return
  const envPath = path.resolve(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line)
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

type Check = { name: string; pass: boolean; detail: string }
const checks: Check[] = []
const add = (name: string, pass: boolean, detail: string) => checks.push({ name, pass, detail })

async function httpGet(url: string, cookie?: string) {
  const res = await fetch(url, {
    headers: cookie ? { cookie } : {},
    redirect: 'manual',
  })
  let body: any = null
  try {
    body = await res.json()
  } catch {
    /* non-JSON */
  }
  return { status: res.status, body }
}

async function main() {
  ensureEnv()
  const payload = await getPayload({ config: await config })

  // Lấy id phụ huynh + một bản ghi của mỗi con (overrideAccess: nhân viên).
  const [pa, pb] = await Promise.all([
    payload.find({
      collection: 'parents',
      where: { phone: { equals: '0900000001' } },
      limit: 1,
      overrideAccess: true,
      depth: 0,
    }),
    payload.find({
      collection: 'parents',
      where: { phone: { equals: '0900000002' } },
      limit: 1,
      overrideAccess: true,
      depth: 0,
    }),
  ])
  const parentA = pa.docs[0]
  const parentB = pb.docs[0]
  const childA = (parentA.children as number[])[0]
  const childB = (parentB.children as number[])[0]

  const [recA, recB] = await Promise.all([
    payload.find({
      collection: 'attendance',
      where: { student: { equals: childA } },
      limit: 1,
      overrideAccess: true,
      depth: 0,
    }),
    payload.find({
      collection: 'attendance',
      where: { student: { equals: childB } },
      limit: 1,
      overrideAccess: true,
      depth: 0,
    }),
  ])
  const recordA = recA.docs[0]
  const recordB = recB.docs[0]

  console.error('[test] parentA', parentA.id, 'childA', childA, 'recordA', recordA?.id)
  console.error('[test] parentB', parentB.id, 'childB', childB, 'recordB', recordB?.id)
  if (!recordA || !recordB) {
    throw new Error('Thiếu bản ghi Attendance để test — chạy seed + import trước.')
  }

  const tokenA = createParentSessionToken(parentA.id as number).token
  const cookieA = `${PARENT_SESSION_COOKIE}=${encodeURIComponent(tokenA)}`

  // ── (1) IDOR qua REST: phụ huynh A đổi ID URL sang bản ghi con phụ huynh B ──
  const idor = await httpGet(`${BASE}/api/attendance/${recordB.id}`, cookieA)
  add(
    'REST IDOR: A đọc /api/attendance/<recordB>',
    idor.status !== 200 || !idor.body || idor.body.id !== recordB.id,
    `status=${idor.status} body.id=${idor.body?.id ?? '∅'} (mong đợi KHÔNG trả recordB)`,
  )

  // Sanity: A đọc được bản ghi con MÌNH qua REST.
  const ownGet = await httpGet(`${BASE}/api/attendance/${recordA.id}`, cookieA)
  add(
    'REST own: A đọc /api/attendance/<recordA>',
    ownGet.status === 200 && ownGet.body?.id === recordA.id,
    `status=${ownGet.status} body.id=${ownGet.body?.id ?? '∅'} (mong đợi 200 + recordA)`,
  )

  // ── (2) List REST: A liệt kê — chỉ thấy con mình ──
  const list = await httpGet(`${BASE}/api/attendance?limit=500&depth=0`, cookieA)
  const docs: any[] = list.body?.docs ?? []
  const leaked = docs.filter((d) => {
    const sid = typeof d.student === 'object' ? d.student?.id : d.student
    return sid !== childA
  })
  add(
    'REST list: A chỉ thấy bản ghi con mình',
    list.status === 200 && docs.length > 0 && leaked.length === 0,
    `status=${list.status} tổng=${docs.length} rò rỉ(khác childA)=${leaked.length}`,
  )

  // ── (3) Anonymous: không cookie → không đọc được ──
  const anon = await httpGet(`${BASE}/api/attendance/${recordA.id}`)
  add(
    'REST anon: ẩn danh KHÔNG đọc được recordA',
    anon.status !== 200 || !anon.body || anon.body.id !== recordA.id,
    `status=${anon.status} body.id=${anon.body?.id ?? '∅'}`,
  )

  // ── (4) Local API overrideAccess:false giả lập req.user = phụ huynh A ──
  const parentAUser = { ...parentA, collection: 'parents' } as any
  let localBlocked = false
  let localDetail = ''
  try {
    const doc = await payload.findByID({
      collection: 'attendance',
      id: recordB.id,
      overrideAccess: false,
      user: parentAUser,
      depth: 0,
    })
    localBlocked = !doc // null/undefined = bị chặn
    localDetail = doc ? `TRẢ VỀ doc id=${doc.id} (RÒ RỈ!)` : 'trả null'
  } catch (e) {
    localBlocked = true // throw Forbidden/NotFound = bị chặn
    localDetail = `throw ${(e as Error).name}`
  }
  add('Local API: A.findByID(recordB) bị chặn', localBlocked, localDetail)

  // Local list as A → chỉ con mình.
  const localList = await payload.find({
    collection: 'attendance',
    overrideAccess: false,
    user: parentAUser,
    limit: 500,
    depth: 0,
  })
  const localLeak = localList.docs.filter((d: any) => {
    const sid = typeof d.student === 'object' ? d.student?.id : d.student
    return sid !== childA
  })
  add(
    'Local API list: A chỉ thấy con mình',
    localList.docs.length > 0 && localLeak.length === 0,
    `tổng=${localList.docs.length} rò rỉ=${localLeak.length}`,
  )

  // ── In kết quả ──
  const out: string[] = ['\n=== TEST TẤN CÔNG CÁCH LY ATTENDANCE ===']
  let allPass = true
  for (const c of checks) {
    if (!c.pass) allPass = false
    out.push(`  ${c.pass ? '✅ PASS' : '❌ FAIL'}  ${c.name}\n           ${c.detail}`)
  }
  out.push(
    allPass
      ? '\n🎉 TẤT CẢ PASS — phụ huynh A không lấy được dữ liệu con phụ huynh B.'
      : '\n🚨 CÓ CHECK FAIL — xem chi tiết phía trên.',
  )
  process.stderr.write(out.join('\n') + '\n')
  process.exitCode = allPass ? 0 : 1
}

try {
  await main()
} catch (err) {
  console.error('✗ Test thất bại:', err)
  process.exitCode = 1
}
process.exit(process.exitCode ?? 0)
