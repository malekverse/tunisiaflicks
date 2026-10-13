import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Clock, Tv } from 'lucide-react'
import TunisianSeasons from '@/src/components/detail/TunisianSeasons'
import TunisianPlay from '@/src/components/detail/TunisianPlay'
import StreamSection from '@/src/components/detail/StreamSection'
import DownloadDialog from '@/src/components/detail/DownloadDialog'
import PosterCard from '@/src/components/PosterCard'
import { EmptyState, GRID_CLASS } from '@/src/components/MediaGrid'
import KidsBlocked from '@/src/components/profiles/KidsBlocked'
import RoomTint from '@/src/components/shell/RoomTint'
import { Button } from '@/src/components/ui/button'
import { getKidsMode } from '@/src/lib/profiles'
import { getProviderTemplates } from '@/src/lib/stream-providers'
import { fillProviders } from '@/src/lib/media-assets'
import { getTunisianDetail, getTunisianTitles } from '@/src/lib/tunisian'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { isArabicScript } from '@/src/lib/i18n/locales'
import { channelBySlug } from '@/src/lib/tunisian-tv/channels'
import { tvSeriesHref } from '@/src/lib/tunisian-tv/view'
import { pageMetadata } from '@/src/lib/seo'

export const dynamic = 'force-dynamic'

type Props = { params: { year: string, month: string, slug: string } }

const slugOf = ({ year, month, slug }: Props['params']) => `${year}/${month}/${slug}`

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const detail = await getTunisianDetail(slugOf(params))
  if (!detail) return {}
  // The share image comes from ./opengraph-image.tsx (card: false).
  return pageMetadata({
    title: detail.title,
    description: detail.description,
    path: `/tunisian/${detail.slug}`,
    card: false,
    openGraph: { type: detail.kind === 'series' ? 'video.tv_show' : 'video.movie' },
  })
}

const chip = 'rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[13px] text-white/80'

export default async function TunisianDetailPage({ params }: Props) {
  // The Tunisian catalogue has no age ratings, so Kids profiles can't be offered it.
  if (await getKidsMode()) return <KidsBlocked what='tunisian' />
  const detail = await getTunisianDetail(slugOf(params))
  const t = getT()
  if (detail === null) notFound()
  if (detail === undefined) {
    return (
      <div className="page-x page-top">
        <EmptyState>
          <p>{t('tunisian.detailFailed')}</p>
          <Button asChild variant="secondary" className="mt-5"><Link href="/tunisian">{t('tunisian.back')}</Link></Button>
        </EmptyState>
      </div>
    )
  }

  // Other titles from the (cached) catalogue.
  const more = ((await getTunisianTitles()) ?? []).filter((title) => title.slug !== detail.slug).slice(0, 12)

  const episodeCount = detail.seasons.reduce((total, season) => total + season.episodes.length, 0)
  // Episodes from a channel's own uploads (the source has none): say whose, and link to them there.
  const tvChannel = detail.tv ? channelBySlug(detail.tv.channel) : null

  return (
    <div className="w-full min-w-0 space-y-12 pb-10">
      <RoomTint color="231 0 19" />
      <section className="relative isolate overflow-hidden">
        {detail.backdrop && (
          <div aria-hidden className="absolute inset-0 -z-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={detail.backdrop} alt="" className="h-full w-full scale-110 object-cover opacity-35 blur-md" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />
          </div>
        )}
        <div className="page-x flex flex-col items-center gap-8 pb-4 pt-[calc(var(--topbar)+env(safe-area-inset-top,0px)+32px)] md:flex-row md:items-end md:pt-[calc(var(--topbar)+80px)]">
          {detail.poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={detail.poster} alt={detail.title} className="w-44 shrink-0 animate-focus-in rounded-[20px] shadow-[0_40px_80px_-30px_rgb(0_0_0/0.9)] ring-1 ring-white/10 md:w-56" />
          )}
          <div className="flex min-w-0 max-w-3xl flex-col items-center md:items-start" dir="auto">
            <h1 className="animate-focus-in text-balance text-center font-display text-[clamp(36px,5.5vw,76px)] font-extrabold leading-[0.95] [animation-delay:60ms] md:text-start">{detail.title}</h1>
            <div className="mt-4 flex animate-focus-in flex-wrap justify-center gap-2 [animation-delay:100ms] md:justify-start">
              {detail.badges.map((badge) => <span key={badge} className={chip}>{badge}</span>)}
              {detail.kind === 'series' && episodeCount > 0 && (
                <span className={chip}>{t('tv.episodeCount', { count: episodeCount })}</span>
              )}
            </div>
            {detail.description && (
              <p className="mt-5 max-w-[62ch] animate-focus-in text-center text-[15px] leading-relaxed text-white/70 [animation-delay:140ms] md:text-start">{detail.description}</p>
            )}
            {/* A matched film plays in full below (normal movie sources); the blog clip is its trailer.
                With no match, only the trailer exists, and the full film isn't online yet. */}
            {detail.kind === 'movie' && (
              <div className="mt-7 flex flex-wrap items-center justify-center gap-3 md:justify-start">
                {detail.tmdb && detail.media && <TunisianPlay media={detail.media} title={detail.title} trailer />}
                {!detail.tmdb && (detail.media
                  ? <TunisianPlay media={detail.media} title={detail.title} trailer />
                  : null)}
                {!detail.tmdb && (
                  <p dir="auto" className="inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-4 py-2.5 text-[14px] text-white/70 ring-1 ring-inset ring-white/10">
                    <Clock aria-hidden className="h-4 w-4" />{t('tunisian.notYet')}
                  </p>
                )}
              </div>
            )}
            {detail.tv && tvChannel && (
              <Link
                href={tvSeriesHref(detail.tv.channel, detail.tv.seriesId)}
                className="mt-7 inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-4 py-2.5 text-[14px] text-white/75 ring-1 ring-inset ring-white/10 transition-colors duration-200 hover:bg-white/[0.12] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <Tv aria-hidden className="h-4 w-4 shrink-0" />
                {t('ttv.fromChannel', { channel: isArabicScript(getLocale()) ? tvChannel.nameAr : tvChannel.name })}
              </Link>
            )}
          </div>
        </div>
      </section>

      {detail.kind === 'movie' && detail.tmdb && (
        <StreamSection
          services={fillProviders(getProviderTemplates(), 'movie', detail.tmdb.id)}
          media={{ type: 'movie', id: detail.tmdb.id }}
          downloadSlot={detail.tmdb.imdb ? <DownloadDialog type="movie" imdbId={detail.tmdb.imdb} title={detail.title} /> : undefined}
        />
      )}

      {detail.kind === 'series' && (
        <div className="page-x">
          {detail.seasons.length > 0 ? <TunisianSeasons seasons={detail.seasons} title={detail.title} picture={detail.backdrop ?? detail.poster} /> : <EmptyState>{t('tunisian.noEpisodes')}</EmptyState>}
        </div>
      )}

      {more.length > 0 && (
        <section aria-label={t('tunisian.more')} className="page-x">
          <h2 className="mb-5 font-display text-[21px] font-bold sm:text-[26px]">{t('tunisian.more')}</h2>
          <div className={GRID_CLASS}>
            {more.map((title) => (
              <PosterCard
                key={title.slug}
                posterImg={title.poster}
                title={title.title}
                releaseDate={title.published}
                externalImg
                actions={false}
                link={`/tunisian/${title.slug}`}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
