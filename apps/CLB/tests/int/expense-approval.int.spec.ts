import { describe, it, expect } from 'vitest'
import type { FieldAccess } from 'payload'
import { Expenses } from '@/collections/Expenses'

/**
 * Tách trách nhiệm 🔒: field `trangThai` (+ duyetBoi/ngayDuyet/lyDoTuChoi) chỉ
 * admin/manager ghi được — kế toán tạo phiếu nhưng KHÔNG tự duyệt.
 */
type Field = { name?: string; access?: { update?: FieldAccess } }

function updateAccessOf(name: string): FieldAccess {
  const f = (Expenses.fields as Field[]).find((x) => x.name === name)
  if (!f?.access?.update) throw new Error(`field ${name} thiếu access.update`)
  return f.access.update
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asReq = (role: string | null): any => ({
  req: { user: role ? { collection: 'users', role } : null },
})

describe('Duyệt phiếu chi — field duyệt chỉ admin/manager ghi 🔒', () => {
  for (const fieldName of ['trangThai', 'duyetBoi', 'ngayDuyet', 'lyDoTuChoi']) {
    describe(fieldName, () => {
      const access = updateAccessOf(fieldName)
      it('admin + manager ⇒ true', () => {
        expect(access(asReq('admin'))).toBe(true)
        expect(access(asReq('manager'))).toBe(true)
      })
      it('kế toán KHÔNG tự duyệt ⇒ false', () => {
        expect(access(asReq('accountant'))).toBe(false)
      })
      it('coach/receptionist/anon ⇒ false', () => {
        expect(access(asReq('coach'))).toBe(false)
        expect(access(asReq('receptionist'))).toBe(false)
        expect(access(asReq(null))).toBe(false)
      })
    })
  }
})
