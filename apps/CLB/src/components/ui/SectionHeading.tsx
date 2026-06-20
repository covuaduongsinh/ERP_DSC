import { Overline } from './Overline'

type SectionHeadingProps = {
  title: string
  subtitle?: string
  /** Nhãn overline phía trên tiêu đề (Roboto Condensed, IN HOA) */
  overline?: string
  overlineTone?: 'navy' | 'teal'
  align?: 'center' | 'left'
  /** id cho <h2> (dùng cho aria-labelledby) */
  id?: string
  className?: string
}

/**
 * Cụm tiêu đề section: overline (tuỳ chọn) + H2 (Roboto 900) + mô tả.
 * Tham chiếu `.shead` của design.
 */
export function SectionHeading({
  title,
  subtitle,
  overline,
  overlineTone = 'navy',
  align = 'center',
  id,
  className = '',
}: SectionHeadingProps) {
  return (
    <div
      className={`mb-10 max-w-[680px] sm:mb-12 ${
        align === 'center' ? 'mx-auto text-center' : 'text-left'
      }${className ? ` ${className}` : ''}`}
    >
      {overline && (
        <Overline tone={overlineTone === 'teal' ? 'teal' : 'navy'} className="mb-2.5 block">
          {overline}
        </Overline>
      )}
      <h2
        id={id}
        className="font-sans text-[clamp(27px,2.8vw,38px)] font-black leading-[1.14] tracking-[-0.02em] text-ink"
      >
        {title}
      </h2>
      {subtitle && <p className="mt-3.5 text-[17px] leading-relaxed text-muted">{subtitle}</p>}
    </div>
  )
}
