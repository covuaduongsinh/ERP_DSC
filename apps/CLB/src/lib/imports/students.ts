import type { Payload } from 'payload'
import { normalizePhone, isValidVietnamesePhone } from '../phone'
import type { ImportOptions } from './types'

/** Field học viên ghi được từ import (giữ kiểu chặt cho payload.create/update). */
type StudentWriteData = {
  nickname?: string
  location?: number
  dob?: string
  parents?: number[]
}

/**
 * Import idempotent danh sách HỌC VIÊN vào collection `students` từ file
 * HocVien_goc.csv (sổ gốc).
 *
 * KHÓA ĐỊNH DANH (chống trùng): `fullName` (đã gộp khoảng trắng, so khớp không
 * phân biệt hoa/thường + dấu). Chạy lại cùng file KHÔNG nhân đôi: đã có → update
 * các field có trong file, chưa có → create.
 *
 * Map cột:
 *   - `ho_ten`  → fullName (bắt buộc)
 *   - `nick`    → nickname
 *   - `co_so`   → location (tách "; ", lấy cơ sở CHÍNH = phần tử đầu; khớp tên Locations)
 *   - `cac_cap_do` / `cap_chinh` → TẠM BỎ QUA (xử lý ở SỬA 2 khi đã có Levels)
 *   - `*_CAN_BO_SUNG` (ngay_sinh / ho_ten_PH / sdt_PH): nếu CÓ dữ liệu → tạo/nối
 *     Parent (khử trùng theo sdt) + set ngày sinh học viên. Nếu TRỐNG → để trống,
 *     KHÔNG tạo Parent rỗng.
 *
 * Báo cáo theo dòng + tổng: số HV vào, số HV chưa có phụ huynh (chưa onboarding),
 * số Parent tạo mới / nối, các giá trị co_so không khớp Locations, và các dòng
 * TRÙNG TÊN cần soát tay.
 *
 * KHÔNG `import 'server-only'` để dùng được cả ở Server Action lẫn script CLI
 * (`payload run`). Quyền ghi kiểm ở lớp gọi; mọi thao tác DB dùng overrideAccess.
 */

export type NormalizedRow = Record<string, string>

export type StudentRowOutcome =
  | {
      row: number
      status: 'created' | 'updated'
      studentId: number
      fullName: string
      /** Sau khi import, học viên đã có ít nhất 1 phụ huynh? (false ⇒ chưa onboarding) */
      hasParent: boolean
    }
  | {
      // Trùng tên với dòng TRƯỚC trong cùng file, hoặc đụng nhiều bản ghi cùng
      // tên trong DB → bỏ qua, báo để soát tay (không ghi đè ngầm).
      row: number
      status: 'skipped'
      fullName: string
      message: string
    }
  | {
      row: number
      status: 'error'
      message: string
      field?: string
    }

export type StudentImportResult = {
  fileName: string
  totalRows: number
  created: number
  updated: number
  skipped: number
  errors: number
  /** Số HV vào DB lần này (created + updated). */
  imported: number
  /** Số HV (trong các dòng vào) chưa có phụ huynh ⇒ chưa onboarding được. */
  withoutParent: number
  /** Phụ huynh tạo mới trong lần import này. */
  parentsCreated: number
  /** Lượt nối phụ huynh (mới + đã có) vào học viên. */
  parentsLinked: number
  /** co_so xuất hiện trong file nhưng KHÔNG khớp Locations: giá trị → số dòng. */
  unmatchedLocations: Record<string, number>
  outcomes: StudentRowOutcome[]
}

/**
 * Khóa chống trùng theo tên: GIỮ DẤU tiếng Việt (chỉ lower-case + gộp khoảng
 * trắng). Cố ý không bỏ dấu — "Thanh" và "Thành" là hai tên KHÁC nhau, gộp lại
 * sẽ báo trùng giả. Trùng ở đây nghĩa là tên viết y hệt → soát tay.
 */
function nameKey(input: string): string {
  return input.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Bỏ dấu tiếng Việt + lower-case + gộp khoảng trắng (chỉ dùng khớp Locations). */
function foldLoose(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Gộp xuống dòng / khoảng trắng thừa thành một dấu cách, trim 2 đầu. */
function collapse(input: string): string {
  return input.replace(/\s+/g, ' ').trim()
}

function pick(row: NormalizedRow, ...keys: string[]): string {
  for (const k of keys) {
    const v = row[k]
    if (v != null && v.trim() !== '') return v.trim()
  }
  return ''
}

/** Parse ngày DD/MM/YYYY | D/M/YY | YYYY-MM-DD → ISO YYYY-MM-DD, hoặc null. */
function parseDob(input: string): string | null {
  const t = input.trim()
  if (!t) return null
  const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(t)
  if (iso) return buildDate(+iso[1], +iso[2], +iso[3])
  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(t)
  if (dmy) {
    let y = +dmy[3]
    if (y < 100) y += 2000
    return buildDate(y, +dmy[2], +dmy[1])
  }
  return null
}

function buildDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

type LocationRef = { id: number; name: string; fold: string }

/**
 * co_so → id Locations. Tách "; " lấy cơ sở CHÍNH (phần tử đầu), rồi khớp theo
 * kiểu "tên cơ sở CHỨA token" (vd "Kim Liên" ⊂ "Cơ sở Kim Liên — Đống Đa").
 */
function matchLocation(
  rawCoSo: string,
  locations: LocationRef[],
): { mainCoSo: string; locationId?: number } {
  const main = collapse(rawCoSo.split(';')[0] ?? '')
  if (!main) return { mainCoSo: '' }
  const needle = foldLoose(main)
  const hit = locations.find((l) => l.fold.includes(needle))
  return { mainCoSo: main, locationId: hit?.id }
}

function asIdArray(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  return value
    .map((v) => (typeof v === 'number' ? v : (v as { id?: number })?.id))
    .filter((id): id is number => typeof id === 'number')
}

export async function importStudents(
  payload: Payload,
  fileName: string,
  rows: NormalizedRow[],
  opts: ImportOptions = {},
): Promise<StudentImportResult> {
  const dryRun = opts.dryRun ?? false
  const result: StudentImportResult = {
    fileName,
    totalRows: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    imported: 0,
    withoutParent: 0,
    parentsCreated: 0,
    parentsLinked: 0,
    unmatchedLocations: {},
    outcomes: [],
  }

  const record = (o: StudentRowOutcome) => {
    result.outcomes.push(o)
    if (o.status === 'created') result.created += 1
    else if (o.status === 'updated') result.updated += 1
    else if (o.status === 'skipped') result.skipped += 1
    else result.errors += 1
    if (o.status === 'created' || o.status === 'updated') {
      result.imported += 1
      if (!o.hasParent) result.withoutParent += 1
    }
  }

  // Nạp toàn bộ Locations một lần để khớp co_so → id.
  const locRes = await payload.find({
    collection: 'locations',
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })
  const locations: LocationRef[] = locRes.docs.map((l) => ({
    id: l.id as number,
    name: (l as { name?: string }).name ?? '',
    fold: foldLoose((l as { name?: string }).name ?? ''),
  }))

  // Tên đã xử lý trong CÙNG file (báo trùng, không tự gộp).
  const seenInFile = new Set<string>()

  for (let i = 0; i < rows.length; i += 1) {
    const rowNumber = i + 1 // 1-based, không kể header
    const row = rows[i]

    // 1) Họ tên — khóa bắt buộc
    const fullName = collapse(pick(row, 'ho_ten'))
    if (!fullName) {
      record({
        row: rowNumber,
        status: 'error',
        message: 'Thiếu họ tên (ho_ten) — không thể định danh học viên.',
        field: 'ho_ten',
      })
      continue
    }

    const dedupeKey = nameKey(fullName)
    if (seenInFile.has(dedupeKey)) {
      record({
        row: rowNumber,
        status: 'skipped',
        fullName,
        message: `Trùng tên "${fullName}" với dòng trước trong cùng file — bỏ qua, soát tay nếu là 2 học viên khác nhau.`,
      })
      continue
    }
    seenInFile.add(dedupeKey)

    // 2) Các field map được
    const nickname = collapse(pick(row, 'nick')) || undefined
    const rawCoSo = pick(row, 'co_so')
    const { mainCoSo, locationId } = matchLocation(rawCoSo, locations)
    if (mainCoSo && locationId === undefined) {
      result.unmatchedLocations[mainCoSo] = (result.unmatchedLocations[mainCoSo] ?? 0) + 1
    }

    // 3) *_CAN_BO_SUNG → phụ huynh + ngày sinh (chỉ khi CÓ dữ liệu)
    const rawDob = pick(row, 'ngay_sinh_can_bo_sung', 'ngay_sinh')
    const dob = rawDob ? parseDob(rawDob) : null
    const phName = collapse(pick(row, 'ho_ten_ph_can_bo_sung', 'ho_ten_ph'))
    const rawPhone = pick(row, 'sdt_ph_can_bo_sung', 'sdt_ph', 'sdt')

    try {
      // 3a) Khử trùng / tạo Parent theo sdt (chỉ khi có SĐT hợp lệ)
      let parentId: number | undefined
      // dryRun: SĐT mới (chưa có Parent) sẽ TẠO khi ghi thật → chiếu trước để
      // tính hasParent/parentsCreated đúng mà không thực sự tạo bản ghi.
      let wouldCreateParent = false
      if (rawPhone) {
        const phone = normalizePhone(rawPhone)
        if (!isValidVietnamesePhone(phone)) {
          record({
            row: rowNumber,
            status: 'error',
            message: `SĐT phụ huynh "${rawPhone}" không hợp lệ (cần đầu số di động VN).`,
            field: 'sdt_PH_CAN_BO_SUNG',
          })
          continue
        }
        const existingParent = await payload.find({
          collection: 'parents',
          where: { phone: { equals: phone } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        if (existingParent.totalDocs > 0) {
          parentId = existingParent.docs[0].id as number
        } else if (dryRun) {
          wouldCreateParent = true
          result.parentsCreated += 1
        } else {
          const createdParent = await payload.create({
            collection: 'parents',
            data: { fullName: phName || `Phụ huynh ${fullName}`, phone },
            overrideAccess: true,
          })
          parentId = createdParent.id as number
          result.parentsCreated += 1
        }
      }
      // Row có nguồn phụ huynh hợp lệ (đã có id hoặc sẽ tạo)?
      const hasParentSource = parentId != null || wouldCreateParent

      // 4) Upsert học viên theo fullName (idempotent)
      const found = await payload.find({
        collection: 'students',
        where: { fullName: { equals: fullName } },
        limit: 2,
        depth: 0,
        overrideAccess: true,
      })

      if (found.totalDocs > 1) {
        record({
          row: rowNumber,
          status: 'skipped',
          fullName,
          message: `Có ${found.totalDocs} học viên cùng tên "${fullName}" trong DB — bỏ qua, soát tay.`,
        })
        continue
      }

      // Chỉ ghi field có giá trị (tránh xóa dữ liệu đã nhập tay khi update).
      const data: StudentWriteData = {}
      if (nickname !== undefined) data.nickname = nickname
      if (locationId !== undefined) data.location = locationId
      if (dob) data.dob = dob

      let studentId: number
      let hasParent: boolean

      if (found.totalDocs === 1) {
        const doc = found.docs[0]
        const existingParents = asIdArray((doc as { parents?: unknown }).parents)
        const mergedParents = parentId
          ? Array.from(new Set([...existingParents, parentId]))
          : existingParents
        if (parentId && !existingParents.includes(parentId)) {
          data.parents = mergedParents
        }
        // dryRun: chỉ phân loại "sẽ cập nhật", KHÔNG ghi DB.
        if (!dryRun) {
          await payload.update({
            collection: 'students',
            id: doc.id,
            data,
            overrideAccess: true,
          })
        }
        studentId = doc.id as number
        hasParent = mergedParents.length > 0 || hasParentSource
        record({ row: rowNumber, status: 'updated', studentId, fullName, hasParent })
      } else {
        if (parentId) data.parents = [parentId]
        // dryRun: chưa tạo nên chưa có id thật → 0 (chỉ dùng xem trước).
        if (dryRun) {
          studentId = 0
        } else {
          const created = await payload.create({
            collection: 'students',
            // enrollmentStatus là required ở schema (dù có defaultValue) → set tường
            // minh = mặc định 'dang_hoc' khi TẠO. KHÔNG đụng khi update để giữ
            // trạng thái nhân viên đã chỉnh tay.
            data: { fullName, enrollmentStatus: 'dang_hoc', ...data },
            overrideAccess: true,
          })
          studentId = created.id as number
        }
        hasParent = hasParentSource
        record({ row: rowNumber, status: 'created', studentId, fullName, hasParent })
      }

      // 5) Đồng bộ hai chiều: Parents.children ⊇ {studentId}
      if (parentId) {
        result.parentsLinked += 1
        // dryRun: bỏ qua ghi đồng bộ.
        if (!dryRun) {
          const parentDoc = await payload.findByID({
            collection: 'parents',
            id: parentId,
            depth: 0,
            overrideAccess: true,
          })
          const children = asIdArray((parentDoc as { children?: unknown }).children)
          if (!children.includes(studentId)) {
            await payload.update({
              collection: 'parents',
              id: parentId,
              data: { children: [...children, studentId] },
              overrideAccess: true,
            })
          }
        }
      } else if (wouldCreateParent) {
        // dryRun: SĐT mới ⇒ sẽ nối phụ huynh mới vào học viên.
        result.parentsLinked += 1
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
