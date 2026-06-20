import type { CSSProperties } from 'react'

type BrandPatternProps = {
  /** navy: hoạ tiết navy trên nền sáng · white: hoạ tiết trắng trên nền navy */
  variant?: 'navy' | 'white'
  /** Kích thước ô lặp (px) — design dùng 54–80px */
  size?: number
  /** Độ mờ 0–1 — design dùng .04–.10 */
  opacity?: number
  className?: string
  style?: CSSProperties
}

/**
 * Lớp hoạ tiết tile lặp nền (tham chiếu .pat / .pat-w của design). Tile SVG nằm ở
 * /public/brand/pattern-tile-{navy,white}.svg. Đặt làm lớp nền tuyệt đối; phần tử
 * cha cần position:relative + overflow:hidden.
 */
export function BrandPattern({
  variant = 'navy',
  size = 64,
  opacity = 0.05,
  className,
  style,
}: BrandPatternProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0${className ? ` ${className}` : ''}`}
      style={{
        backgroundImage: `url(/brand/pattern-tile-${variant}.svg)`,
        backgroundSize: `${size}px`,
        opacity,
        ...style,
      }}
    />
  )
}
