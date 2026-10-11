// The apps' home screen: the billboard (today's most talked-about titles, with their logo and
// trailer, as on the site) and the rows below it. Each row loads on its own; one TMDB hiccup only
// leaves out that row.
import { getBillboard, type BillboardItem } from '@/src/lib/billboard'
import { getCommunityTrending } from '@/src/lib/community'
import { getTop10 } from '@/src/lib/top10'
import { catalogueLanguage } from '@/src/lib/tmdb-locale'
import { withTimeout } from '@/src/lib/with-timeout'
import type { Locale } from '@/src/lib/i18n/locales'
import { getList } from './lists'
import { toCards, type AppCard } from './shared'

/** How a row is drawn: posters, big ranked posters, or landscape tiles. */
export type RowStyle = 'poster' | 'top10' | 'landscape'

export type AppRow = {
  /** The list key ('trending-movies', 'top10'…): the app names the row, and "See all" opens /list/{key}. */
  key: string
  style: RowStyle
  items: AppCard[]
  /** Top 10 only: from what people on TunisiaFlicks watched, or TMDB's worldwide trending list. */
  source?: 'site' | 'world'
  /** Whether "See all" has more pages. */
  more: boolean
}

export type AppHome = { billboard: BillboardItem[], rows: AppRow[] }

/** The rows, top to bottom, as on the site's home page. */
const ROWS: { key: string, style: RowStyle }[] = [
  { key: 'trending-movies', style: 'poster' },
  { key: 'trending-tv', style: 'poster' },
  { key: 'tunisian-movies', style: 'poster' },
  { key: 'now-playing', style: 'landscape' },
  { key: 'popular-tv', style: 'poster' },
  { key: 'top-rated-movies', style: 'poster' },
  { key: 'tunisian-tv', style: 'poster' },
  { key: 'upcoming', style: 'landscape' },
]

const ROW_TIMEOUT = 6000

export async function getHome(locale: Locale, kids: boolean): Promise<AppHome> {
  const community = await withTimeout(getCommunityTrending(kids, locale), 2500, [])
  const [billboard, top10, ...lists] = await Promise.all([
    withTimeout(getBillboard(kids, locale), ROW_TIMEOUT, []),
    withTimeout(getTop10(kids, community, catalogueLanguage(locale)), ROW_TIMEOUT, { source: 'world' as const, items: [] }),
    ...ROWS.map((row) => withTimeout(getList(row.key, 1, locale, kids), ROW_TIMEOUT, null)),
  ])

  const rows: AppRow[] = []
  const top10Cards = toCards(top10.items).slice(0, 10)
  if (top10Cards.length >= 5) rows.push({ key: 'top10', style: 'top10', items: top10Cards, source: top10.source, more: false })
  ROWS.forEach((row, index) => {
    const list = lists[index]
    // A row with only a few titles looks broken: skip it.
    if (list && list.items.length >= 4) rows.push({ key: row.key, style: row.style, items: list.items.slice(0, 20), more: list.totalPages > 1 })
  })
  return { billboard, rows }
}
