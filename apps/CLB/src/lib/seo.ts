import { brand } from '@ds/brand'
import type { Metadata } from 'next'
import { routing } from '@/i18n/routing'

export const DEFAULT_OG_IMAGE = '/og-default.svg'

/** Tham chiếu thời gian ISR (giây). Trong page.tsx phải dùng literal `export const revalidate = 3600`. */
export const REVALIDATE_CONTENT = 3600

export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SERVER_URL

  if (!url) {
    return 'https://covuaduongsinh.com'
  }

  return url.replace(/\/$/, '')
}

export function getLocalizedPath(path: string, locale: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`

  if (locale === routing.defaultLocale) {
    return normalized === '/' ? '' : normalized
  }

  return normalized === '/' ? `/${locale}` : `/${locale}${normalized}`
}

export function absoluteUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${getSiteUrl()}${normalizedPath}`
}

type PageMetadataInput = {
  title: string
  description: string
  path?: string
  locale?: string
  image?: string | null
  type?: 'website' | 'article'
  publishedTime?: string
  absoluteTitle?: boolean
}

export function buildPageMetadata(input: PageMetadataInput): Metadata {
  const path = input.path ?? '/'
  const locale = input.locale ?? routing.defaultLocale
  const localizedPath = getLocalizedPath(path, locale)
  const pageUrl = absoluteUrl(localizedPath || '/')
  const imageUrl = input.image ? absoluteUrl(input.image) : absoluteUrl(DEFAULT_OG_IMAGE)
  const ogLocale = locale === 'en' ? 'en_US' : 'vi_VN'

  return {
    title: input.absoluteTitle ? { absolute: input.title } : input.title,
    description: input.description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title: input.title,
      description: input.description,
      url: pageUrl,
      siteName: brand.fullName,
      locale: ogLocale,
      type: input.type ?? 'website',
      publishedTime: input.publishedTime,
      images: [{ url: imageUrl, alt: input.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: input.title,
      description: input.description,
      images: [imageUrl],
    },
  }
}

export function buildRootMetadata(locale: string, title: string, description: string): Metadata {
  const pageUrl = absoluteUrl(getLocalizedPath('/', locale) || '/')
  const imageUrl = absoluteUrl(DEFAULT_OG_IMAGE)
  const ogLocale = locale === 'en' ? 'en_US' : 'vi_VN'

  return {
    metadataBase: new URL(getSiteUrl()),
    title: {
      default: title,
      template: `%s | ${title}`,
    },
    description,
    alternates: {
      canonical: pageUrl,
    },
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: brand.fullName,
      locale: ogLocale,
      type: 'website',
      images: [{ url: imageUrl, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  }
}
