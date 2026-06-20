/**
 * Định dạng mã định danh nghiệp vụ (business `code`) — phần THUẦN (không DB).
 *
 * Tách riêng để unit-test mọi ca biên (pad, tràn pad, rollover năm/tháng,
 * map cơ sở) mà không cần Postgres. Xem `apps/web/src/lib/codes/makeCodeHook.ts`
 * cho phần ráp với counter atomic + hook collection.
 *
 * Quy ước mã (Phase 1 subset — xem plan ma-dinh-danh-nghiep-vu):
 *  - Students  `HV-YY-NNNN`              reset/năm,   mốc `createdAt`, pad 4, không cơ sở.
 *  - Payments  `PT-{CS}-YYYYMM-NNNN`     reset/tháng+cơ sở, mốc `ngayNop`, pad 4.
 *  - Refunds   `PH-{CS}-YYYYMM-NNNN`     reset/tháng+cơ sở, mốc `ngayHoan`, pad 4.
 *
 * Lưu ý kỳ: scope key (khóa counter) dùng NĂM ĐẦY ĐỦ (`2026`) để tránh nhập
 * nhằng; mã in ra dùng YY (2 chữ số). Tràn pad (vd >9999) → in THÊM chữ số,
 * KHÔNG cắt — số phải luôn duy nhất và đọc đúng.
 */

/** Cơ sở (branch) hợp lệ cho field select `coSo` trên Payments/Refunds. */
export type CoSo = 'kim_lien' | 'vinh_phuc'

/** Mã cơ sở 2 ký tự dùng trong code: kim_lien→KL, vinh_phuc→VP. */
export type BranchCode = 'KL' | 'VP'

const COSO_TO_BRANCH: Record<CoSo, BranchCode> = {
  kim_lien: 'KL',
  vinh_phuc: 'VP',
}

/**
 * Map field select `coSo` → mã cơ sở. Trả `null` nếu thiếu/không hợp lệ (caller
 * quyết định: hook throw, backfill fallback KL + cảnh báo).
 */
export function branchFromCoSo(coSo: unknown): BranchCode | null {
  if (typeof coSo !== 'string') return null
  return COSO_TO_BRANCH[coSo as CoSo] ?? null
}

/** Lấy Date hợp lệ từ giá trị field date (string ISO | Date | number). */
function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

/** Năm đầy đủ 4 chữ số (UTC) — dùng trong scope key. */
export function yyyy(value: unknown): string | null {
  const d = toDate(value)
  if (!d) return null
  return String(d.getUTCFullYear())
}

/** Năm 2 chữ số (UTC) — dùng trong mã in ra. */
export function yy(value: unknown): string | null {
  const full = yyyy(value)
  if (!full) return null
  return full.slice(-2)
}

/** `YYYYMM` (UTC) — dùng cả trong scope key lẫn mã in ra. */
export function yyyymm(value: unknown): string | null {
  const d = toDate(value)
  if (!d) return null
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${d.getUTCFullYear()}${month}`
}

/**
 * Đệm số thứ tự về tối thiểu `pad` chữ số. Tràn (số dài hơn pad) → giữ nguyên
 * (KHÔNG cắt) để mã luôn duy nhất. seq phải là số nguyên dương.
 */
export function padSeq(seq: number, pad: number): string {
  return String(seq).padStart(pad, '0')
}

/**
 * Ráp mã từ tiền tố + các phần (đã tính sẵn) + số thứ tự đã đệm. Bỏ phần rỗng.
 * Vd `formatCode('PT', ['KL', '202606'], 32, 4)` → `PT-KL-202606-0032`.
 */
export function formatCode(
  prefix: string,
  parts: Array<string | null | undefined>,
  seq: number,
  pad: number,
): string {
  const segments = [prefix, ...parts.filter((p): p is string => !!p), padSeq(seq, pad)]
  return segments.join('-')
}
