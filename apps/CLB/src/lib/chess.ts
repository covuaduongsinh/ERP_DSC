/**
 * Ánh xạ quân cờ cho lộ trình 6 cấp Dương Sinh (Tốt → Mã → Tượng → Xe → Hậu → Vua).
 * Mã file SVG (quân trắng) nằm ở /public/brand/pieces/{code}.svg.
 */
export type PieceCode = 'wp' | 'wn' | 'wb' | 'wr' | 'wq' | 'wk' | 'bk' | 'bn'

/** Tên quân (theo brand.roadmap) → mã file SVG quân trắng. */
const PIECE_BY_NAME: Record<string, PieceCode> = {
  tot: 'wp',
  ma: 'wn',
  tuong: 'wb',
  xe: 'wr',
  hau: 'wq',
  vua: 'wk',
}

/** Bỏ dấu + thường hoá để khớp tên cấp bất kể hoa/thường/dấu. */
function normalizePieceKey(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim()
}

/** Quân cờ tương ứng tên cấp; mặc định wp (Tốt) nếu không khớp. */
export function pieceForLevel(name: string): PieceCode {
  return PIECE_BY_NAME[normalizePieceKey(name)] ?? 'wp'
}
