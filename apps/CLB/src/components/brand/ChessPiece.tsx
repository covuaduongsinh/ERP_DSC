import type { CSSProperties } from 'react'
import type { PieceCode } from '@/lib/chess'

type ChessPieceProps = {
  code: PieceCode
  className?: string
  style?: CSSProperties
  /** Mô tả cho a11y; để rỗng (mặc định) khi quân chỉ là hoạ tiết trang trí. */
  alt?: string
}

/**
 * Quân cờ line-art (vector brand) trong /public/brand/pieces.
 * Dùng <img> cho SVG tĩnh: next/image chặn SVG trừ khi bật dangerouslyAllowSVG,
 * và quân cờ thường được đặt tuyệt đối làm hoạ tiết → <img> là lựa chọn đúng.
 */
export function ChessPiece({ code, className, style, alt = '' }: ChessPieceProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/brand/pieces/${code}.svg`}
      alt={alt}
      aria-hidden={alt === '' ? true : undefined}
      draggable={false}
      loading="lazy"
      className={className}
      style={style}
    />
  )
}
