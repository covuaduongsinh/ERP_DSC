/**
 * Định nghĩa cột xuất file cho các collection chính trong /admin.
 *
 * Mỗi collection có một danh sách cột: `header` (nhãn tiếng Việt dễ đọc, dùng
 * cho cả CSV lẫn Excel) + `value` (hàm trích giá trị từ document đã populate
 * depth 1). Server (API route) là nơi DUY NHẤT biết tập cột này — client chỉ
 * gửi slug + bộ lọc, không tự dựng cột → tránh lộ field nội bộ ra client bundle.
 *
 * Giá trị trả về là `string | number | null`:
 *  - number → giữ nguyên để Excel tính tổng được (học phí, elo…).
 *  - chuỗi ngày đã format DD/MM/YYYY.
 *  - field text giữ string (sđt giữ số 0 đầu).
 *  - null → ô trống.
 */

export type ExportCellValue = string | number | null

export type ExportColumn = {
  header: string
  value: (doc: Record<string, unknown>) => ExportCellValue
}

export type ExportableCollectionSlug =
  | 'students'
  | 'attendance'
  | 'progress-reports'
  | 'payments'
  | 'coaches'

/** Các slug được phép xuất + tên file cơ sở (ngày sẽ được nối thêm). */
export const EXPORT_COLLECTIONS: Record<
  ExportableCollectionSlug,
  { fileBase: string; sheetName: string }
> = {
  students: { fileBase: 'hoc-vien', sheetName: 'Học viên' },
  attendance: { fileBase: 'diem-danh', sheetName: 'Điểm danh' },
  'progress-reports': { fileBase: 'bao-cao-tien-do', sheetName: 'Báo cáo tiến độ' },
  payments: { fileBase: 'thanh-toan', sheetName: 'Thanh toán' },
  coaches: { fileBase: 'huan-luyen-vien', sheetName: 'Huấn luyện viên' },
}

export function isExportableCollection(slug: string): slug is ExportableCollectionSlug {
  return Object.prototype.hasOwnProperty.call(EXPORT_COLLECTIONS, slug)
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** Ngày ISO → DD/MM/YYYY (giờ địa phương VN). Trả null nếu rỗng/không hợp lệ. */
function fmtDate(value: unknown): string | null {
  if (!value) return null
  const d = new Date(value as string | number | Date)
  if (Number.isNaN(d.getTime())) return null
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${d.getFullYear()}`
}

/** Map giá trị select → nhãn tiếng Việt; trả về chính value nếu không khớp. */
function selectLabel(value: unknown, labels: Record<string, string>): string | null {
  if (value === null || value === undefined || value === '') return null
  const key = String(value)
  return labels[key] ?? key
}

/** number/string số → number; rỗng → null. Giữ chuỗi nguyên nếu không phải số. */
function num(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/** Trả text thẳng; rỗng → null. */
function text(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s === '' ? null : s
}

/**
 * Quan hệ (depth 1 đã populate thành object) → title của bản ghi liên quan.
 * Nếu chưa populate (chỉ còn id) thì trả về id để không mất thông tin.
 */
function relTitle(value: unknown, titleField: string): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const title = obj[titleField]
    if (title !== undefined && title !== null && title !== '') {
      return String(title)
    }
    if (obj.id !== undefined) return String(obj.id)
    return null
  }
  return String(value)
}

/** Quan hệ hasMany → danh sách title nối bằng ", ". */
function relTitleList(value: unknown, titleField: string): string | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const titles = value.map((item) => relTitle(item, titleField)).filter((t): t is string => !!t)
  return titles.length > 0 ? titles.join(', ') : null
}

/** Mảng các object {field} (vd Coaches.titles) → nối bằng "; ". */
function arrayFieldList(value: unknown, field: string): string | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const parts = value
    .map((item) =>
      item && typeof item === 'object'
        ? text((item as Record<string, unknown>)[field])
        : text(item),
    )
    .filter((t): t is string => !!t)
  return parts.length > 0 ? parts.join('; ') : null
}

type LexicalNode = {
  text?: string
  children?: LexicalNode[]
  type?: string
}

/** Lexical richText → plain text (mỗi paragraph/heading thành 1 dòng). */
function richTextToPlain(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const root = (value as { root?: LexicalNode }).root
  if (!root || !Array.isArray(root.children)) return null

  const lines: string[] = []
  const walk = (node: LexicalNode): string => {
    if (typeof node.text === 'string') return node.text
    if (Array.isArray(node.children)) {
      return node.children.map(walk).join('')
    }
    return ''
  }
  for (const block of root.children) {
    const line = walk(block).trim()
    if (line) lines.push(line)
  }
  const out = lines.join('\n').trim()
  return out === '' ? null : out
}

// ── Nhãn select (khớp options trong collection config) ─────────────────────

const ENROLLMENT_STATUS: Record<string, string> = {
  dang_hoc: 'Đang học',
  tam_nghi: 'Tạm nghỉ',
  da_nghi: 'Đã nghỉ',
}

const ATTENDANCE_STATUS: Record<string, string> = {
  co_mat: 'Có mặt',
  vang: 'Vắng',
  phep: 'Phép',
}

const CO_SO: Record<string, string> = {
  kim_lien: 'Kim Liên',
  vinh_phuc: 'Vĩnh Phúc',
}

const PAYMENT_STATUS: Record<string, string> = {
  da_nop: 'Đã nộp',
  cho: 'Chờ',
}

const COACH_ROLE: Record<string, string> = {
  gv: 'GV',
  tro_giang: 'Trợ giảng',
  tap_su: 'Tập sự',
}

const COACH_STATUS: Record<string, string> = {
  dang_day: 'Đang dạy',
  nghi: 'Nghỉ',
}

// ── Tập cột theo collection ────────────────────────────────────────────────

export const EXPORT_COLUMNS: Record<ExportableCollectionSlug, ExportColumn[]> = {
  students: [
    { header: 'ID', value: (d) => num(d.id) },
    { header: 'Mã định danh', value: (d) => text(d.code) },
    { header: 'Họ tên học viên', value: (d) => text(d.fullName) },
    { header: 'Tên gọi / ghi chú', value: (d) => text(d.nickname) },
    { header: 'Ngày sinh', value: (d) => fmtDate(d.dob) },
    { header: 'Cấp chính', value: (d) => relTitle(d.capChinh, 'tenTat') },
    { header: 'Cơ sở', value: (d) => relTitle(d.location, 'name') },
    { header: 'Phụ huynh', value: (d) => relTitleList(d.parents, 'fullName') },
    {
      header: 'Trạng thái học',
      value: (d) => selectLabel(d.enrollmentStatus, ENROLLMENT_STATUS),
    },
    { header: 'Ghi chú nội bộ', value: (d) => text(d.note) },
  ],

  attendance: [
    { header: 'ID', value: (d) => num(d.id) },
    { header: 'Ngày học', value: (d) => fmtDate(d.date) },
    { header: 'Học viên', value: (d) => relTitle(d.student, 'fullName') },
    { header: 'Trạng thái', value: (d) => selectLabel(d.status, ATTENDANCE_STATUS) },
    { header: 'Buổi', value: (d) => text(d.buoi) },
    { header: 'GV phụ trách', value: (d) => relTitle(d.coach, 'name') },
    { header: 'Lớp', value: (d) => relTitle(d.lop, 'title') },
    { header: 'Làm BTVN', value: (d) => num(d.lamBTVN) },
    { header: 'Ý thức', value: (d) => num(d.yThuc) },
    { header: 'Kiến thức mới', value: (d) => text(d.kienThucMoi) },
    { header: 'Nhận xét', value: (d) => text(d.nhanXet) },
    { header: 'Giao BTVN', value: (d) => text(d.giaoBTVN) },
    { header: 'Kế hoạch buổi sau', value: (d) => text(d.khBuoiSau) },
    { header: 'Sách đang học', value: (d) => text(d.sachDangHoc) },
    { header: 'Link Lichess', value: (d) => text(d.linkLichess) },
    { header: 'Ghi chú', value: (d) => text(d.note) },
  ],

  'progress-reports': [
    { header: 'ID', value: (d) => num(d.id) },
    { header: 'Học viên', value: (d) => relTitle(d.student, 'fullName') },
    { header: 'Kỳ báo cáo', value: (d) => text(d.period) },
    { header: 'Cấp độ', value: (d) => text(d.level) },
    { header: 'Ý thức', value: (d) => num(d.yThuc) },
    { header: 'Bài tập về nhà', value: (d) => text(d.btvn) },
    { header: 'Tham gia giải đấu', value: (d) => text(d.thamGiaGiaiDau) },
    { header: 'Các sách đã học', value: (d) => text(d.cacSachDaHoc) },
    { header: 'Nhận xét chung', value: (d) => richTextToPlain(d.nhanXetChung) },
    { header: 'Kế hoạch', value: (d) => text(d.keHoach) },
    { header: 'Nhận xét HLV', value: (d) => richTextToPlain(d.coachComment) },
    { header: 'HLV', value: (d) => relTitle(d.coach, 'name') },
    { header: 'Ngày phát hành', value: (d) => fmtDate(d.publishedAt) },
  ],

  payments: [
    { header: 'ID', value: (d) => num(d.id) },
    { header: 'Mã chứng từ', value: (d) => text(d.code) },
    { header: 'Ngày nộp', value: (d) => fmtDate(d.ngayNop) },
    { header: 'Học viên', value: (d) => relTitle(d.student, 'fullName') },
    { header: 'Học phí', value: (d) => num(d.hocPhi) },
    { header: 'Tiền sách', value: (d) => num(d.tienSach) },
    { header: 'Mua khác', value: (d) => num(d.muaKhac) },
    { header: 'Học phí 1 buổi', value: (d) => num(d.hp1Buoi) },
    { header: 'Số buổi nộp', value: (d) => num(d.soBuoiNop) },
    { header: 'Cơ sở', value: (d) => selectLabel(d.coSo, CO_SO) },
    { header: 'Tình trạng', value: (d) => selectLabel(d.tinhTrang, PAYMENT_STATUS) },
    { header: 'Ghi chú', value: (d) => text(d.ghiChu) },
  ],

  coaches: [
    { header: 'ID', value: (d) => num(d.id) },
    { header: 'Tên tắt', value: (d) => text(d.tenTat) },
    { header: 'Tên tắt (bí danh)', value: (d) => text(d.tenTatAlias) },
    { header: 'Họ tên đầy đủ', value: (d) => text(d.hoTen) },
    { header: 'Tên hiển thị', value: (d) => text(d.name) },
    { header: 'Vai trò', value: (d) => selectLabel(d.vaiTro, COACH_ROLE) },
    { header: 'Số điện thoại', value: (d) => text(d.sdt) },
    { header: 'Email', value: (d) => text(d.email) },
    { header: 'Elo', value: (d) => num(d.elo) },
    { header: 'Trạng thái', value: (d) => selectLabel(d.trangThai, COACH_STATUS) },
    { header: 'Học hàm / Chứng chỉ', value: (d) => arrayFieldList(d.titles, 'title') },
    { header: 'Thứ tự hiển thị', value: (d) => num(d.order) },
  ],
}

/**
 * Dựng mảng 2 chiều [header, ...rows] từ danh sách document.
 * Header ở hàng đầu; mỗi document thành một hàng theo đúng thứ tự cột.
 */
export function buildRows(
  slug: ExportableCollectionSlug,
  docs: Array<Record<string, unknown>>,
): { headers: string[]; rows: ExportCellValue[][] } {
  const columns = EXPORT_COLUMNS[slug]
  const headers = columns.map((c) => c.header)
  const rows = docs.map((doc) => columns.map((c) => c.value(doc)))
  return { headers, rows }
}
