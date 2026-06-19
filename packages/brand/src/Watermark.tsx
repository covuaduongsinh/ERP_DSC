import * as React from 'react';

/**
 * Watermark Dương Sinh — cụm ô cờ chéo, dùng trang trí góc trang/section.
 * Theo bộ nhận diện: đặt mờ ở góc để tạo điểm nhấn thương hiệu mà không lấn nội dung.
 *
 *   <Watermark />                          // góc phải-dưới, navy mờ, mặc định
 *   <Watermark corner="top-right" />
 *   <Watermark color="#FFFFFF" opacity={0.12} />   // trên nền navy
 *
 * Lưu ý: component này absolute-position trong phần tử cha (cha cần position: relative).
 */
export type WatermarkProps = {
  /** Góc đặt watermark */
  corner?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left';
  /** Màu họa tiết (mặc định navy thương hiệu) */
  color?: string;
  /** Độ mờ 0–1 (mặc định 0.06 — rất nhẹ, không lấn chữ) */
  opacity?: number;
  /** Chiều rộng watermark (mặc định 180px) */
  width?: number | string;
  className?: string;
};

const cornerStyle: Record<string, React.CSSProperties> = {
  'top-right': { top: 0, right: 0 },
  'bottom-right': { bottom: 0, right: 0 },
  'top-left': { top: 0, left: 0, transform: 'scaleX(-1)' },
  'bottom-left': { bottom: 0, left: 0, transform: 'scaleX(-1)' },
};

export function Watermark({
  corner = 'bottom-right',
  color = '#2B3990',
  opacity = 0.06,
  width = 180,
  className,
}: WatermarkProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="397 342 198.3 420.4"
      aria-hidden="true"
      className={className}
      style={{
        position: 'absolute',
        width,
        height: 'auto',
        color,
        opacity,
        pointerEvents: 'none',
        zIndex: 0,
        ...cornerStyle[corner],
      }}
    >
      <g>
        <polygon fill="currentColor" points="553.3,384.7 595.3,342.7 595.3,426.7 " />
        <rect x="481.7" y="439" transform="matrix(0.7071 0.7071 -0.7071 0.7071 481.1449 -224.3164)" fill="currentColor" width="59.3" height="59.3" />
        <rect x="481.7" y="522.9" transform="matrix(0.7071 0.7071 -0.7071 0.7071 540.4868 -199.7362)" fill="currentColor" width="59.3" height="59.3" />
        <rect x="397.7" y="522.9" transform="matrix(0.7071 0.7071 -0.7071 0.7071 515.9033 -140.3863)" fill="currentColor" width="59.3" height="59.3" />
        <polygon fill="currentColor" points="595.3,426.7 595.3,510.6 553.3,468.6 " />
        <polygon fill="currentColor" points="595.3,510.6 595.3,594.5 553.3,552.6 " />
        <polygon fill="currentColor" points="553.3,720.4 595.3,762.4 595.3,678.5 " />
        <rect x="481.7" y="606.8" transform="matrix(0.7071 -0.7071 0.7071 0.7071 -300.2923 547.989)" fill="currentColor" width="59.3" height="59.3" />
        <polygon fill="currentColor" points="595.3,678.5 595.3,594.5 553.3,636.5 " />
      </g>
    </svg>
  );
}

export default Watermark;
