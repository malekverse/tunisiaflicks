import Link from 'next/link'
import { Star } from 'lucide-react'
import PageNav from '@/src/components/PageNav'
import PageHeader from '@/src/components/browse/PageHeader'
import { EmptyState } from '@/src/components/MediaGrid'
import FollowButton from '@/src/components/FollowButton'
import TmdbImage from '@/src/components/TmdbImage'
import { getList, parsePage } from '@/src/lib/lists'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { dateLocale } from '@/src/lib/i18n'
import { genreNames } from '@/src/lib/genres'
import { tunisToday } from '@/src/lib/pick-of-the-day'
import { kidsList } from '@/src/lib/kids'
import { getKidsMode } from '@/src/lib/profiles'

export const dynamic = 'force-dynamic'
export const generateMetadata = () => ({ title: `${getT()('upcoming.title')} | TunisiaFlicks` })

const DAY = 86400000

/**
 * Coming soon, as a calendar: release dates down the start side (pinned while their films scroll
 * by), each film as a wide card with its backdrop, a short synopsis and a "Notify me" bell.
 */
export default async function UpcomingPage({ searchParams }: { searchParams: { page?: string } }) {
  const page = parsePage(searchParams.page)
  const kids = kidsList('movie', 'upcoming')
  const { results, totalPages, failed } = await getKidsMode()
    ? await getList(kids.path, page, kids.params)
    : await getList('movie/upcoming', page)
  const t = getT()
  const locale = getLocale()
  const today = tunisToday()

  // Group by release date, soonest first; anything already out goes in one "Out now" group at the end.
  const groups = new Map<string, any[]>()
  for (const item of [...results].sort((a: any, b: any) => (a.release_date ?? '').localeCompare(b.release_date ?? ''))) {
    const date: string = item.release_date || ''
    const key = !date || date <= today ? 'out' : date
    groups.set(key, [...(groups.get(key) ?? []), item])
  }

  const relative = (date: string) => {
    const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY)
    return days === 0 ? t('upcoming.today') : days === 1 ? t('upcoming.tomorrow') : t('upcoming.inDays', { count: days })
  }
  const format = (date: string, options: Intl.DateTimeFormatOptions) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString(dateLocale(locale) ?? 'en-GB', { ...options, timeZone: 'UTC' })

  return (
    <div className="pb-10">
      <PageHeader title={t('upcoming.title')} subtitle={t('upcoming.subtitle')} />
      <div className="page-x">
        {failed ? <EmptyState>{t('upcoming.failed')}</EmptyState> : (
          <ol className="space-y-12">
            {Array.from(groups.entries()).sort(([a], [b]) => (a === 'out' ? 1 : b === 'out' ? -1 : 0)).map(([date, items]) => (
              <li key={date} className="grid gap-4 md:grid-cols-[170px_1fr] md:gap-10">
                <div className="flex items-baseline gap-3 md:sticky md:top-[calc(var(--topbar)+28px)] md:block md:self-start">
                  {date === 'out' ? (
                    <p className="font-display text-[34px] font-extrabold leading-none text-red-500 md:text-[44px]">{t('upcoming.outNow')}</p>
                  ) : (
                    <>
                      <p className="font-display text-[44px] font-extrabold leading-none md:text-[72px]">{format(date, { day: 'numeric' })}</p>
                      <div className="md:mt-2">
                        <p className="text-[15px] font-medium text-white/80">{format(date, { month: 'long', weekday: 'long' })}</p>
                        <p className="text-[13px] font-medium text-red-400">{relative(date)}</p>
                      </div>
                    </>
                  )}
                </div>
                <ul className="grid gap-4 xl:grid-cols-2">
                  {items.map((item: any) => {
                    const genres = genreNames(item.genre_ids, locale, 2)
                    return (
                      <li key={item.id} className="group/upcoming relative flex flex-col overflow-hidden rounded-[20px] bg-white/[0.04] ring-1 ring-white/[0.07] transition-colors duration-300 hover:bg-white/[0.06] sm:flex-row">
                        <div className="relative aspect-video shrink-0 overflow-hidden sm:aspect-auto sm:w-[46%]">
                          <TmdbImage
                            kind={item.backdrop_path ? 'backdrop' : 'poster'}
                            path={item.backdrop_path || item.poster_path}
                            alt=""
                            fill
                            sizes="(min-width: 1280px) 22vw, (min-width: 640px) 40vw, 100vw"
                            className="object-cover transition-transform duration-500 ease-out group-hover/upcoming:scale-[1.04]"
                          />
                          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent sm:bg-gradient-to-r sm:from-transparent sm:to-black/30 sm:rtl:bg-gradient-to-l" />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-2 p-4 sm:p-5">
                          <h2 className="font-display text-[21px] font-bold leading-tight">
                            {/* The whole card is the link; the bell sits above it. */}
                            <Link href={`/movie/${item.id}`} className="outline-none after:absolute after:inset-0 after:rounded-[20px] focus-visible:after:ring-2 focus-visible:after:ring-red-500">
                              <bdi>{item.title}</bdi>
                            </Link>
                          </h2>
                          <p className="flex flex-wrap items-center gap-x-3 text-[12.5px] text-white/55">
                            {genres.length > 0 && <span>{genres.join(' / ')}</span>}
                            {item.vote_average > 0 && (
                              <span className="inline-flex items-center gap-1"><Star aria-hidden className="h-3 w-3 fill-star text-star" />{item.vote_average.toFixed(1)}</span>
                            )}
                          </p>
                          {item.overview && <p className="line-clamp-3 text-[13.5px] leading-relaxed text-white/65">{item.overview}</p>}
                          {date !== 'out' && (
                            <div className="relative z-10 mt-auto pt-2">
                              <FollowButton mediaType="movie" id={String(item.id)} title={item.title} />
                            </div>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ol>
        )}
        <PageNav currentPage={page} totalPages={totalPages} />
      </div>
    </div>
  )
}
