import * as React from 'react';

/**
 * PatternBg — lớp họa tiết phụ Dương Sinh (lưới thoi + tam giác + chấm tròn) lặp nền.
 * Theo brand guide: "Hệ thống các icon biểu tượng nhỏ lặp lại" — dùng làm nền trang trí.
 *
 * Đặt làm lớp nền tuyệt đối trong phần tử cha (cha cần position: relative + overflow hidden):
 *
 *   <section style={{ position:'relative', overflow:'hidden' }}>
 *     <PatternBg opacity={0.05} />
 *     ...nội dung...
 *   </section>
 *
 *   <PatternBg color="#FFFFFF" opacity={0.08} scale={0.7} />  // trên nền navy
 */
export type PatternBgProps = {
  /** Màu họa tiết (mặc định navy thương hiệu) */
  color?: string;
  /** Độ mờ 0–1 (mặc định 0.05) */
  opacity?: number;
  /** Tỷ lệ kích thước tile, 1 = gốc (~85px). Nhỏ hơn = họa tiết dày hơn */
  scale?: number;
  className?: string;
  style?: React.CSSProperties;
};

export function PatternBg({
  color = '#2B3990',
  opacity = 0.05,
  scale = 1,
  className,
  style,
}: PatternBgProps) {
  const tile = Math.round(85.04 * scale);
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        color,
        opacity,
        pointerEvents: 'none',
        zIndex: 0,
        ...style,
      }}
    >
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern
            id="dsPatternTile"
            width={tile}
            height={tile}
            patternUnits="userSpaceOnUse"
            viewBox="13.26 -98.3 85.04 85.04"
            style={{ overflow: 'visible' }}
          >
            <rect x="13.26" y="-98.3" fill="none" width="85.04" height="85.04" />
            <rect x="88.92" y="-22.64" transform="matrix(0.7071 0.7071 -0.7071 0.7071 19.4147 -73.3926)" fill="currentColor" width="18.75" height="18.75" />
            <rect x="3.88" y="-22.64" transform="matrix(0.7071 0.7071 -0.7071 0.7071 -5.4928 -13.2607)" fill="currentColor" width="18.75" height="18.75" />
            <polygon fill="currentColor" points="42.57,-37.6 68.99,-37.6 55.78,-50.8 " />
            <circle fill="currentColor" cx="55.78" cy="-65.36" r="8.6" />
            <rect x="88.92" y="-107.68" transform="matrix(0.7071 0.7071 -0.7071 0.7071 -40.7172 -98.3001)" fill="currentColor" width="18.75" height="18.75" />
            <rect x="3.88" y="-107.68" transform="matrix(0.7071 0.7071 -0.7071 0.7071 -65.6247 -38.1681)" fill="currentColor" width="18.75" height="18.75" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dsPatternTile)" />
      </svg>
    </div>
  );
}

export default PatternBg;
