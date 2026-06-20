import { roboto, robotoCondensed } from '@ds/brand/fonts'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { AnalyticsScripts } from '@/components/analytics/AnalyticsScripts'
import { SiteShell } from '@/components/layout/SiteShell'
import { StructuredData } from '@/components/seo/StructuredData'
import { routing } from '@/i18n/routing'
import { pickClientMessages } from '@/lib/client-messages'
import { buildRootMetadata } from '@/lib/seo'
import '../globals.css'

type Props = {
  children: ReactNode
  params: Promise<{ locale: string }>
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'metadata' })

  return buildRootMetadata(locale, t('title'), t('description'))
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params

  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  setRequestLocale(locale)
  const messages = await getMessages()
  const clientMessages = pickClientMessages(messages)

  return (
    <html lang={locale} className={`${roboto.variable} ${robotoCondensed.variable}`}>
      <body>
        {/* Không có JS: buộc hiện nội dung scroll-reveal (chống ẩn vĩnh viễn). */}
        <noscript>
          <style>{`.reveal{opacity:1!important;transform:none!important}`}</style>
        </noscript>
        <StructuredData />
        <AnalyticsScripts />
        <NextIntlClientProvider messages={clientMessages}>
          <SiteShell>{children}</SiteShell>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
