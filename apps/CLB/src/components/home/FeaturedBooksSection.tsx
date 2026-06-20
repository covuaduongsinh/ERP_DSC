import { getTranslations } from 'next-intl/server'
import { BookCard } from '@/components/cards/BookCard'
import { Reveal } from '@/components/ui/Reveal'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { getPayloadClient } from '@/lib/payload'
import { formatRoadmapPath } from '@/lib/roadmap'

export async function FeaturedBooksSection() {
  const t = await getTranslations('home')
  const payload = await getPayloadClient()

  const { docs: books } = await payload.find({
    collection: 'featured-books',
    limit: 6,
    depth: 1,
    sort: '-createdAt',
  })

  return (
    <section className="bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-container px-[18px] sm:px-7">
        <SectionHeading
          overline={t('booksTitle')}
          overlineTone="teal"
          title={t('booksHeading')}
          subtitle={t('booksSubtitle', { roadmap: formatRoadmapPath() })}
        />
        {books.length > 0 ? (
          <Reveal className="grid gap-6 sm:grid-cols-2 min-[860px]:grid-cols-3">
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </Reveal>
        ) : (
          <p className="text-center text-muted">{t('booksEmpty')}</p>
        )}
      </div>
    </section>
  )
}
