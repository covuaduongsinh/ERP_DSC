import type { Payload } from 'payload'
import type { ImportOptions } from './types'
import { normalizeName, normalizeExact } from './nhan-xet-buoi'
import { normalizePhone, isValidVietnamesePhone } from '../phone'

/**
 * Import idempotent PHỤ HUYNH vào collection `parents` (nguồn: bảng "Contact"
 * trên Lark Base CRM).
 *
 * KHÓA ĐỊNH DANH (chống trùng): `phone` (SĐT đã chuẩn hóa) — cũng là định danh
 * đăng nhập cổng phụ huynh. Chạy lại KHÔNG nhân đôi: phone đã có → update (gộp
 * children, cập nhật tên/email/zalo), chưa có → create.
 *
 * BẮT BUỘC CÓ SĐT: Parents.phone là required + unique (login identity). Contact
 * KHÔNG có SĐT ⇒ KHÔNG tạo phụ huynh rỗng/giả — báo `skipped` (cần bổ sung SĐT
 * tay). SĐT sai định dạng VN ⇒ `error`.
 *
 * GẮN CON (children): khớp theo TÊN học viên (đã resolve từ link Lark) với
 * collection `students` — bỏ dấu + không phân biệt hoa/thường, gỡ nhập nhằng
 * bằng khớp CHÍNH XÁC giữ dấu. Không khớp (0 hoặc >1) ⇒ KHÔNG đoán, ghi vào danh
 * sách "con chưa khớp" để soát tay. Đồng bộ hai chiều: Students.parents ⊇ {parent}.
 *
 * KHÔNG `import 'server-only'` để dùng được ở cả Server Action lẫn script CLI.
 * Quyền ghi đã kiểm ở lớp gọi; thao tác DB dùng overrideAccess.
 */

/** Một dòng phụ huynh đầu vào (đã resolve tên con từ link Lark). */
export type ParentImportRow = {
  fullName: string
  phone: string
  email?: string
  zaloId?: string
  /** Tên các con (đã resolve từ link HocVien), để khớp Students theo tên. */
  childrenNames: string[]
}

export type ParentRowOutcome =
  | {
      row: number
      status: 'created' | 'updated'
      phone: string
      fullName: string
      parentId: number
      childrenLinked: number
      /** Tên con KHÔNG khớp được Students (0 hoặc >1) — soát tay. */
      childrenMissing: string[]
    }
  | {
      // Thiếu SĐT (không tạo được login identity) hoặc trùng SĐT với dòng trước
      // trong cùng file → bỏ qua, báo soát tay.
      row: number
      status: 'skipped'
      fullName: string
      message: string
    }
  | { row: number; status: 'error'; message: string; field?: string }

export type ParentImportResult = {
  fileName: string
  totalRows: number
  created: number
  updated: number
  skipped: number
  errors: number
  /** Dòng bỏ qua vì THIẾU SĐT (cần bổ sung tay để onboarding). */
  missingPhone: number
  /** Tổng lượt con gắn thành công vào phụ huynh. */
  childrenLinked: number
  /** Tên con xuất hiện nhưng không khớp Students: tên → số lần. */
  childrenMissing: Record<string, number>
  outcomes: ParentRowOutcome[]
}

type StudentRef = { id: number; fullName: string }

async function buildStudentIndex(payload: Payload): Promise<Map<string, StudentRef[]>> {
  const res = await payload.find({
    collection: 'students',
    pagination: false,
    overrideAccess: true,
    depth: 0,
  })
  const map = new Map<string, StudentRef[]>()
  for (const s of res.docs) {
    const fullName = String((s as { fullName?: string }).fullName ?? '')
    const key = normalizeName(fullName)
    if (!key) continue
    const arr = map.get(key) ?? []
    arr.push({ id: s.id as number, fullName })
    map.set(key, arr)
  }
  return map
}

/** Khớp 1 tên con với roster Students (giống matcher của payments). */
function matchStudent(
  ten: string,
  index: Map<string, StudentRef[]>,
): { ok: true; id: number } | { ok: false } {
  const cand = index.get(normalizeName(ten)) ?? []
  if (cand.length === 1) return { ok: true, id: cand[0].id }
  if (cand.length === 0) return { ok: false }
  const want = normalizeExact(ten)
  const exact = cand.filter((c) => normalizeExact(c.fullName) === want)
  if (exact.length === 1) return { ok: true, id: exact[0].id }
  return { ok: false }
}

function asIdArray(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value
    .map((v) => (typeof v === 'number' ? v : (v as { id?: number })?.id))
    .filter((id): id is number => typeof id === 'number')
}

export async function importParents(
  payload: Payload,
  fileName: string,
  rows: ParentImportRow[],
  opts: ImportOptions = {},
): Promise<ParentImportResult> {
  const dryRun = opts.dryRun ?? false
  const result: ParentImportResult = {
    fileName,
    totalRows: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    missingPhone: 0,
    childrenLinked: 0,
    childrenMissing: {},
    outcomes: [],
  }

  const record = (o: ParentRowOutcome) => {
    result.outcomes.push(o)
    if (o.status === 'created') result.created += 1
    else if (o.status === 'updated') result.updated += 1
    else if (o.status === 'skipped') result.skipped += 1
    else result.errors += 1
  }

  const studentIndex = await buildStudentIndex(payload)
  const seenPhones = new Set<string>()

  for (let i = 0; i < rows.length; i += 1) {
    const rowNumber = i + 1
    const row = rows[i]
    const fullName = (row.fullName ?? '').replace(/\s+/g, ' ').trim()

    // 1) Tên phụ huynh — bắt buộc (Parents.fullName required)
    if (!fullName) {
      record({
        row: rowNumber,
        status: 'error',
        message: 'Thiếu họ tên phụ huynh (Họ và tên PH contact).',
        field: 'fullName',
      })
      continue
    }

    // 2) SĐT — bắt buộc + hợp lệ (login identity). Trống → skip (cần bổ sung tay).
    const rawPhone = (row.phone ?? '').trim()
    if (!rawPhone) {
      result.missingPhone += 1
      record({
        row: rowNumber,
        status: 'skipped',
        fullName,
        message: 'Thiếu SĐT — không tạo được tài khoản phụ huynh. Cần bổ sung SĐT tay.',
      })
      continue
    }
    const phone = normalizePhone(rawPhone)
    if (!isValidVietnamesePhone(phone)) {
      record({
        row: rowNumber,
        status: 'error',
        message: `SĐT "${rawPhone}" không hợp lệ (cần đầu số di động VN).`,
        field: 'phone',
      })
      continue
    }
    if (seenPhones.has(phone)) {
      record({
        row: rowNumber,
        status: 'skipped',
        fullName,
        message: `Trùng SĐT ${phone} với dòng trước trong cùng file — bỏ qua.`,
      })
      continue
    }
    seenPhones.add(phone)

    // 3) Khớp con theo tên → studentIds (gỡ nhập nhằng, không đoán)
    const childIds: number[] = []
    const childrenMissing: string[] = []
    for (const rawName of row.childrenNames ?? []) {
      const name = (rawName ?? '').replace(/\s+/g, ' ').trim()
      if (!name) continue
      const m = matchStudent(name, studentIndex)
      if (m.ok) {
        if (!childIds.includes(m.id)) childIds.push(m.id)
      } else {
        childrenMissing.push(name)
        result.childrenMissing[name] = (result.childrenMissing[name] ?? 0) + 1
      }
    }

    try {
      // 4) Upsert theo phone (idempotent)
      const existing = await payload.find({
        collection: 'parents',
        where: { phone: { equals: phone } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })

      let parentId: number
      let mergedChildren: number[]

      if (existing.totalDocs > 0) {
        const doc = existing.docs[0]
        parentId = doc.id as number
        const prev = asIdArray((doc as { children?: unknown }).children)
        mergedChildren = Array.from(new Set([...prev, ...childIds]))
        // Chỉ set field có giá trị (không xóa dữ liệu nhập tay bằng chuỗi rỗng).
        const data: Record<string, unknown> = { fullName }
        if (row.email && row.email.trim()) data.email = row.email.trim()
        if (row.zaloId && row.zaloId.trim()) data.zaloId = row.zaloId.trim()
        if (mergedChildren.length !== prev.length) data.children = mergedChildren
        if (!dryRun) {
          await payload.update({
            collection: 'parents',
            id: parentId,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: data as any,
            overrideAccess: true,
          })
        }
        record({
          row: rowNumber,
          status: 'updated',
          phone,
          fullName,
          parentId,
          childrenLinked: childIds.length,
          childrenMissing,
        })
      } else {
        const data: Record<string, unknown> = { fullName, phone }
        if (row.email && row.email.trim()) data.email = row.email.trim()
        if (row.zaloId && row.zaloId.trim()) data.zaloId = row.zaloId.trim()
        if (childIds.length) data.children = childIds
        if (dryRun) {
          parentId = 0
        } else {
          const created = await payload.create({
            collection: 'parents',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: data as any,
            overrideAccess: true,
          })
          parentId = created.id as number
        }
        mergedChildren = childIds
        record({
          row: rowNumber,
          status: 'created',
          phone,
          fullName,
          parentId,
          childrenLinked: childIds.length,
          childrenMissing,
        })
      }

      result.childrenLinked += childIds.length

      // 5) Đồng bộ hai chiều: Students.parents ⊇ {parentId}
      if (!dryRun && parentId && childIds.length) {
        for (const sid of childIds) {
          const studentDoc = await payload.findByID({
            collection: 'students',
            id: sid,
            depth: 0,
            overrideAccess: true,
          })
          const parents = asIdArray((studentDoc as { parents?: unknown }).parents)
          if (!parents.includes(parentId)) {
            await payload.update({
              collection: 'students',
              id: sid,
              data: { parents: [...parents, parentId] },
              overrideAccess: true,
            })
          }
        }
      }
    } catch (err) {
      record({
        row: rowNumber,
        status: 'error',
        message: err instanceof Error ? err.message : 'Lỗi không xác định khi ghi DB.',
      })
    }
  }

  return result
}
