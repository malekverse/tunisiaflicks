// /anime: what's trending (the hero), continue watching, what airs in the next day, this season,
// all-time favourites, top rated, next season, films, and the genres. Each row streams in on its
// own (one small AniList request each, cached 30 minutes for everyone).
import { Suspense } from 'react'
import Link from 'next/link'
import AnimeHubHero from '@/src/components/anime/AnimeHubHero'
import { AnimeToolbar, ContinueAnime } from '@/src/components/anime/AnimeHubParts'
import { AnimeRow } from '@/src/components/anime/AnimeSections'
import AnimeUnavailable from '@/src/components/anime/AnimeUnavailable'
import { RowSkeleton } from '@/src/components/dramas/Rows'
import { Skeleton } from '@/src/components/ui/skeleton'
import { ANIME_GENRES, excludedGenres, nextSeason, seasonOf, type AnimeRowKind } from '@/src/lib/anime/model'
import { animeViewer, getAnimeRow, getSchedule, type AnimeViewer } from '@/src/lib/anime/server'
import { getT } from '@/src/lib/i18n/server'
import type { TKey } from '@/src/lib/i18n'
import { pageMetadata } from '@/src/lib/seo'
import { withTimeout } from '@/src/lib/with-timeout'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export function generateMetadata() {
  const t = getT()
  return pageMetadata({ title: t('anime.title'), description: t('anime.meta'), path: '/anime', card: 'anime' })
}

async function Hero({ viewer }: { viewer: AnimeViewer }) {
  const trending = await withTimeout(getAnimeRow('trending', viewer), 12_000, null)
  if (!trending) return <AnimeUnavailable />
  // The ones with a wide banner make the best hero.
  const slides = [...trending.filter((card) => card.banner), ...trending.filter((card) => !card.banner)].slice(0, 6)
  return <AnimeHubHero cards={slides} />
}

const ROW_TITLE: Record<Exclude<AnimeRowKind, 'trending'>, TKey> = {
  airing: 'anime.row.airing',
  popular: 'anime.row.popular',
  top: 'anime.row.top',
  upcoming: 'anime.row.upcoming',
  movies: 'anime.row.movies',
}

async function HubRow({ kind, viewer, href }: { kind: AnimeRowKind, viewer: AnimeViewer, href?: string }) {
  const t = getT()
  const cards = await withTimeout(getAnimeRow(kind, viewer), 12_000, null)
  if (!cards?.length) return null
  if (kind === 'trending') return <AnimeRow title={t('anime.row.trending')} cards={cards} href={href} />
  const season = kind === 'upcoming' ? nextSeason(seasonOf(new Date())) : seasonOf(new Date())
  const name = `${t(`anime.season.${season.season}` as TKey)} ${season.year}`
  return <AnimeRow title={t(ROW_TITLE[kind], { season: name })} cards={cards} href={href} />
}

/** What airs in the next 24 hours (and what came out in the last 12), soonest first. */
async function AiringSoon({ viewer }: { viewer: AnimeViewer }) {
  const t = getT()
  const slots = await withTimeout(getSchedule(viewer), 12_000, null)
  if (!slots?.length) return null
  const now = Date.now() / 1000
  const seen = new Set<number>()
  const cards = slots
    .filter((slot) => slot.airingAt > now - 12 * 3600 && slot.airingAt < now + 24 * 3600)
    .filter((slot) => !seen.has(slot.card.id) && seen.add(slot.card.id))
    .map((slot) => ({ ...slot.card, next: { episode: slot.episode, airingAt: slot.airingAt } }))
  return <AnimeRow title={t('anime.row.today')} cards={cards} href="/anime/schedule" />
}

function Genres({ viewer }: { viewer: AnimeViewer }) {
  const t = getT()
  const hidden = excludedGenres(viewer)
  return (
    <section className="page-x">
      <h2 className="mb-3 font-display text-[21px] font-bold text-white sm:mb-4 sm:text-[26px]">{t('anime.row.genres')}</h2>
      <div className="flex flex-wrap gap-2">
        {ANIME_GENRES.filter((genre) => !hidden.includes(genre)).map((genre) => (
          <Link
            key={genre}
            href={`/anime/browse?genre=${encodeURIComponent(genre)}`}
            className="pressable inline-flex h-10 items-center rounded-full bg-white/[0.06] px-4 text-[13.5px] font-medium text-white/85 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.13] hover:text-white"
          >
            {t(`anime.genre.${genre}` as TKey)}
          </Link>
        ))}
      </div>
    </section>
  )
}

function HeroSkeleton() {
  return <Skeleton className="h-[min(78svh,760px)] min-h-[440px] w-full rounded-none" />
}

export default async function AnimeHome() {
  const viewer = await animeViewer()
  const now = seasonOf(new Date())
  const next = nextSeason(now)
  return (
    <div className="w-full min-w-0 pb-10">
      <Suspense fallback={<HeroSkeleton />}><Hero viewer={viewer} /></Suspense>
      <div className="space-y-10 pt-6 sm:space-y-12">
        <AnimeToolbar language={viewer.language} />
        <ContinueAnime />
        <Suspense fallback={<RowSkeleton />}><AiringSoon viewer={viewer} /></Suspense>
        <Suspense fallback={<RowSkeleton />}><HubRow kind="airing" viewer={viewer} href={`/anime/browse?season=${now.season}&year=${now.year}`} /></Suspense>
        <Suspense fallback={<RowSkeleton />}><HubRow kind="trending" viewer={viewer} href="/anime/browse?sort=TRENDING_DESC" /></Suspense>
        <Suspense fallback={<RowSkeleton />}><HubRow kind="popular" viewer={viewer} href="/anime/browse?sort=POPULARITY_DESC" /></Suspense>
        <Suspense fallback={<RowSkeleton />}><HubRow kind="top" viewer={viewer} href="/anime/browse?sort=SCORE_DESC" /></Suspense>
        <Suspense fallback={<RowSkeleton />}><HubRow kind="upcoming" viewer={viewer} href={`/anime/browse?season=${next.season}&year=${next.year}`} /></Suspense>
        <Suspense fallback={<RowSkeleton />}><HubRow kind="movies" viewer={viewer} href="/anime/browse?format=MOVIE" /></Suspense>
        <Genres viewer={viewer} />
      </div>
    </div>
  )
}
