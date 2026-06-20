/**
 * Attack-simulation cho TASK 2 — cách ly dữ liệu trẻ em giữa các phụ huynh.
 *
 * Chạy: pnpm --filter @ds/web exec tsx tests/int/parent-isolation.attack.ts
 *
 * KHÔNG yêu cầu DB. Test trực tiếp các Access function (pure) + cấu hình
 * field-level access. Payload ÁP DỤNG kết quả này ở DB-level:
 *   - return true   → cho phép toàn bộ
 *   - return false  → từ chối
 *   - return Where  → DB lọc theo Where, không bao giờ phơi bản ghi khác
 *
 * Mọi cố gắng tấn công ở runtime (id swap, query-param injection, list endpoint,
 * REST/GraphQL/Local API) ĐỀU đi qua chính các function này, nên test pure
 * function tương đương kiểm thử xâm nhập đầu cuối ở cấp độ logic.
 */
import type { Access, FieldAccess, Where } from 'payload'
import {
  staffOnly,
  staffOnlyFieldWrite,
  readByStudentRelation,
  readParentSelf,
  readRenewalRequest,
  createRenewalForOwnChild,
  readStudentForParent,
  updateParentSelf,
} from '../../src/access/parents'
import { Parents } from '../../src/collections/Parents'
import { Students } from '../../src/collections/Students'
import { ProgressReports } from '../../src/collections/ProgressReports'
import { Attendance } from '../../src/collections/Attendance'
import { TuitionCycles } from '../../src/collections/TuitionCycles'
import { Payments } from '../../src/collections/Payments'
import { RenewalRequests } from '../../src/collections/RenewalRequests'
import { OtpCodes } from '../../src/collections/OtpCodes'
import { StudentLevels } from '../../src/collections/StudentLevels'
import { Enrollments } from '../../src/collections/Enrollments'

// ─── Fake actors ──────────────────────────────────────────────────────────────
const parentA = {
  id: 101,
  collection: 'parents',
  children: [1001], // học viên A
} as const
const parentB = {
  id: 102,
  collection: 'parents',
  children: [1002], // học viên B
} as const
const orphanParent = {
  id: 103,
  collection: 'parents',
  children: [], // phụ huynh chưa được nhân viên gán con
} as const
// Staff đại diện "toàn quyền": dùng role GLOBAL (admin) vì sau Phase 4 các
// collection student-relation (Attendance/Payments/TuitionCycles/StudentLevels/
// Enrollments/ProgressReports/RenewalRequests) bọc `withBranchScope(...,
// 'student.location')`. Nhân viên KHÔNG role + chưa gán cơ sở sẽ fail-closed
// (`false`) qua access THẬT — muốn assert "staff → full access" thì actor phải
// role global. Cách ly theo PHỤ HUYNH (mục tiêu file này) không phụ thuộc role nên
// không đổi; cách ly theo CƠ SỞ kiểm riêng ở `branch-access.int.spec.ts`.
const staff = { id: 1, collection: 'users', role: 'admin' } as const
const anon = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asReq = (user: any) => ({ req: { user } }) as any

// ─── Test harness ─────────────────────────────────────────────────────────────
type Result = { name: string; pass: boolean; detail?: string }
const results: Result[] = []
const record = (name: string, pass: boolean, detail?: string) => {
  results.push({ name, pass, detail })

  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`)
}

const isWhere = (v: unknown): v is Where => typeof v === 'object' && v !== null && !Array.isArray(v)

const expect = async (
  name: string,
  fn: Access | FieldAccess,
  ctx: { req: { user: unknown } },
  predicate: (out: unknown) => { ok: boolean; detail?: string },
) => {
  try {
    const out = await fn(ctx as Parameters<typeof fn>[0])
    const { ok, detail } = predicate(out)
    record(name, ok, detail ?? `returned ${JSON.stringify(out)}`)
  } catch (e) {
    record(name, false, `threw: ${e instanceof Error ? e.message : String(e)}`)
  }
}

// ─── Helpers for asserting the expected access shape ─────────────────────────
const isStrictlyTrue = (v: unknown) => ({
  ok: v === true,
  detail: v === true ? 'true (full access)' : `expected true, got ${JSON.stringify(v)}`,
})
const isStrictlyFalse = (v: unknown) => ({
  ok: v === false,
  detail: v === false ? 'false (denied)' : `expected false, got ${JSON.stringify(v)}`,
})
const isFilteredByStudentIn = (allowed: number[]) => (v: unknown) => {
  if (!isWhere(v)) return { ok: false, detail: `expected Where filter, got ${JSON.stringify(v)}` }
  // Could be `{ student: { in: [...] } }` or `{ and: [{ student:{ in:[...] } }, extra ] }`
  const candidate = (v.and as Where[] | undefined)?.[0] ?? v
  const studentIn = (candidate as { student?: { in?: number[] } }).student?.in
  if (!Array.isArray(studentIn))
    return { ok: false, detail: `no student.in in filter: ${JSON.stringify(v)}` }
  const same = studentIn.length === allowed.length && studentIn.every((id) => allowed.includes(id))
  return {
    ok: same,
    detail: same
      ? `student.in = [${studentIn.join(',')}] (matches expected)`
      : `student.in = [${studentIn.join(',')}], expected [${allowed.join(',')}]`,
  }
}
const isFilteredByIdIn = (allowed: number[]) => (v: unknown) => {
  if (!isWhere(v)) return { ok: false, detail: `expected Where, got ${JSON.stringify(v)}` }
  const idIn = (v as { id?: { in?: number[] } }).id?.in
  if (!Array.isArray(idIn)) return { ok: false, detail: `no id.in in filter` }
  const same = idIn.length === allowed.length && idIn.every((id) => allowed.includes(id))
  return {
    ok: same,
    detail: same ? `id.in = [${idIn.join(',')}]` : `mismatch: got [${idIn.join(',')}]`,
  }
}
const isIdEquals = (target: number) => (v: unknown) => {
  if (!isWhere(v)) return { ok: false, detail: `expected Where, got ${JSON.stringify(v)}` }
  const eq = (v as { id?: { equals?: number } }).id?.equals
  return {
    ok: eq === target,
    detail: eq === target ? `id.equals = ${target}` : `expected id.equals=${target}, got ${eq}`,
  }
}
const hasPublishedAtFilter = () => (v: unknown) => {
  if (!isWhere(v)) return { ok: false, detail: `expected Where, got ${JSON.stringify(v)}` }
  const andArr = (v as { and?: Where[] }).and
  if (!Array.isArray(andArr)) {
    return { ok: false, detail: `expected and-filter with publishedAt, got ${JSON.stringify(v)}` }
  }
  const hasPublished = andArr.some(
    (w) => (w as { publishedAt?: { not_equals?: unknown } }).publishedAt?.not_equals === null,
  )
  return {
    ok: hasPublished,
    detail: hasPublished
      ? 'publishedAt: { not_equals: null } present → drafts hidden'
      : `no publishedAt filter in: ${JSON.stringify(v)}`,
  }
}

// ─── Run ─────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Students.read — staff cho phép tất
  await expect(
    'Students.read as staff → full access',
    readStudentForParent,
    asReq(staff),
    isStrictlyTrue,
  )

  // 2. Students.read — anon bị từ chối
  await expect(
    'Students.read as anonymous → denied',
    readStudentForParent,
    asReq(anon),
    isStrictlyFalse,
  )

  // 3. Students.read — Parent A chỉ thấy con A (id ∈ [1001])
  await expect(
    'Students.read as Parent A → filter id ∈ [1001] (chặn Student B id=1002)',
    readStudentForParent,
    asReq(parentA),
    isFilteredByIdIn([1001]),
  )

  // 4. Students.read — Parent B chỉ thấy con B
  await expect(
    'Students.read as Parent B → filter id ∈ [1002] (chặn Student A id=1001)',
    readStudentForParent,
    asReq(parentB),
    isFilteredByIdIn([1002]),
  )

  // 5. Students.read — phụ huynh chưa gán con → từ chối (không phải mở rộng)
  await expect(
    'Students.read as orphan parent (no children) → denied',
    readStudentForParent,
    asReq(orphanParent),
    isStrictlyFalse,
  )

  // 6. ProgressReports.read — staff full
  const prRead = readByStudentRelation({ publishedAt: { not_equals: null } })
  await expect('ProgressReports.read as staff → full access', prRead, asReq(staff), isStrictlyTrue)

  // 7. ProgressReports.read — Parent A chỉ thấy report của student ∈ [1001]
  await expect(
    'ProgressReports.read as Parent A → filter student ∈ [1001]',
    prRead,
    asReq(parentA),
    isFilteredByStudentIn([1001]),
  )

  // 8. ProgressReports — drafts (publishedAt=null) bị ẨN cho phụ huynh
  await expect(
    'ProgressReports.read as Parent A → DRAFT bị ẩn (publishedAt not_equals null)',
    prRead,
    asReq(parentA),
    hasPublishedAtFilter(),
  )

  // 9. ProgressReports — Parent A KHÔNG nhận filter của con B
  await expect(
    'ProgressReports.read as Parent A → KHÔNG chứa student=1002 (con của B)',
    prRead,
    asReq(parentA),
    (v) => {
      const ids = isWhere(v)
        ? (((v.and as Where[] | undefined)?.[0] ?? v) as { student?: { in?: number[] } }).student
            ?.in
        : undefined
      const ok = Array.isArray(ids) && !ids.includes(1002)
      return {
        ok,
        detail: ok
          ? `student.in correctly excludes 1002 ([${ids?.join(',')}])`
          : `LEAK: 1002 in filter [${ids?.join(',')}]`,
      }
    },
  )

  // 10. ProgressReports.read — orphan parent → denied
  await expect(
    'ProgressReports.read as orphan parent → denied',
    prRead,
    asReq(orphanParent),
    isStrictlyFalse,
  )

  // 11. Attendance.read — Parent A filter student ∈ [1001]
  const attRead = readByStudentRelation()
  await expect(
    'Attendance.read as Parent A → filter student ∈ [1001]',
    attRead,
    asReq(parentA),
    isFilteredByStudentIn([1001]),
  )

  // 12. Attendance.read — anon denied
  await expect('Attendance.read as anonymous → denied', attRead, asReq(anon), isStrictlyFalse)

  // 12b. StudentLevels + Enrollments — cùng readByStudentRelation theo `student`.
  //      Phụ huynh A chỉ thấy bản ghi con A (student ∈ [1001]); ghi chỉ staff.
  for (const [name, coll] of [
    ['StudentLevels', StudentLevels],
    ['Enrollments', Enrollments],
    ['Payments', Payments],
  ] as const) {
    const readFn = coll.access?.read
    if (!readFn) {
      record(`${name}.access.read defined`, false, 'CRITICAL: thiếu access.read → rò rỉ chéo')
    } else {
      await expect(`${name}.read as staff → full access`, readFn, asReq(staff), isStrictlyTrue)
      await expect(
        `${name}.read as Parent A → filter student ∈ [1001] (chặn con B 1002)`,
        readFn,
        asReq(parentA),
        isFilteredByStudentIn([1001]),
      )
      await expect(
        `${name}.read as Parent B → filter student ∈ [1002] (chặn con A 1001)`,
        readFn,
        asReq(parentB),
        isFilteredByStudentIn([1002]),
      )
      await expect(
        `${name}.read as orphan parent (no children) → denied`,
        readFn,
        asReq(orphanParent),
        isStrictlyFalse,
      )
      await expect(`${name}.read as anonymous → denied`, readFn, asReq(anon), isStrictlyFalse)
    }
    for (const op of ['create', 'update', 'delete'] as const) {
      const fn = coll.access?.[op]
      if (!fn) {
        record(`${name}.access.${op} defined`, false, 'missing → public write possible')
        continue
      }
      await expect(
        `${name}.${op} as Parent A → denied (staff only)`,
        fn,
        asReq(parentA),
        isStrictlyFalse,
      )
      await expect(`${name}.${op} as anonymous → denied`, fn, asReq(anon), isStrictlyFalse)
      await expect(`${name}.${op} as staff → allowed`, fn, asReq(staff), isStrictlyTrue)
    }
  }

  // 13. TuitionCycles.read — Parent A filter student ∈ [1001]
  //     (Trước fix: collection KHÔNG có access → bất kỳ ai cũng đọc được mọi cycle.)
  const tcAccessRead = TuitionCycles.access?.read
  if (!tcAccessRead) {
    record(
      'TuitionCycles.access.read defined',
      false,
      'CRITICAL: TuitionCycles vẫn không có access.read → mọi phụ huynh đọc được mọi cycle',
    )
  } else {
    record('TuitionCycles.access.read defined', true, 'function exists')
    await expect(
      'TuitionCycles.read as Parent A → filter student ∈ [1001]',
      tcAccessRead,
      asReq(parentA),
      isFilteredByStudentIn([1001]),
    )
    await expect(
      'TuitionCycles.read as anonymous → denied',
      tcAccessRead,
      asReq(anon),
      isStrictlyFalse,
    )
    await expect(
      'TuitionCycles.read as staff → full access',
      tcAccessRead,
      asReq(staff),
      isStrictlyTrue,
    )
  }
  // TuitionCycles write must be staff-only
  for (const op of ['create', 'update', 'delete'] as const) {
    const fn = TuitionCycles.access?.[op]
    if (!fn) {
      record(`TuitionCycles.access.${op} defined`, false, 'missing → public write possible')
      continue
    }
    await expect(
      `TuitionCycles.${op} as Parent A → denied (staff only)`,
      fn,
      asReq(parentA),
      isStrictlyFalse,
    )
    await expect(`TuitionCycles.${op} as staff → allowed`, fn, asReq(staff), isStrictlyTrue)
    await expect(`TuitionCycles.${op} as anonymous → denied`, fn, asReq(anon), isStrictlyFalse)
  }

  // 13b. RenewalRequests — phụ huynh chỉ đọc yêu cầu của mình; create chỉ con mình
  await expect(
    'RenewalRequests.read as Parent A → filter parent=101',
    readRenewalRequest,
    asReq(parentA),
    (v) => {
      if (!isWhere(v)) return { ok: false, detail: `expected Where, got ${JSON.stringify(v)}` }
      const parentEq = (v as { parent?: { equals?: number } }).parent?.equals
      return {
        ok: parentEq === 101,
        detail: parentEq === 101 ? 'parent.equals=101' : `got parent.equals=${parentEq}`,
      }
    },
  )
  await expect(
    'RenewalRequests.read as Parent B → filter parent=102 (≠ Parent A)',
    readRenewalRequest,
    asReq(parentB),
    (v) => {
      if (!isWhere(v)) return { ok: false, detail: `expected Where, got ${JSON.stringify(v)}` }
      const parentEq = (v as { parent?: { equals?: number } }).parent?.equals
      return {
        ok: parentEq === 102,
        detail: parentEq === 102 ? 'parent.equals=102' : `got parent.equals=${parentEq}`,
      }
    },
  )
  await expect(
    'RenewalRequests.read as anonymous → denied',
    readRenewalRequest,
    asReq(anon),
    isStrictlyFalse,
  )
  await expect(
    'RenewalRequests.create as Parent A for own child → allowed',
    createRenewalForOwnChild,
    { req: { user: parentA }, data: { student: 1001, parent: 101 } } as Parameters<
      typeof createRenewalForOwnChild
    >[0],
    isStrictlyTrue,
  )
  await expect(
    'RenewalRequests.create as Parent A for Parent B child → denied',
    createRenewalForOwnChild,
    { req: { user: parentA }, data: { student: 1002, parent: 101 } } as Parameters<
      typeof createRenewalForOwnChild
    >[0],
    isStrictlyFalse,
  )
  await expect(
    'RenewalRequests.create as Parent A with wrong parent id → denied',
    createRenewalForOwnChild,
    { req: { user: parentA }, data: { student: 1001, parent: 102 } } as Parameters<
      typeof createRenewalForOwnChild
    >[0],
    isStrictlyFalse,
  )
  for (const op of ['update', 'delete'] as const) {
    const fn = RenewalRequests.access?.[op]
    if (!fn) {
      record(`RenewalRequests.access.${op} defined`, false, 'missing')
      continue
    }
    await expect(
      `RenewalRequests.${op} as Parent A → denied (staff only)`,
      fn,
      asReq(parentA),
      isStrictlyFalse,
    )
  }

  // 14. Parents.read — Parent A chỉ đọc CHÍNH mình (id.equals)
  await expect(
    'Parents.read as Parent A → filter id=101 (chính mình)',
    readParentSelf,
    asReq(parentA),
    isIdEquals(101),
  )
  await expect(
    'Parents.read as Parent B → filter id=102 (không trùng Parent A id=101)',
    readParentSelf,
    asReq(parentB),
    isIdEquals(102),
  )
  await expect('Parents.read as staff → full access', readParentSelf, asReq(staff), isStrictlyTrue)
  await expect('Parents.read as anonymous → denied', readParentSelf, asReq(anon), isStrictlyFalse)

  // 15. Parents.update — Parent A chỉ sửa CHÍNH mình
  await expect(
    'Parents.update as Parent A → filter id=101 (không thể PATCH Parent B)',
    updateParentSelf,
    asReq(parentA),
    isIdEquals(101),
  )

  // 16. Parents create/delete chỉ staff
  await expect(
    'Parents.create as Parent A → denied (staff only)',
    staffOnly,
    asReq(parentA),
    isStrictlyFalse,
  )
  await expect(
    'Parents.delete as Parent A → denied (staff only)',
    staffOnly,
    asReq(parentA),
    isStrictlyFalse,
  )

  // 17. Privilege escalation guard: field-level access trên Parents.children
  const childrenField = Parents.fields?.find(
    (f) => 'name' in f && (f as { name: string }).name === 'children',
  ) as { access?: { create?: FieldAccess; update?: FieldAccess } } | undefined
  if (!childrenField?.access?.update || !childrenField.access.create) {
    record(
      'Parents.children field-level write locked',
      false,
      'CRITICAL: chưa khóa → Parent A có thể PATCH self và thêm StudentB vào children',
    )
  } else {
    record('Parents.children field-level access exists', true)
    await expect(
      'Parents.children.update as Parent A → denied (escalation blocked)',
      childrenField.access.update,
      asReq(parentA),
      isStrictlyFalse,
    )
    await expect(
      'Parents.children.update as staff → allowed',
      childrenField.access.update,
      asReq(staff),
      isStrictlyTrue,
    )
  }

  // 18. Field-level access trên Parents.phone (chống login hijack)
  const phoneField = Parents.fields?.find(
    (f) => 'name' in f && (f as { name: string }).name === 'phone',
  ) as { access?: { create?: FieldAccess; update?: FieldAccess } } | undefined
  if (!phoneField?.access?.update) {
    record(
      'Parents.phone field-level write locked',
      false,
      'CRITICAL: Parent A có thể đổi phone của chính mình → hijack login identifier',
    )
  } else {
    await expect(
      'Parents.phone.update as Parent A → denied (login hijack blocked)',
      phoneField.access.update,
      asReq(parentA),
      isStrictlyFalse,
    )
    await expect(
      'Parents.phone.update as staff → allowed',
      phoneField.access.update,
      asReq(staff),
      isStrictlyTrue,
    )
  }

  // 19. staffOnlyFieldWrite anon
  await expect(
    'staffOnlyFieldWrite as anonymous → denied',
    staffOnlyFieldWrite,
    asReq(anon),
    isStrictlyFalse,
  )

  // 20. Sanity: cross-collection — Students access không phải lúc nào cũng `true`
  //     (chống regression: nếu ai đổi readStudentForParent → true thì test này fail)
  await expect(
    'Students.read as Parent A is NOT unconditional true',
    readStudentForParent,
    asReq(parentA),
    (v) => ({
      ok: v !== true && v !== false,
      detail:
        v !== true && v !== false
          ? 'returns scoped Where (correct)'
          : `LEAK or DENY: ${JSON.stringify(v)}`,
    }),
  )

  // 21. Cross-check write paths for content collections — staff only
  for (const [name, coll] of [
    ['Students', Students],
    ['ProgressReports', ProgressReports],
    ['Attendance', Attendance],
    ['TuitionCycles', TuitionCycles],
  ] as const) {
    for (const op of ['create', 'update', 'delete'] as const) {
      const fn = coll.access?.[op]
      if (!fn) {
        record(`${name}.access.${op} defined`, false, 'missing — could allow public write')
        continue
      }
      await expect(`${name}.${op} as Parent A → denied`, fn, asReq(parentA), isStrictlyFalse)
      await expect(`${name}.${op} as anonymous → denied`, fn, asReq(anon), isStrictlyFalse)
    }
  }

  // 22. OtpCodes — fully sealed for every actor (kể cả staff qua API)
  for (const op of ['create', 'read', 'update', 'delete'] as const) {
    const fn = OtpCodes.access?.[op]
    if (!fn) {
      record(`OtpCodes.access.${op}`, false, 'missing → API exposure')
      continue
    }
    for (const [who, ctx] of [
      ['Parent A', parentA],
      ['staff', staff],
      ['anonymous', anon],
    ] as const) {
      await expect(`OtpCodes.${op} as ${who} → denied (sealed)`, fn, asReq(ctx), isStrictlyFalse)
    }
  }

  // ─── Summary ────────────────────────────────────────────────────────────────
  const failed = results.filter((r) => !r.pass)

  console.log(`\n=== Summary: ${results.length - failed.length}/${results.length} passed ===`)
  if (failed.length > 0) {
    console.log('\nFAILURES:')
    for (const f of failed) {
      console.log(`  - ${f.name}: ${f.detail ?? ''}`)
    }
    process.exit(1)
  }
  process.exit(0)
}

main().catch((e) => {
  console.error('Fatal:', e)
  process.exit(2)
})
