import type { Payload } from 'payload'
import type { ImportOptions } from './types'
import { normalizeName, parseDateString } from './nhan-xet-buoi'
import { parseAmount } from './payments'

/**
 * Import idempotent TÀI CHÍNH – vế CHI từ Lark:
 *  - `expense-categories` ← bảng Lark "Khoản chi" (khóa: TÊN đã chuẩn hóa).
 *  - `expenses`           ← bảng Lark "Tổng hợp Chi" (khóa: category|spentAt|amount).
 *
 * Idempotent: chạy lại cùng nguồn KHÔNG nhân đôi (khóa đã có → update, chưa →
 * create). Danh mục TÊN TRỐNG bị bỏ qua (bảng Lark có nhiều dòng rỗng). Phiếu chi
 * không resolve được danh mục → BÁO LỖI để soát tay (category là bắt buộc).
 *
 * Module KHÔNG `import 'server-only'` để dùng được ở script CLI. Thao tác DB dùng
 * overrideAccess (quyền đã kiểm ở lớp gọi).
 */

type CoSo = 'kim_lien' | 'vinh_phuc'
type Method = 'tien_mat' | 'ck'

/** Bỏ dấu + ký tự không phải [a-z0-9] → '_' (cho alias enum). */
function token(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

/** Suy ra cơ sở từ một chuỗi (tên người nhận / tên danh mục) — accent-insensitive. */
export function deriveCoSo(...texts: (string | undefined)[]): CoSo | undefined {
  for (const t of texts) {
    if (!t) continue
    const n = normalizeName(t)
    if (n.includes('vinh phuc')) return 'vinh_phuc'
    if (n.includes('kim lien')) return 'kim_lien'
  }
  return undefined
}

const METHOD_ALIASES: Record<string, Method> = {
  tien_mat: 'tien_mat',
  tienmat: 'tien_mat',
  cash: 'tien_mat',
  ck: 'ck',
  chuyen_khoan: 'ck',
  bank: 'ck',
}

// ── Danh mục chi ────────────────────────────────────────────────────────────

export type CategoryRow = { larkId: string; name?: string; description?: string }

export type CategoryImportResult = {
  created: number
  updated: number
  skipped: number
  errors: number
  /** larkRecordId → id của expense-categories trong DB (null = SẼ tạo ở dry-run). */
  idByLarkId: Map<string, number | null>
}

export async function importExpenseCategories(
  payload: Payload,
  rows: CategoryRow[],
  opts: ImportOptions = {},
): Promise<CategoryImportResult> {
  const dryRun = opts.dryRun ?? false
  const res: CategoryImportResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    idByLarkId: new Map(),
  }

  // Index danh mục đã có theo tên chuẩn hóa.
  const existing = await payload.find({
    collection: 'expense-categories',
    pagination: false,
    overrideAccess: true,
    depth: 0,
  })
  const idByName = new Map<string, number>()
  for (const c of existing.docs) {
    const key = normalizeName(String((c as { name?: string }).name ?? ''))
    if (key) idByName.set(key, c.id as number)
  }

  const seen = new Set<string>()
  for (const row of rows) {
    const name = (row.name ?? '').trim()
    if (!name) {
      res.skipped += 1 // dòng danh mục trống của Lark
      continue
    }
    const key = normalizeName(name)
    if (seen.has(key)) {
      // Trùng tên trong cùng nguồn → trỏ về id đã biết, không tạo lại.
      const known = idByName.get(key) ?? null
      res.idByLarkId.set(row.larkId, known)
      res.skipped += 1
      continue
    }
    seen.add(key)

    const data: Record<string, unknown> = { name }
    if (row.description && row.description.trim()) data.description = row.description.trim()

    try {
      const found = idByName.get(key)
      if (found != null) {
        if (!dryRun) {
          await payload.update({
            collection: 'expense-categories',
            id: found,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: data as any,
            overrideAccess: true,
          })
        }
        res.idByLarkId.set(row.larkId, found)
        res.updated += 1
      } else {
        let newId: number | null = null
        if (!dryRun) {
          const created = await payload.create({
            collection: 'expense-categories',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: data as any,
            overrideAccess: true,
          })
          newId = created.id as number
          idByName.set(key, newId)
        }
        res.idByLarkId.set(row.larkId, newId)
        res.created += 1
      }
    } catch {
      res.errors += 1
    }
  }
  return res
}

// ── Phiếu chi ───────────────────────────────────────────────────────────────

export type ExpenseRow = {
  larkId: string
  categoryLarkId?: string
  amountRaw?: string
  spentAtRaw?: string
  nguoiNhan?: string
  httt?: string
  kyHieu?: string
}

export type ExpenseOutcome =
  | { row: number; status: 'created' | 'updated'; label: string }
  | { row: number; status: 'skipped'; label: string; message: string }
  | { row: number; status: 'error'; message: string; field?: string }

export type ExpenseImportResult = {
  fileName: string
  totalRows: number
  created: number
  updated: number
  skipped: number
  errors: number
  outcomes: ExpenseOutcome[]
}

export async function importExpenses(
  payload: Payload,
  fileName: string,
  rows: ExpenseRow[],
  categoryIdByLarkId: Map<string, number | null>,
  opts: ImportOptions = {},
): Promise<ExpenseImportResult> {
  const dryRun = opts.dryRun ?? false
  const result: ExpenseImportResult = {
    fileName,
    totalRows: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    outcomes: [],
  }
  const record = (o: ExpenseOutcome) => {
    result.outcomes.push(o)
    result[o.status === 'error' ? 'errors' : o.status] += 1
  }

  const seenInFile = new Set<string>()

  for (let i = 0; i < rows.length; i += 1) {
    const rowNumber = i + 1
    const r = rows[i]

    // 1) Số tiền (bắt buộc)
    const amount = parseAmount(r.amountRaw)
    if (amount === undefined || amount === null) {
      record({
        row: rowNumber,
        status: 'error',
        message: `Số tiền "${r.amountRaw ?? ''}" trống/không hợp lệ.`,
        field: 'so_tien',
      })
      continue
    }

    // 2) Ngày chi (bắt buộc — thành phần khóa)
    const spentAt = r.spentAtRaw ? parseDateString(r.spentAtRaw) : null
    if (!spentAt) {
      record({
        row: rowNumber,
        status: 'error',
        message: `Ngày chi "${r.spentAtRaw ?? ''}" trống/không hợp lệ.`,
        field: 'ngay_chi',
      })
      continue
    }

    // 3) Danh mục (bắt buộc) — resolve qua link Lark
    const hasCat = r.categoryLarkId && categoryIdByLarkId.has(r.categoryLarkId)
    if (!hasCat) {
      record({
        row: rowNumber,
        status: 'error',
        message: `Không resolve được danh mục chi (link trống hoặc danh mục trống tên). Cần gán tay.`,
        field: 'thuoc_khoan',
      })
      continue
    }
    const categoryId = categoryIdByLarkId.get(r.categoryLarkId as string) ?? null

    // 4) Field phụ
    const coSo = deriveCoSo(r.nguoiNhan)
    let method: Method | undefined
    if (r.httt && r.httt.trim()) {
      method = METHOD_ALIASES[token(r.httt)]
    }
    const payee = r.nguoiNhan?.trim() || undefined
    const note = r.kyHieu?.trim() || undefined

    const label = `${spentAt} — ${amount.toLocaleString('vi-VN')}đ${payee ? ` — ${payee}` : ''}`
    const fileKey = `${categoryId ?? 'new'}|${spentAt}|${amount}`
    if (seenInFile.has(fileKey)) {
      record({
        row: rowNumber,
        status: 'skipped',
        label,
        message: 'Trùng dòng trước trong cùng nguồn — bỏ qua.',
      })
      continue
    }
    seenInFile.add(fileKey)

    const data: Record<string, unknown> = { amount, spentAt }
    if (categoryId != null) data.category = categoryId
    if (coSo !== undefined) data.coSo = coSo
    if (method !== undefined) data.method = method
    if (payee !== undefined) data.payee = payee
    if (note !== undefined) data.note = note

    try {
      // Khóa idempotent: category|spentAt|amount. Dry-run với danh mục SẼ tạo
      // (categoryId null) ⇒ coi như chưa tồn tại (sẽ create), không query.
      let exists = false
      let existingId: number | string | undefined
      if (categoryId != null) {
        const found = await payload.find({
          collection: 'expenses',
          where: {
            and: [
              { category: { equals: categoryId } },
              { spentAt: { equals: spentAt } },
              { amount: { equals: amount } },
            ],
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
          limit: 1,
          overrideAccess: true,
          depth: 0,
        })
        exists = found.totalDocs > 0
        existingId = found.docs[0]?.id
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const writeData = data as any
      if (exists && existingId != null) {
        if (!dryRun) {
          await payload.update({
            collection: 'expenses',
            id: existingId,
            data: writeData,
            overrideAccess: true,
          })
        }
        record({ row: rowNumber, status: 'updated', label })
      } else {
        if (!dryRun) {
          await payload.create({ collection: 'expenses', data: writeData, overrideAccess: true })
        }
        record({ row: rowNumber, status: 'created', label })
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
