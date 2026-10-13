// /anime/browse: search every anime, or narrow it down (genre, season, year, format, status, sort).
// The filters live in the address; 30 titles a page.
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import PageHeader from '@/src/components/browse/PageHeader'
import AnimeCard from '@/src/components/anime/AnimeCard'
import AnimeFilters from '@/src/components/anime/AnimeFilters'
import AnimeUnavailable from '@/src/components/anime/AnimeUnavailable'
import { ANIME_GENRES, FORMATS, SEASONS, SORTS, excludedGenres, type AnimeFormat, type AnimeSeason, type AnimeSort, type AnimeStatus } from '@/src/lib/anime/model'
import { animeViewer, browseAnime, type AnimeQuery } from '@/src/lib/anime/server'
import { getT } from '@/src/lib/i18n/server'
import { pageMetadata } from '@/src/lib/seo'

export const dynamic = 'force-dynamic'

type Params = Record<string, string | undefined>

export function generateMetadata() {
  const t = getT()
  return pageMetadata({ title: t('anime.browse.title'), description: t('anime.browse.subtitle'), path: '/anime/browse', card: 'anime' })
}

const STATUSES: readonly AnimeStatus[] = ['RELEASING', 'FINISHED', 'NOT_YET_RELEASED']

/** The address's filters, each checked against what AniList accepts (anything else is dropped). */
function parse(params: Params): AnimeQuery {
  const year = Number(params.year)
  const page = Number(params.page)
  return {
    search: params.q?.slice(0, 80) || undefined,
    genre: (ANIME_GENRES as readonly string[]).includes(params.genre ?? '') ? params.genre : undefined,
    season: SEASONS.includes(params.season as AnimeSeason) ? params.season as AnimeSeason : undefined,
    year: Number.isInteger(year) && year >= 1940 && year <= new Date().getFullYear() + 2 ? year : undefined,
    format: FORMATS.includes(params.format as AnimeFormat) ? params.format as AnimeFormat : undefined,
    status: STATUSES.includes(params.status as AnimeStatus) ? params.status as AnimeStatus : undefined,
    sort: (SORTS as readonly string[]).includes(params.sort ?? '') ? params.sort as AnimeSort : undefined,
    page: Number.isInteger(page) && page > 1 ? Math.min(page, 50) : 1,
  }
}

export default async function AnimeBrowse({ searchParams }: { searchParams: Params }) {
  const t = getT()
  const viewer = await animeViewer()
  const query = parse(searchParams)
  const result = await browseAnime(query, viewer)
  const genres = ANIME_GENRES.filter((genre) => !excludedGenres(viewer).includes(genre))
  const pageHref = (page: number) => {
    const next = new URLSearchParams(Object.entries(searchParams).filter(([, value]) => value) as [string, string][])
    next.set('page', String(page))
    return `/anime/browse?${next}`
  }
  const page = query.page ?? 1

  return (
    <div className="pb-10">
      <PageHeader title={t('anime.browse.title')} subtitle={t('anime.browse.subtitle')} />
      <AnimeFilters genres={genres} />
      <div className="mt-8">
        {!result ? <AnimeUnavailable /> : result.items.length === 0 ? (
          <p className="page-x py-16 text-center text-[15px] text-white/55">{t('anime.browse.empty')}</p>
        ) : (
          <>
            <p className="page-x mb-4 text-[13px] text-white/45">{t('anime.browse.results', { count: result.total.toLocaleString() })}</p>
            <div className="page-x grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-x-3 gap-y-6 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] sm:gap-x-4">
              {result.items.map((card, index) => <AnimeCard key={card.id} card={card} priority={index < 6} />)}
            </div>
            {(page > 1 || result.hasNext) && (
              <nav className="page-x mt-10 flex items-center justify-center gap-3">
                {page > 1 && (
                  <Link href={pageHref(page - 1)} aria-label={t('row.previous')} className="pressable grid h-11 w-11 place-items-center rounded-full bg-white/[0.07] text-white ring-1 ring-inset ring-white/10 hover:bg-white/[0.13]">
                    <ChevronLeft aria-hidden className="h-5 w-5 rtl:rotate-180" />
                  </Link>
                )}
                <span className="min-w-[3ch] text-center text-[14px] tabular-nums text-white/60">{page}</span>
                {result.hasNext && page < 50 && (
                  <Link href={pageHref(page + 1)} className="pressable inline-flex h-11 items-center gap-1.5 rounded-full bg-white px-5 text-[14px] font-semibold text-black">
                    {t('anime.browse.more')}<ChevronRight aria-hidden className="h-4 w-4 rtl:rotate-180" />
                  </Link>
                )}
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  )
}
