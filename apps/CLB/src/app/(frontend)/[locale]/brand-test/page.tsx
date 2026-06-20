import { brand } from '@ds/brand'
import { getTranslations, setRequestLocale } from 'next-intl/server'

type Props = {
  params: Promise<{ locale: string }>
}

export default async function BrandTestPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)

  const t = await getTranslations('brandTest')
  const tCommon = await getTranslations('common')

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--ds-bg)] p-8 font-sans">
      <h1 className="text-3xl font-bold text-primary">{brand.name}</h1>
      <p className="text-center text-[var(--ds-text-muted)]">{t('heading')}</p>
      <p className="text-xl text-primary">{tCommon('slogan')}</p>
      <button type="button" className="ds-btn">
        {tCommon('ctaConsult')}
      </button>
    </main>
  )
}
