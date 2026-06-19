/**
 * Field `code` chuẩn + spec mã cho từng collection có mã (Phase 1).
 *
 * MỘT nguồn sự thật cho: định nghĩa field (text, unique, index, required,
 * readOnly) và `CodeSpec` (tiền tố/kỳ/cơ sở/pad) — collection chỉ việc import
 * và gắn 2 hook (`makeCodeHook(spec)` + `lockCodeHook`).
 */
import type { Field } from 'payload';
import type { CodeSpec } from './makeCodeHook';

/**
 * Field `code` chuẩn. `readOnly` ẩn ô sửa trên /admin; bất biến thật do
 * `lockCodeHook` (beforeValidate) đảm bảo, unique index DB chống trùng.
 *
 * CỐ Ý KHÔNG đặt `required: true` ở field-config (dù plan nêu): mã được SINH TỰ
 * ĐỘNG trong `beforeChange` (makeCodeHook), không phải input của caller. Nếu để
 * `required`, `DataFromCollectionSlug` ép MỌI `payload.create` (importer, chuyển
 * đổi lead…) phải truyền `code` — phá luồng tự sinh. Bất biến "luôn có giá trị"
 * được đảm bảo ở 2 lớp mạnh hơn field-config: hook luôn set khi create + cột DB
 * `NOT NULL` (migration). Đây là chênh lệch CÓ CHỦ ĐÍCH so với plan để giữ kiểu
 * an toàn và không vỡ importer.
 */
export const codeField: Field = {
  name: 'code',
  type: 'text',
  label: 'Mã định danh',
  unique: true,
  index: true,
  admin: {
    readOnly: true,
    description: 'Mã định danh nghiệp vụ — tự sinh, bất biến.',
  },
};

/** Students: `HV-YY-NNNN`, reset/năm theo createdAt, không cơ sở. */
export const STUDENT_CODE_SPEC: CodeSpec = {
  prefix: 'HV',
  pad: 4,
  period: 'year',
  needsBranch: false,
};

/** Payments: `PT-{CS}-YYYYMM-NNNN`, reset/tháng+cơ sở theo ngayNop. */
export const PAYMENT_CODE_SPEC: CodeSpec = {
  prefix: 'PT',
  pad: 4,
  period: 'month',
  dateField: 'ngayNop',
  needsBranch: true,
  coSoField: 'coSo',
};

/** Refunds: `PH-{CS}-YYYYMM-NNNN`, reset/tháng+cơ sở theo ngayHoan. */
export const REFUND_CODE_SPEC: CodeSpec = {
  prefix: 'PH',
  pad: 4,
  period: 'month',
  dateField: 'ngayHoan',
  needsBranch: true,
  coSoField: 'coSo',
};

// ── Phase 2: Enrollments / TuitionCycles / RenewalRequests / ProgressReports ──
// Tất cả KHÔNG cần cơ sở ({CS}) — mã ngắn, không lộ logic tài chính/cơ sở.

/** Enrollments: `GD-YY-NNNNN`, reset/năm theo createdAt, không cơ sở. */
export const ENROLLMENT_CODE_SPEC: CodeSpec = {
  prefix: 'GD',
  pad: 5,
  period: 'year',
  needsBranch: false,
};

/** TuitionCycles: `CK-YY-NNNNN`, reset/năm theo startDate (fallback createdAt). */
export const TUITION_CYCLE_CODE_SPEC: CodeSpec = {
  prefix: 'CK',
  pad: 5,
  period: 'year',
  dateField: 'startDate',
  needsBranch: false,
};

/** RenewalRequests: `GH-YYYYMM-NNNN`, reset/tháng theo createdAt, không cơ sở. */
export const RENEWAL_REQUEST_CODE_SPEC: CodeSpec = {
  prefix: 'GH',
  pad: 4,
  period: 'month',
  needsBranch: false,
};

/**
 * ProgressReports: `BC-YY-NNNNN`, reset/năm theo createdAt, không cơ sở.
 * CỐ Ý dùng createdAt (KHÔNG publishedAt): publishedAt NULL lúc tạo nháp.
 */
export const PROGRESS_REPORT_CODE_SPEC: CodeSpec = {
  prefix: 'BC',
  pad: 5,
  period: 'year',
  needsBranch: false,
};

// ── Phase 3: Classes / Events / BookIssues + Locations.code ───────────────────

/**
 * Classes: `LOP-{CS}-NNN`, LIÊN TỤC theo cơ sở (KHÔNG reset theo kỳ), pad 3.
 * Cơ sở suy từ quan hệ `location` → `Locations.code` (KL/VP) — KHÔNG dùng coSo.
 * Tạo lớp THIẾU location → hook throw (cần cơ sở để sinh mã).
 */
export const CLASS_CODE_SPEC: CodeSpec = {
  prefix: 'LOP',
  pad: 3,
  period: 'none',
  needsBranch: true,
  locationField: 'location',
};

/**
 * Events: `GIAI-YYYY-NN`, reset/năm theo `date`, KHÔNG cơ sở. In NĂM ĐẦY ĐỦ 4
 * chữ số (`yearDigits:4`) — khác Students/Enrollments (YY 2 chữ số).
 */
export const EVENT_CODE_SPEC: CodeSpec = {
  prefix: 'GIAI',
  pad: 2,
  period: 'year',
  yearDigits: 4,
  dateField: 'date',
  needsBranch: false,
};

/**
 * BookIssues: `XS-YYYYMM-NNNN`, reset/tháng theo `ngayDung` (fallback
 * createdAt/now), KHÔNG cơ sở trong mã (mã sổ phát sách, ngắn). Giữ `larkCode`
 * riêng (truy vết Lark) — `code` là trường mới độc lập.
 */
export const BOOK_ISSUE_CODE_SPEC: CodeSpec = {
  prefix: 'XS',
  pad: 4,
  period: 'month',
  dateField: 'ngayDung',
  needsBranch: false,
};
