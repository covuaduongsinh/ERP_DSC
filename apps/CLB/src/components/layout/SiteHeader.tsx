'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { buttonClass } from '@/components/ui/Button'
import { Link, usePathname } from '@/i18n/navigation'
import { routes } from '@/lib/routes'

const navItems = [
  { href: routes.home, key: 'home' as const },
  { href: routes.training, key: 'training' as const },
  { href: routes.openingSchedule, key: 'openingSchedule' as const },
  { href: routes.coaches, key: 'coaches' as const },
  { href: routes.locations, key: 'locations' as const },
  { href: routes.blog, key: 'blog' as const },
  { href: routes.contact, key: 'contact' as const },
]

function isActive(pathname: string, href: string): boolean {
  if (href === routes.home) return pathname === routes.home
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function SiteHeader() {
  const t = useTranslations('nav')
  const tCommon = useTranslations('common')
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  // Thêm bóng cho header khi cuộn > 8px (tham chiếu .hdr.scrolled).
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 border-b border-line bg-[rgba(248,249,252,.86)] backdrop-blur-[14px] transition-shadow duration-200 ${
        scrolled ? 'shadow-ds-sm' : ''
      }`}
    >
      <div className="mx-auto flex h-[74px] max-w-container items-center justify-between gap-4 px-[18px] sm:px-7">
        <Link
          href={routes.home}
          className="inline-flex shrink-0 items-center"
          aria-label={tCommon('brandName')}
          onClick={() => setMenuOpen(false)}
        >
          <BrandLogo variant="navy" className="h-10 w-auto" />
        </Link>

        <nav className="hidden items-center gap-7 min-[860px]:flex" aria-label="Menu chính">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`relative text-[14.5px] transition-colors hover:text-navy ${
                  active
                    ? 'font-bold text-navy after:absolute after:inset-x-0 after:-bottom-[26px] after:h-0.5 after:rounded after:bg-navy'
                    : 'font-medium text-[#4a4f63]'
                }`}
              >
                {t(item.key)}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-3.5">
          <Link
            href={{ pathname: routes.home, hash: 'tu-van' }}
            className={`hidden min-[860px]:inline-flex ${buttonClass('primary', 'sm')}`}
          >
            {tCommon('ctaConsult')}
          </Link>

          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center text-navy min-[860px]:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="sr-only">{menuOpen ? tCommon('menuClose') : tCommon('menuOpen')}</span>
            <svg
              width="26"
              height="26"
              viewBox="0 0 26 26"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              {menuOpen ? <path d="M6 6l14 14M20 6L6 20" /> : <path d="M4 7h18M4 13h18M4 19h18" />}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          id="mobile-nav"
          className="absolute inset-x-0 top-[74px] border-b border-line bg-white px-[18px] pb-5 pt-4 shadow-ds-md min-[860px]:hidden"
          aria-label="Menu di động"
        >
          <ul className="flex flex-col">
            {navItems.map((item) => {
              const active = isActive(pathname, item.href)
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`block border-b border-line-soft py-2.5 text-base ${
                      active ? 'font-bold text-navy' : 'font-medium text-ink'
                    }`}
                    onClick={() => setMenuOpen(false)}
                  >
                    {t(item.key)}
                  </Link>
                </li>
              )
            })}
            <li className="pt-3">
              <Link
                href={{ pathname: routes.home, hash: 'tu-van' }}
                className={`w-full ${buttonClass('primary', 'md')}`}
                onClick={() => setMenuOpen(false)}
              >
                {tCommon('ctaConsult')}
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  )
}
