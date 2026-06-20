type BrandLogoProps = {
  /** navy: header/nền sáng · white: footer/nền navy */
  variant?: 'navy' | 'white'
  className?: string
}

/**
 * Logo ngang Dương Sinh (biểu tượng + chữ "DƯƠNGSINH") — vector brand thật trong
 * /public/brand/logo-horizontal-{navy,white}.svg. Dùng cho header (navy) & footer (white).
 */
export function BrandLogo({ variant = 'navy', className = 'h-10 w-auto' }: BrandLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/brand/logo-horizontal-${variant}.svg`}
      alt="Cờ Vua Dương Sinh"
      className={className}
      draggable={false}
    />
  )
}
