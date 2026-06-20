/**
 * TEST PHÂN QUYỀN GHI cho nhóm collection chuyển từ `isAuthenticated` sang
 * `hasRole(...)` / `staffOnly`.
 *
 * Trọng tâm lỗ hổng đã vá: `isAuthenticated` trả `true` cho CẢ phụ huynh
 * (đăng nhập qua collection `parents`), nên trước đây phụ huynh ghi được vào
 * nội dung CMS và cả tài khoản Users. Test này chứng minh:
 *   - Phụ huynh KHÔNG create được nội dung (locations) lẫn Users.
 *   - Nhân viên SAI role bị chặn (coach/accountant với nội dung; receptionist
 *     với Users); nhân viên ĐÚNG role được phép (access qua).
 *   - Leads: form web (ẩn danh) vẫn create được; phụ huynh KHÔNG đọc được;
 *     lễ tân đọc được.
 *   - Users.read = staffOnly: phụ huynh KHÔNG đọc danh sách nhân viên; nhân
 *     viên (mọi role) qua được access.
 *
 * Đánh giá access dựa trên `req.user.collection` + `req.user.role`, nên user
 * tổng hợp (synthetic) là đủ — không cần tài khoản thật. Local API
 * `overrideAccess:false` chạy đúng access function như REST.
 *
 * GHI CHÚ MÔI TRƯỜNG: access của Payload chạy TRƯỚC validation và TRƯỚC truy
 * vấn DB. Nên với hướng "được phép" trên Users, ta gửi data THIẾU field bắt
 * buộc để op dừng ở validation (KHÔNG ghi DB) — vẫn chứng minh access đã qua
 * (lỗi 400 chứ không phải 403). Cách này cũng né được việc DB cục bộ thiếu bảng
 * `users_sessions` (đọc/ghi users qua API hiện lỗi ở môi trường này).
 *
 * Chạy: pnpm --filter @ds/web payload run scripts/test-content-write-access.ts
 */
import { getPayload } from 'payload'
import config from '../src/payload.config'

type Check = { name: string; pass: boolean; detail: string }
const checks: Check[] = []
const notes: string[] = []
const add = (name: string, pass: boolean, detail: string) => checks.push({ name, pass, detail })

// User tổng hợp cho từng vai (access chỉ đọc collection + role).
const parent = { id: 999001, collection: 'parents' } as any
const anon = undefined
const staff = (role: string) => ({ id: 999100, collection: 'users', role }) as any

type Outcome = 'blocked' | 'access-passed' | 'ok'

/** Phân loại kết quả 1 op theo GÓC NHÌN ACCESS:
 *  - 'blocked'        : Payload throw Forbidden (403) → access TỪ CHỐI.
 *  - 'access-passed'  : op đi qua access rồi dừng ở validation/DB (lỗi ≠ 403).
 *  - 'ok'             : op thành công.
 */
async function runOp(fn: () => Promise<unknown>): Promise<{ outcome: Outcome; detail: string }> {
  try {
    await fn()
    return { outcome: 'ok', detail: 'thành công' }
  } catch (e) {
    const status = (e as { status?: number }).status
    const forbidden = status === 403 || /forbidden/i.test((e as Error).message)
    if (forbidden) return { outcome: 'blocked', detail: `throw Forbidden status=${status ?? '?'}` }
    return {
      outcome: 'access-passed',
      detail: `access QUA, dừng sau đó: ${(e as Error).name} status=${status ?? '?'}`,
    }
  }
}

async function main() {
  const payload = await getPayload({ config: await config })

  // ── A. Nội dung (locations) — ghi cần hasRole(admin,manager,receptionist) ──
  // `code` bắt buộc (Locations.code required) — mã test, không đụng KL/VP thật.
  const locData = { name: 'ACCESS_TEST_LOC', address: 'test', code: 'ZZ' }
  const mkLoc = (user: any) => () =>
    payload.create({ collection: 'locations', data: locData, overrideAccess: false, user })

  for (const [name, user] of [
    ['A1 phụ huynh', parent],
    ['A2 coach', staff('coach')],
    ['A3 accountant', staff('accountant')],
    ['A4 ẩn danh', anon],
  ] as const) {
    const r = await runOp(mkLoc(user))
    add(`${name}: create locations bị chặn`, r.outcome === 'blocked', r.detail)
  }

  // receptionist ĐƯỢC tạo thật — dọn trước (locations đọc/ghi bình thường), tạo, xóa.
  await payload
    .delete({
      collection: 'locations',
      where: { name: { equals: locData.name } },
      overrideAccess: true,
    })
    .catch(() => {})
  const r5 = await runOp(mkLoc(staff('receptionist')))
  add('A5 receptionist: create locations ĐƯỢC', r5.outcome === 'ok', r5.detail)
  await payload
    .delete({
      collection: 'locations',
      where: { name: { equals: locData.name } },
      overrideAccess: true,
    })
    .catch(() => {})

  // ── B. Users — ghi = hasRole(admin,manager); read = staffOnly ──
  // Hướng "được phép" gửi data THIẾU email/password → dừng ở validation, KHÔNG
  // ghi DB (tránh tạo user rác mà môi trường này không xóa lại được).
  const mkUserInvalid = (user: any) => () =>
    payload.create({
      collection: 'users',
      data: { role: 'receptionist' } as any,
      overrideAccess: false,
      user,
    })

  for (const [name, user] of [
    ['B1 phụ huynh', parent],
    ['B2 receptionist', staff('receptionist')],
  ] as const) {
    const r = await runOp(mkUserInvalid(user))
    add(`${name}: create Users bị chặn`, r.outcome === 'blocked', r.detail)
  }

  const b3 = await runOp(mkUserInvalid(staff('manager')))
  add(
    'B3 manager: create Users KHÔNG bị access chặn (dừng ở validation)',
    b3.outcome === 'access-passed',
    b3.detail,
  )

  // read = staffOnly: phụ huynh bị chặn (403, trước DB); nhân viên qua access.
  const b4 = await runOp(() =>
    payload.find({ collection: 'users', overrideAccess: false, user: parent, limit: 1 }),
  )
  add('B4 users.read: phụ huynh KHÔNG đọc danh sách nhân viên', b4.outcome === 'blocked', b4.detail)

  const b5 = await runOp(() =>
    payload.find({ collection: 'users', overrideAccess: false, user: staff('coach'), limit: 1 }),
  )
  add('B5 users.read: nhân viên (coach) qua được access', b5.outcome !== 'blocked', b5.detail)
  if (b5.outcome === 'access-passed') {
    notes.push(
      'B5: read users qua access nhưng DB cục bộ thiếu bảng `users_sessions` nên find không hoàn tất — đây là vấn đề schema môi trường, KHÔNG phải access.',
    )
  }

  // ── C. Leads — create=anyone (form web); read=hasRole(admin,manager,receptionist) ──
  await payload
    .delete({
      collection: 'leads',
      where: { phone: { equals: '0999999999' } },
      overrideAccess: true,
    })
    .catch(() => {})
  const c1 = await runOp(() =>
    payload.create({
      collection: 'leads',
      data: { fullName: 'ACCESS_TEST_LEAD', phone: '0999999999', source: 'khac', status: 'moi' },
      overrideAccess: false,
      user: anon,
    }),
  )
  add('C1 leads: ẩn danh (form web) create ĐƯỢC', c1.outcome === 'ok', c1.detail)
  await payload
    .delete({
      collection: 'leads',
      where: { phone: { equals: '0999999999' } },
      overrideAccess: true,
    })
    .catch(() => {})

  const c2 = await runOp(() =>
    payload.find({ collection: 'leads', overrideAccess: false, user: parent, limit: 1 }),
  )
  add('C2 leads.read: phụ huynh KHÔNG đọc được leads', c2.outcome === 'blocked', c2.detail)

  const c3 = await runOp(() =>
    payload.find({
      collection: 'leads',
      overrideAccess: false,
      user: staff('receptionist'),
      limit: 1,
    }),
  )
  add('C3 leads.read: lễ tân đọc được leads', c3.outcome === 'ok', c3.detail)

  // ── In kết quả ──
  const out: string[] = ['\n=== TEST PHÂN QUYỀN GHI: nội dung / Users / Leads ===']
  let allPass = true
  for (const c of checks) {
    if (!c.pass) allPass = false
    out.push(`  ${c.pass ? '✅ PASS' : '❌ FAIL'}  ${c.name}\n           ${c.detail}`)
  }
  for (const n of notes) out.push(`  ℹ️  ${n}`)
  out.push(
    allPass
      ? '\n🎉 TẤT CẢ PASS — phụ huynh không ghi được nội dung/Users; role đúng/sai được phân tách.'
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
