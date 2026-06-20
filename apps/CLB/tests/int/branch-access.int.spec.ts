import type { Access, Where } from 'payload'
import { describe, it, expect } from 'vitest'

import type { Class, Student, User } from '@/payload-types'
import {
  GLOBAL_BRANCH_ROLES,
  isGlobalBranchUser,
  resolveBranchIds,
  withBranchScope,
} from '@/access/branch'
import { Students } from '@/collections/Students'
import { Classes } from '@/collections/Classes'
import { Attendance } from '@/collections/Attendance'
import { Payments } from '@/collections/Payments'
import { ProgressReports } from '@/collections/ProgressReports'
import { TuitionCycles } from '@/collections/TuitionCycles'
import { StudentLevels } from '@/collections/StudentLevels'
import { Enrollments } from '@/collections/Enrollments'
import { RenewalRequests } from '@/collections/RenewalRequests'

// ─── Cơ sở ────────────────────────────────────────────────────────────────────
const KIM_LIEN = 1
const VINH_PHUC = 2

// ─── Actors (nhân viên) ─────────────────────────────────────────────────────────
const admin = { id: 1, collection: 'users', role: 'admin' } as unknown as User
const manager = { id: 2, collection: 'users', role: 'manager' } as unknown as User
const accountant = { id: 3, collection: 'users', role: 'accountant' } as unknown as User
const coachKL = {
  id: 10,
  collection: 'users',
  role: 'coach',
  location: KIM_LIEN,
} as unknown as User
const receptionistVP = {
  id: 11,
  collection: 'users',
  role: 'receptionist',
  location: VINH_PHUC,
} as unknown as User
// coach chưa được gán cơ sở (location trống) — fail-closed
const coachNoBranch = { id: 12, collection: 'users', role: 'coach' } as unknown as User
// receptionist với location đã populate dạng object {id} (depth>0)
const coachKLPopulated = {
  id: 13,
  collection: 'users',
  role: 'coach',
  location: { id: KIM_LIEN, name: 'Kim Liên' },
} as unknown as User
// coach gán NHIỀU cơ sở (KL + VP) — multi-location
const coachMulti = {
  id: 14,
  collection: 'users',
  role: ['coach'],
  location: [KIM_LIEN, VINH_PHUC],
} as unknown as User
// nhân viên ĐA-ROLE: manager (global) + coach ⇒ global thắng
const managerCoach = {
  id: 15,
  collection: 'users',
  role: ['manager', 'coach'],
  location: [KIM_LIEN],
} as unknown as User

// ─── Actors khác ────────────────────────────────────────────────────────────────
const parentA = { id: 101, collection: 'parents', children: [1001] } as const
const anon = null

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asReq = (user: any) => ({ req: { user } }) as any

// ─── Đánh giá Where trên một document ────────────────────────────────────────────
function relId(v: unknown): number | null {
  if (typeof v === 'number') return v
  if (v && typeof v === 'object' && 'id' in v) {
    const id = (v as { id: unknown }).id
    return typeof id === 'number' ? id : null
  }
  return null
}

/** Khớp Where (đủ shape ta dùng: location.equals, id.in, và `and`). */
function matchesWhere(where: Where, doc: { id: number; location?: unknown }): boolean {
  if (Array.isArray((where as { and?: Where[] }).and)) {
    return (where as { and: Where[] }).and.every((w) => matchesWhere(w, doc))
  }
  const loc = (where as { location?: { equals?: number; in?: number[] } }).location
  if (loc?.equals !== undefined) {
    if (relId(doc.location) !== loc.equals) return false
  }
  if (Array.isArray(loc?.in)) {
    const dl = relId(doc.location)
    if (dl == null || !loc!.in!.includes(dl)) return false
  }
  const idIn = (where as { id?: { in?: number[] } }).id?.in
  if (Array.isArray(idIn)) {
    if (!idIn.includes(doc.id)) return false
  }
  return true
}

/** Áp kết quả access.read lên một tập doc → danh sách id hiển thị. */
function visibleIds(
  access: Access,
  user: unknown,
  docs: Array<{ id: number; location?: unknown }>,
): number[] {
  const res = access(asReq(user)) as boolean | Where
  if (res === true) return docs.map((d) => d.id)
  if (res === false) return []
  return docs.filter((d) => matchesWhere(res, d)).map((d) => d.id)
}

// ─── Dữ liệu mẫu ────────────────────────────────────────────────────────────────
const studentKL = { id: 1001, location: KIM_LIEN } as unknown as Student
const studentVP = { id: 1002, location: VINH_PHUC } as unknown as Student
const studentNoLoc = { id: 1003, location: null } as unknown as Student
const allStudents = [studentKL, studentVP, studentNoLoc]

const classKL = { id: 5001, location: KIM_LIEN } as unknown as Class
const classVP = { id: 5002, location: VINH_PHUC } as unknown as Class
const allClasses = [classKL, classVP]

// ════════════════════════════════════════════════════════════════════════════════
describe('branch — hằng số & helper', () => {
  it('GLOBAL_BRANCH_ROLES = admin + manager + accountant', () => {
    expect([...GLOBAL_BRANCH_ROLES].sort()).toEqual(['accountant', 'admin', 'manager'].sort())
  })

  it('isGlobalBranchUser: global roles ✔, coach/receptionist ✘, phụ huynh/anon ✘', () => {
    expect(isGlobalBranchUser(admin)).toBe(true)
    expect(isGlobalBranchUser(manager)).toBe(true)
    expect(isGlobalBranchUser(accountant)).toBe(true)
    expect(isGlobalBranchUser(coachKL)).toBe(false)
    expect(isGlobalBranchUser(receptionistVP)).toBe(false)
    // phụ huynh không có role ⇒ không global (kể cả nếu lỡ mang role)
    expect(isGlobalBranchUser(parentA as unknown as User)).toBe(false)
    expect(isGlobalBranchUser(anon)).toBe(false)
  })

  it('resolveBranchIds: đọc location (số/{id}/mảng) → MẢNG id; non-staff/anon → []', () => {
    expect(resolveBranchIds(coachKL)).toEqual([KIM_LIEN])
    expect(resolveBranchIds(coachKLPopulated)).toEqual([KIM_LIEN])
    expect(resolveBranchIds(coachMulti)).toEqual([KIM_LIEN, VINH_PHUC])
    expect(resolveBranchIds(coachNoBranch)).toEqual([])
    expect(resolveBranchIds(parentA as unknown as User)).toEqual([])
    expect(resolveBranchIds(anon)).toEqual([])
  })

  it('đa-role: có BẤT KỲ vai trò global ⇒ isGlobalBranchUser = true', () => {
    expect(isGlobalBranchUser(managerCoach)).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════════
describe('withBranchScope — combinator thuần', () => {
  // gate đơn giản: cho mọi nhân viên (giống staffOnly)
  const staffGate: Access = ({ req }) =>
    !!req.user && (req.user as { collection?: string }).collection === 'users'

  it('gate trả false ⇒ trả false (không áp branch)', () => {
    const scoped = withBranchScope(staffGate)
    expect(scoped(asReq(parentA))).toBe(false)
    expect(scoped(asReq(anon))).toBe(false)
  })

  it('vai trò global ⇒ true; bị-khóa ⇒ Where; chưa gán ⇒ false', () => {
    const scoped = withBranchScope(staffGate)
    expect(scoped(asReq(admin))).toBe(true)
    expect(scoped(asReq(coachKL))).toEqual({ location: { in: [KIM_LIEN] } })
    expect(scoped(asReq(coachNoBranch))).toBe(false)
  })

  it('tôn trọng tham số `field` tùy biến', () => {
    const scoped = withBranchScope(staffGate, 'coSo')
    expect(scoped(asReq(coachKL))).toEqual({ coSo: { in: [KIM_LIEN] } })
  })

  it('gate trả Where (vd phụ huynh) ⇒ trả nguyên, KHÔNG chồng branch', () => {
    const parentLike: Access = () => ({ id: { in: [1001] } })
    const scoped = withBranchScope(parentLike)
    expect(scoped(asReq(parentA))).toEqual({ id: { in: [1001] } })
  })
})

// ════════════════════════════════════════════════════════════════════════════════
describe('Students.read — phân quyền theo cơ sở 🔒 (Acceptance)', () => {
  const read = Students.access?.read as Access

  it('ACCEPTANCE: coach Kim Liên KHÔNG đọc được HV Vĩnh Phúc; ĐỌC được HV Kim Liên', () => {
    const seen = visibleIds(read, coachKL, allStudents)
    expect(seen).toContain(studentKL.id) // cùng cơ sở ✔
    expect(seen).not.toContain(studentVP.id) // chéo cơ sở ✘
    expect(seen).not.toContain(studentNoLoc.id) // HV chưa gán cơ sở: coach KL không thấy
  })

  it('ACCEPTANCE: admin xem TẤT CẢ học viên (mọi cơ sở)', () => {
    expect(visibleIds(read, admin, allStudents).sort()).toEqual(allStudents.map((s) => s.id).sort())
  })

  it('manager + accountant (global) cũng xem tất cả', () => {
    expect(visibleIds(read, manager, allStudents)).toHaveLength(3)
    expect(visibleIds(read, accountant, allStudents)).toHaveLength(3)
  })

  it('receptionist Vĩnh Phúc chỉ thấy HV Vĩnh Phúc (không thấy Kim Liên)', () => {
    const seen = visibleIds(read, receptionistVP, allStudents)
    expect(seen).toEqual([studentVP.id])
  })

  it('coach CHƯA gán cơ sở ⇒ fail-closed: không thấy HV nào', () => {
    expect(visibleIds(read, coachNoBranch, allStudents)).toEqual([])
  })

  it('location đã populate {id} vẫn lọc đúng', () => {
    expect(visibleIds(read, coachKLPopulated, allStudents)).toEqual([studentKL.id])
  })

  it('coach NHIỀU cơ sở (KL+VP) ⇒ thấy HV cả 2 cơ sở (không thấy HV chưa gán)', () => {
    const seen = visibleIds(read, coachMulti, allStudents).sort()
    expect(seen).toEqual([studentKL.id, studentVP.id].sort())
    expect(seen).not.toContain(studentNoLoc.id)
  })

  it('phụ huynh: vẫn lọc theo con (không bị branch chồng lên); anon bị cấm', () => {
    // parentA có con #1001 (HV Kim Liên) ⇒ chỉ thấy 1001
    expect(visibleIds(read, parentA, allStudents)).toEqual([1001])
    expect(read(asReq(anon))).toBe(false)
  })
})

describe('Students.update / delete — chặn ghi chéo cơ sở 🔒', () => {
  const update = Students.access?.update as Access
  const del = Students.access?.delete as Access

  it('coach Kim Liên: chỉ sửa/xóa được HV Kim Liên (Where theo location)', () => {
    expect(update(asReq(coachKL))).toEqual({ location: { in: [KIM_LIEN] } })
    expect(del(asReq(coachKL))).toEqual({ location: { in: [KIM_LIEN] } })
    // áp lên doc Vĩnh Phúc ⇒ không khớp ⇒ không sửa/xóa được
    expect(matchesWhere(update(asReq(coachKL)) as Where, studentVP)).toBe(false)
    expect(matchesWhere(update(asReq(coachKL)) as Where, studentKL)).toBe(true)
  })

  it('admin sửa/xóa mọi HV; phụ huynh & anon bị cấm', () => {
    expect(update(asReq(admin))).toBe(true)
    expect(del(asReq(admin))).toBe(true)
    expect(update(asReq(parentA))).toBe(false)
    expect(del(asReq(anon))).toBe(false)
  })

  it('coach chưa gán cơ sở ⇒ không sửa/xóa được gì', () => {
    expect(update(asReq(coachNoBranch))).toBe(false)
    expect(del(asReq(coachNoBranch))).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════════
describe('Classes — đọc công khai, GHI theo cơ sở 🔒', () => {
  const read = Classes.access?.read as Access
  const update = Classes.access?.update as Access
  const del = Classes.access?.delete as Access

  it('read CÔNG KHAI: anon + phụ huynh + mọi vai trò đều đọc được (không scope)', () => {
    expect(read(asReq(anon))).toBe(true)
    expect(read(asReq(parentA))).toBe(true)
    expect(read(asReq(coachKL))).toBe(true)
  })

  it('receptionist Vĩnh Phúc chỉ sửa/xóa lớp Vĩnh Phúc', () => {
    const w = update(asReq(receptionistVP)) as Where
    expect(w).toEqual({ location: { in: [VINH_PHUC] } })
    expect(matchesWhere(w, classVP)).toBe(true)
    expect(matchesWhere(w, classKL)).toBe(false)
    expect(del(asReq(receptionistVP))).toEqual({ location: { in: [VINH_PHUC] } })
  })

  it('admin/manager (global) sửa/xóa mọi lớp', () => {
    expect(update(asReq(admin))).toBe(true)
    expect(update(asReq(manager))).toBe(true)
  })

  it('coach KHÔNG quản lý lớp (role gate chặn trước branch); anon bị cấm ghi', () => {
    // coach không nằm trong hasRole(admin,manager,receptionist) ⇒ false ngay
    expect(update(asReq(coachKL))).toBe(false)
    expect(del(asReq(coachKL))).toBe(false)
    expect(update(asReq(anon))).toBe(false)
  })

  it('accountant là global NHƯNG không có quyền quản lý lớp ⇒ vẫn bị role gate chặn', () => {
    // accountant ∉ canManageContent ⇒ gate trả false trước khi tới nhánh global
    expect(update(asReq(accountant))).toBe(false)
  })

  // mọi lớp được liệt kê công khai bất kể cơ sở
  it('độ phủ: read trả true ⇒ mọi lớp hiển thị cho công chúng', () => {
    expect(visibleIds(read, anon, allClasses).sort()).toEqual(allClasses.map((c) => c.id).sort())
  })
})

// ════════════════════════════════════════════════════════════════════════════════
// Phase 4 — branch-scope các collection có quan hệ `student` (qua `student.location`).
// Khác Students/Classes (có `location` trực tiếp), các collection này scope qua đường
// quan hệ lồng `student.location`. Acceptance: nhân viên bị-khóa chỉ thao tác bản ghi
// của HV cùng cơ sở; global xem/ghi tất; luồng phụ huynh KHÔNG bị chồng branch.
// Combinator (sau Phase 5 multi-location) trả `{ in: [...] }` — KHÔNG `equals`.
// ════════════════════════════════════════════════════════════════════════════════
const STUDENT_LOCATION_IN = (...branches: number[]) => ({
  'student.location': { in: branches },
})

/** 7 collection student-relation; read + delete đồng nhất (delete = withBranchScope(staffOnly)). */
const STUDENT_BRANCH_COLLECTIONS = [
  ['attendance', Attendance],
  ['payments', Payments],
  ['progress-reports', ProgressReports],
  ['tuition-cycles', TuitionCycles],
  ['student-levels', StudentLevels],
  ['enrollments', Enrollments],
  ['renewal-requests', RenewalRequests],
] as const

describe('Student-relation collections — branch-scope theo student.location 🔒 (Phase 4)', () => {
  for (const [slug, coll] of STUDENT_BRANCH_COLLECTIONS) {
    describe(`${slug} — read + delete`, () => {
      const read = coll.access?.read as Access
      const del = coll.access?.delete as Access

      it('read: coach Kim Liên → { student.location: { in: [KIM_LIEN] } }', () => {
        expect(read(asReq(coachKL))).toEqual(STUDENT_LOCATION_IN(KIM_LIEN))
      })
      it('read: receptionist Vĩnh Phúc → { in: [VINH_PHUC] }', () => {
        expect(read(asReq(receptionistVP))).toEqual(STUDENT_LOCATION_IN(VINH_PHUC))
      })
      it('read: location populate {id} vẫn lọc đúng', () => {
        expect(read(asReq(coachKLPopulated))).toEqual(STUDENT_LOCATION_IN(KIM_LIEN))
      })
      it('read: coach NHIỀU cơ sở → { in: [KL, VP] }', () => {
        expect(read(asReq(coachMulti))).toEqual(STUDENT_LOCATION_IN(KIM_LIEN, VINH_PHUC))
      })
      it('read: admin/manager/accountant (global) → true', () => {
        expect(read(asReq(admin))).toBe(true)
        expect(read(asReq(manager))).toBe(true)
        expect(read(asReq(accountant))).toBe(true)
      })
      it('read: coach chưa gán cơ sở → false (fail-closed)', () => {
        expect(read(asReq(coachNoBranch))).toBe(false)
      })
      it('read: anon → false', () => {
        expect(read(asReq(anon))).toBe(false)
      })
      it('read: phụ huynh KHÔNG bị chồng branch (không có khóa student.location)', () => {
        const res = read(asReq(parentA))
        expect(res).not.toBe(true)
        expect(res).not.toBe(false)
        expect(JSON.stringify(res)).not.toContain('student.location')
      })
      it('delete: coach KL → scoped; admin → true; coachNoBranch/parent/anon → false', () => {
        expect(del(asReq(coachKL))).toEqual(STUDENT_LOCATION_IN(KIM_LIEN))
        expect(del(asReq(admin))).toBe(true)
        expect(del(asReq(coachNoBranch))).toBe(false)
        expect(del(asReq(parentA))).toBe(false)
        expect(del(asReq(anon))).toBe(false)
      })
    })
  }

  // update: 6 collection dùng withBranchScope(staffOnly) — đồng nhất.
  for (const [slug, coll] of STUDENT_BRANCH_COLLECTIONS) {
    if (slug === 'renewal-requests') continue
    describe(`update ${slug} (staffOnly + branch)`, () => {
      const update = coll.access?.update as Access
      it('coach KL → scoped; admin → true; coachNoBranch/parent/anon → false', () => {
        expect(update(asReq(coachKL))).toEqual(STUDENT_LOCATION_IN(KIM_LIEN))
        expect(update(asReq(admin))).toBe(true)
        expect(update(asReq(coachNoBranch))).toBe(false)
        expect(update(asReq(parentA))).toBe(false)
        expect(update(asReq(anon))).toBe(false)
      })
    })
  }

  // update renewal-requests = withBranchScope(canProcessRenewals): CHỈ role global
  // (admin/manager/accountant) — coach/receptionist bị gate chặn TRƯỚC branch.
  describe('update renewal-requests (canProcessRenewals + branch)', () => {
    const update = RenewalRequests.access?.update as Access
    it('role global → true; coach/receptionist/parent/anon → false', () => {
      expect(update(asReq(admin))).toBe(true)
      expect(update(asReq(manager))).toBe(true)
      expect(update(asReq(accountant))).toBe(true)
      expect(update(asReq(coachKL))).toBe(false)
      expect(update(asReq(receptionistVP))).toBe(false)
      expect(update(asReq(parentA))).toBe(false)
      expect(update(asReq(anon))).toBe(false)
    })
  })

  // Regression: read của phụ huynh GIỮ ĐÚNG filter quan hệ của từng collection.
  describe('phụ huynh — passthrough filter đúng theo từng collection', () => {
    it('attendance: parent A → { student: { in: [1001] } }', () => {
      expect(Attendance.access?.read?.(asReq(parentA))).toEqual({ student: { in: [1001] } })
    })
    it('progress-reports: parent A → and[student∈[1001], publishedAt not_equals null]', () => {
      expect(ProgressReports.access?.read?.(asReq(parentA))).toEqual({
        and: [{ student: { in: [1001] } }, { publishedAt: { not_equals: null } }],
      })
    })
    it('renewal-requests: parent A → { parent: { equals: 101 } } (lọc theo parent)', () => {
      expect(RenewalRequests.access?.read?.(asReq(parentA))).toEqual({
        parent: { equals: 101 },
      })
    })
  })
})
