import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant =
  | 'primary'
  | 'ghost'
  | 'onnavy'
  | 'outnavy'
  | 'teal';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2.5 whitespace-nowrap rounded-pill font-bold leading-none transition-[transform,background-color,box-shadow] duration-200 ease-ds focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 active:translate-y-0 active:scale-[.98] disabled:pointer-events-none disabled:opacity-60';

const VARIANTS: Record<ButtonVariant, string> = {
  // CTA chính — nền navy, chữ trắng, nâng + bóng navy khi hover
  primary:
    'bg-navy text-white hover:bg-navy-hover hover:-translate-y-0.5 hover:shadow-ds-navy focus-visible:ring-navy focus-visible:ring-offset-white',
  // Nút phụ — viền navy mảnh, nền trong suốt
  ghost:
    'text-navy shadow-[inset_0_0_0_1.6px_var(--ds-primary)] hover:bg-navy-soft hover:-translate-y-0.5 focus-visible:ring-navy focus-visible:ring-offset-white',
  // Trên nền navy — nền trắng, chữ navy
  onnavy:
    'bg-white text-navy hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(0,0,0,.25)] focus-visible:ring-white focus-visible:ring-offset-navy',
  // Trên nền navy — viền trắng mờ
  outnavy:
    'text-white shadow-[inset_0_0_0_1.6px_rgba(255,255,255,.5)] hover:bg-white/[.12] hover:-translate-y-0.5 focus-visible:ring-white focus-visible:ring-offset-navy',
  // Điểm nhấn teal (không phải CTA chính)
  teal: 'bg-teal text-[#063] hover:bg-teal-deep hover:text-white hover:-translate-y-0.5 focus-visible:ring-teal-deep focus-visible:ring-offset-white',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-[18px] py-[9px] text-[13.5px]',
  md: 'px-[26px] py-[13px] text-[15px]',
  lg: 'px-8 py-4 text-[16px]',
};

/** Class nút dùng chung — áp cho <button>, <a> hoặc next-intl <Link>. */
export function buttonClass(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className = '',
): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]}${className ? ` ${className}` : ''}`;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button className={buttonClass(variant, size, className)} type={type} {...rest}>
      {children}
    </button>
  );
}
