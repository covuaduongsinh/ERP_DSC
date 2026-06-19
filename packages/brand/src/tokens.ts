/**
 * @ds/brand — Nguồn DUY NHẤT cho bộ nhận diện thương hiệu Dương Sinh.
 *
 * Mọi app/component/ấn phẩm phải lấy màu, font, khoảng cách từ đây.
 * Sửa ở file này → toàn hệ thống đổi theo. KHÔNG hardcode màu ở nơi khác.
 *
 * Tham chiếu: brand guide Dương Sinh — màu chủ đạo #2B3990 (navy).
 * LƯU Ý: Bộ nhận diện KHÔNG dùng màu cam. Toàn bộ tông màu xoay quanh navy
 * và các màu bổ trợ xanh. Nút hành động chính (CTA) dùng chính navy #2B3990.
 */

export const colors = {
  /** Màu CHỦ ĐẠO — Xanh Navy: tri thức, điềm tĩnh, thanh lịch. Cũng là màu nút CTA. */
  primary: '#2B3990',

  /** Màu phụ (bổ trợ) — chỉ dùng làm điểm nhấn nhẹ, KHÔNG lấn át navy */
  blueLight: '#2275B4', // accent, link, nền phụ
  teal: '#3DBB95', // highlight tích cực, badge
  green: '#2DA44A', // trạng thái thành công / hợp lệ (không phải CTA)

  /** Sắc độ navy mở rộng (gradient tối, dải navy, footer) */
  navyDeep: '#1E2A6B', // gradient tối / dải navy
  navyInk: '#151D49', // navy đậm nhất — footer, viền bàn cờ
  tealDeep: '#2A9C7C', // hover teal, text teal trên nền sáng

  /** Nền & chữ thường dùng */
  bg: '#F8F9FC', // nền sáng
  white: '#FFFFFF', // nền trắng
  paper: '#FCFCFE', // trắng ngà
  text: '#1A1A2E', // chữ chính
  textMuted: '#6B7280', // chữ phụ
  textOnPrimary: '#FFFFFF', // chữ trên nền navy
} as const;

/** Sắc độ hover/active (suy ra từ navy chủ đạo) */
export const colorStates = {
  primaryHover: '#22307A', // navy đậm hơn cho trạng thái hover của nút CTA
} as const;

/**
 * Bề mặt nền nhạt (chip/badge/icon/section phụ) — điểm nhấn nhẹ quanh navy.
 * KHÔNG dùng làm nền lớn lấn át navy. Khớp 1-1 với --ds-*-soft trong theme.css.
 */
export const surfaces = {
  navySoft: '#EEF0FA', // nền chip/icon navy nhạt
  tealSoft: '#E7F6F0', // nền badge teal nhạt, vòng success
  blueSoft: '#E9F2F9', // nền phụ
} as const;

/** Đường kẻ / divider hairline */
export const lines = {
  line: '#E6E8F0', // viền hairline
  lineSoft: '#EEF0F7', // divider mờ
} as const;

/**
 * Đổ bóng tông navy mát (không bóng đen gắt). Khớp 1-1 với --ds-shadow-* trong theme.css.
 */
export const shadows = {
  xs: '0 1px 2px rgba(21,29,73,.06)',
  sm: '0 2px 8px rgba(21,29,73,.07)',
  md: '0 8px 24px rgba(21,29,73,.10)',
  lg: '0 18px 48px rgba(21,29,73,.16)',
  navy: '0 12px 30px rgba(43,57,144,.28)', // bóng nút CTA khi hover
} as const;

/** Chuyển động — easing & thời lượng chuẩn */
export const motion = {
  ease: 'cubic-bezier(.22,1,.36,1)',
  duration: '.18s',
} as const;

/**
 * Màu TRẠNG THÁI — KHÔNG phải nhận diện thương hiệu.
 * Chỉ dùng cho badge/cảnh báo (nguy cấp/cảnh báo/thông tin/thành công).
 * Nhận diện vẫn xoay quanh navy + xanh; amber/đỏ CHỈ biểu thị trạng thái.
 * Khớp 1-1 với :root trong theme.css.
 */
export const statusColors = {
  critical: '#e0564e',
  criticalBg: '#fdeceb',
  warning: '#e08c2e',
  warningBg: '#fbf1e3',
  info: '#2b3990',
  infoBg: '#eef0fa',
  success: '#2da44a',
  successBg: '#e9f6ed',
  navyInk: '#151d49', // navy đậm nhất — đáy sidebar, hero bàn cờ
} as const;

export const fonts = {
  /** Font chính: Roboto (Google Fonts) */
  sans: "'Roboto', system-ui, sans-serif",
  /** Font phụ: Roboto Condensed — overline, nhãn IN HOA, số lớn, tên cấp quân cờ */
  cond: "'Roboto Condensed', 'Roboto', system-ui, sans-serif",
  weights: { light: 300, regular: 400, medium: 500, bold: 700, black: 900 },
} as const;

/** Phân cấp chữ (rem) — theo hệ thống trong brand guide */
export const fontSize = {
  h1: '2.5rem', // 36–41pt, Bold 700 — tiêu đề chính
  h2: '1.75rem', // 24–30pt, Bold 700 — tiêu đề phụ
  subtitle: '0.875rem', // IN HOA, letter-spacing 0.05em
  body: '1rem', // 9–10pt, Regular 400 — nội dung chính
  small: '0.75rem',
} as const;

/** Khoảng cách (spacing scale) */
export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
} as const;

/** Bo góc (khớp 1-1 với --ds-radius-* trong theme.css) */
export const radius = {
  xs: '6px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '22px',
  '2xl': '28px',
  pill: '999px',
} as const;

/** Thông tin thương hiệu để hiển thị (footer, meta, ấn phẩm) */
export const brand = {
  name: 'Dương Sinh',
  fullName: 'Công ty Cổ phần Cờ vua Dương Sinh',
  shortName: 'DSC',
  slogan: 'Vui Trí Tuệ',
  tagline: 'Kết nối trí tuệ — Toả sáng ngày mai',
  domains: { hub: 'covuaduongsinh.com', book: 'duongsinhbook.com' },
  hotline: '0983.119.819',
  email: 'covuaduongsinh@gmail.com',
  facebook: 'facebook.com/covuaduongsinh',
  zaloLink: 'https://zalo.me/4067160427132770419',
  /**
   * Lộ trình đào tạo đặc trưng — tài sản trí tuệ riêng (6 cấp).
   * Thứ tự theo giá trị quân cờ tăng dần. Tốt = cấp Nhập môn.
   * `track` gom 6 cấp vào 3 tuyến quen thuộc khi trình bày:
   * Nhập môn = Tốt · Cơ bản = Mã/Tượng/Xe · Nâng cao = Hậu/Vua.
   */
  roadmap: [
    { piece: 'Tốt', note: 'Nhập môn', track: 'nhap_mon' },
    { piece: 'Mã', note: '', track: 'co_ban' },
    { piece: 'Tượng', note: '', track: 'co_ban' },
    { piece: 'Xe', note: '', track: 'co_ban' },
    { piece: 'Hậu', note: '', track: 'nang_cao' },
    { piece: 'Vua', note: '', track: 'nang_cao' },
  ] as const,
} as const;

export const tokens = {
  colors,
  colorStates,
  surfaces,
  lines,
  shadows,
  motion,
  statusColors,
  fonts,
  fontSize,
  spacing,
  radius,
  brand,
} as const;
export type Tokens = typeof tokens;
