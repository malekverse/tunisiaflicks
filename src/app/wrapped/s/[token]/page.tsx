import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import WrappedCards from '@/src/components/wrapped/WrappedCards'
import { genreLabel, personaOf } from '@/src/components/wrapped/labels'
import ShareButtons from '@/src/components/ShareButtons'
import { Button } from '@/src/components/ui/button'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { getShare } from '@/src/lib/wrapped'
import { pageMetadata } from '@/src/lib/seo'

export const dynamic = 'force-dynamic'

type Props = { params: { token: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = getT()
  const share = await getShare(params.token)
  if (!share) return { title: `${t('wrapped.notFound')} | TunisiaFlicks` }
  const { stats } = share
  const title = t('wrapped.sharedTitle', { name: stats.name, year: stats.year })
  const description = t('wrapped.sharedDescription', {
    titles: stats.titles,
    hours: Math.round(stats.minutes / 60),
    genre: stats.topGenres[0] ? genreLabel(stats.topGenres[0].name, getLocale()) : '—',
    personality: personaOf(stats.personality, t).title,
  })
  return pageMetadata({ title, description, path: `/wrapped/s/${params.token}`, card: false })
}

/** Public, shareable version of someone's year recap (a snapshot they chose to publish). */
export default async function SharedWrappedPage({ params }: Props) {
  const share = await getShare(params.token)
  if (!share) notFound()
  const t = getT()

  return (
    <div className="page-top pb-10">
      <div className="page-x space-y-10 sm:space-y-12">
        <WrappedCards stats={share.stats} isCurrentYear={share.year === new Date().getFullYear()} />

        <section className="flex flex-col gap-6 rounded-stage bg-white/[0.04] p-6 ring-1 ring-white/[0.07] sm:p-8 md:flex-row md:items-center md:justify-between lg:p-10">
          <div>
            <h2 className="font-display text-[clamp(28px,3.4vw,40px)] font-extrabold leading-[0.95]">{t('wrapped.ctaTitle')}</h2>
            <p className="mt-3 max-w-[52ch] text-[15px] text-white/65">{t('wrapped.ctaText')}</p>
          </div>
          <Button asChild size="lg" className="shrink-0 self-start md:self-auto">
            <Link href="/wrapped"><Sparkles aria-hidden className="h-5 w-5" />{t('wrapped.ctaAction')}</Link>
          </Button>
        </section>

        <ShareButtons url={`/wrapped/s/${share.token}`} title={t('wrapped.sharedTitle', { name: share.stats.name, year: share.year })} />
      </div>
    </div>
  )
}
