import type { Config } from 'tailwindcss'

/**
 * Tailwind cho @ds/web. Mọi token màu/bóng/bo góc trỏ về biến CSS của @ds/brand
 * (nguồn nhận diện duy nhất) — KHÔNG hardcode mã màu ở đây.
 *
 * Lưu ý chống xung đột: KHÔNG override các key mặc định của Tailwind
 * (rounded-xl/2xl, shadow-sm/md/lg…) vì admin/parent-portal đang dùng. Token
 * thiết kế mới dùng tên riêng: rounded-ds-xl / rounded-ds-2xl / rounded-pill,
 * shadow-ds-xs…ds-lg / shadow-ds-navy.
 */
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--ds-primary)',
        'primary-hover': 'var(--ds-primary-hover)',
        navy: {
          DEFAULT: 'var(--ds-primary)',
          hover: 'var(--ds-primary-hover)',
          deep: 'var(--ds-navy-deep)',
          ink: 'var(--ds-navy-ink)',
          soft: 'var(--ds-navy-soft)',
        },
        teal: {
          DEFAULT: 'var(--ds-teal)',
          deep: 'var(--ds-teal-deep)',
          soft: 'var(--ds-teal-soft)',
        },
        blue: {
          DEFAULT: 'var(--ds-blue-light)',
          soft: 'var(--ds-blue-soft)',
        },
        green: 'var(--ds-green)',
        ink: 'var(--ds-text)',
        muted: 'var(--ds-text-muted)',
        line: {
          DEFAULT: 'var(--ds-line)',
          soft: 'var(--ds-line-soft)',
        },
        bg: 'var(--ds-bg)',
        paper: 'var(--ds-paper)',
      },
      fontFamily: {
        sans: ['var(--ds-font-sans)'],
        cond: ['var(--ds-font-cond)'],
      },
      borderRadius: {
        'ds-xl': '22px',
        'ds-2xl': '28px',
        pill: '999px',
      },
      boxShadow: {
        'ds-xs': '0 1px 2px rgba(21,29,73,.06)',
        'ds-sm': '0 2px 8px rgba(21,29,73,.07)',
        'ds-md': '0 8px 24px rgba(21,29,73,.10)',
        'ds-lg': '0 18px 48px rgba(21,29,73,.16)',
        'ds-navy': '0 12px 30px rgba(43,57,144,.28)',
      },
      transitionTimingFunction: {
        ds: 'cubic-bezier(.22,1,.36,1)',
      },
      maxWidth: {
        container: '1180px',
      },
    },
  },
  plugins: [],
}

export default config
