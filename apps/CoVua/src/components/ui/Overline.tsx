import type { ReactNode } from 'react';

type OverlineTone = 'navy' | 'muted' | 'teal' | 'light';

type OverlineProps = {
  children: ReactNode;
  tone?: OverlineTone;
  className?: string;
};

const TONES: Record<OverlineTone, string> = {
  navy: 'text-navy',
  muted: 'text-muted',
  teal: 'text-teal-deep',
  light: 'text-white/70',
};

/** Nhãn nhỏ IN HOA bằng Roboto Condensed — đặt trên tiêu đề section/hero. */
export function Overline({ children, tone = 'navy', className = '' }: OverlineProps) {
  return (
    <span
      className={`font-cond text-[13px] font-bold uppercase tracking-[0.16em] ${TONES[tone]}${
        className ? ` ${className}` : ''
      }`}
    >
      {children}
    </span>
  );
}
