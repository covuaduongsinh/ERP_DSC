import { getTranslations } from 'next-intl/server'
import { PostCard } from '@/components/cards/PostCard'
import { buttonClass } from '@/components/ui/Button'
import { Reveal } from '@/components/ui/Reveal'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Link } from '@/i18n/navigation'
import { getPayloadClient } from '@/lib/payload'
import { routes } from '@/lib/routes'

type LatestPostsSectionProps = {
  locale: string
}

export async function LatestPostsSection({ locale }: LatestPostsSectionProps) {
  const t = await getTranslations('home')
  const tCommon = await getTranslations('common')
  const payload = await getPayloadClient()

  const { docs: posts } = await payload.find({
    collection: 'posts',
    limit: 3,
    depth: 1,
    sort: '-publishedAt',
    where: { publishedAt: { exists: true } },
  })

  return (
    <section className="bg-bg py-16 sm:py-20">
      <div className="mx-auto max-w-container px-[18px] sm:px-7">
        <SectionHeading
          overline={t('blogTitle')}
          title={t('blogSubtitle')}
          subtitle={t('blogLead')}
        />
        {posts.length > 0 ? (
          <>
            <Reveal className="grid gap-6 sm:grid-cols-2 min-[860px]:grid-cols-3">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} locale={locale} />
              ))}
            </Reveal>
            <div className="mt-10 text-center">
              <Link href={routes.blog} className={buttonClass('ghost', 'md')}>
                {tCommon('viewAll')} →
              </Link>
            </div>
          </>
        ) : (
          <p className="text-center text-muted">{t('blogEmpty')}</p>
        )}
      </div>
    </section>
  )
}
