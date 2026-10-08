// Moments: what the site is "about" today, worked out from the date and from what's happening in
// film, never from a hand-kept list of dates. Two kinds:
//
// - The year's calendar, as rules that hold every year: fixed days (Halloween, Valentine's Day,
//   Tunisia's national days), Hijri dates (Ramadan, both Eids) and seasons (summer, awards
//   season). Each one fills itself from TMDB when it comes round.
// - What film itself is doing, read live from TMDB: anniversaries (titles turning 10, 20, 30...
//   this week) and sequels about to open (catch up on the earlier films first).
//
// Nothing is stored and nothing runs on a schedule: every answer comes from today's date plus
// TMDB's data (cached), and rows draw a different selection every day.
import { unstable_cache } from 'next/cache'
import { tmdbFetchSafe, tmdbLanguage } from '@/src/lib/tmdb'
import { filterKidSafe, kidsDiscoverParams } from '@/src/lib/kids'
import { addDays, daysBetween, DHU_AL_HIJJAH, hijriPeriod, nextHijriPeriod, ramadanOf, SHAWWAL, tunisDate } from '@/src/lib/hijri'
import { arabRamadanSeries, ramadanSeasons, tunisianRamadanSeries } from '@/src/lib/ramadan'
import { hash, shuffled } from '@/src/lib/seed'
import type { Locale } from '@/src/lib/i18n'

type Kind = 'movie' | 'tv'
type Params = Record<string, string | number | boolean | undefined>
type Window = { start: string, end: string }

export type MomentId =
  | 'ramadan' | 'eid-al-fitr' | 'eid-al-adha'
  | 'independence-day' | 'republic-day' | 'womens-day'
  | 'new-year' | 'valentines' | 'awards' | 'winter' | 'summer' | 'back-to-school' | 'halloween' | 'christmas'

type Fill =
  /** TMDB discover by keywords (looked up by name) and/or genres, movies and/or shows. */
  | { type: 'discover', kinds: Kind[], keywords?: string[], params?: Params, minVotes?: number }
  | { type: 'custom', load: (context: FillContext) => Promise<any[]> }

type FillContext = { locale: Locale, kids: boolean, today: string, pages: number }

type Rule = {
  id: MomentId
  /** Its dates around `today`, or null when it isn't on. */
  window: (today: string) => Window | null
  /** Several moments at once: the higher one leads. */
  weight: number
  /** Shown to Kids profiles (their rows get the Kids filters). */
  kids: boolean
  /** The room's light on its page ("r g b"). */
  accent: string
  /** Where its chip and "See all" go. */
  href?: string
  fill: Fill
}

export type Moment = Window & Pick<Rule, 'id' | 'weight' | 'accent'> & { href: string, daysLeft: number }

// ---------------------------------------------------------------------------------------------
// Windows that come round every year.

/** Every year from `from` to `to` (MM-DD), crossing New Year when `to` comes before `from`. */
const yearly = (from: string, to: string) => (today: string): Window | null => {
  const year = Number(today.slice(0, 4))
  for (const start of [`${year - 1}-${from}`, `${year}-${from}`]) {
    const end = to >= from ? `${start.slice(0, 4)}-${to}` : `${Number(start.slice(0, 4)) + 1}-${to}`
    if (today >= start && today <= end) return { start, end }
  }
  return null
}

/** Every Hijri year, `days` days from a Hijri date, announced `lead` days before. */
const hijriYearly = (month: number, firstDay: number, days: number, lead: number) => (today: string): Window | null => {
  const period = nextHijriPeriod(today, (hijriYear) => hijriPeriod(hijriYear, month, firstDay, days))
  const start = addDays(period.start, -lead)
  return today >= start && today <= period.end ? { start, end: period.end } : null
}

// ---------------------------------------------------------------------------------------------
// Fills.

const tunisianCinema: Fill = {
  type: 'custom',
  load: ({ locale, today, kids, pages }) => discover('movie', { with_origin_country: 'TN', sort_by: 'vote_count.desc' }, { locale, kids, today, seed: 'tn', minVotes: 5, pages }),
}

/** Comedies and family films for Eid: Arabic-language first, the world's after. */
const eidMovies: Fill = {
  type: 'custom',
  load: async ({ locale, kids, today, pages }) => {
    const [arab, world] = await Promise.all([
      kids ? Promise.resolve([]) : discover('movie', { with_original_language: 'ar', with_genres: '35|10751' }, { locale, kids, today, seed: 'eid-ar', minVotes: 5, pages }),
      discover('movie', { with_genres: '10751', 'primary_release_date.gte': `${Number(today.slice(0, 4)) - 6}-01-01` }, { locale, kids, today, seed: 'eid', minVotes: 300, pages }),
    ])
    return [...arab.slice(0, 12 * pages), ...world].slice(0, 30 * pages)
  },
}

const RULES: Rule[] = [
  {
    id: 'ramadan', weight: 100, kids: true, accent: '245 190 80', href: '/ramadan',
    // The hub's banner shows from 45 days before (see RamadanBanner).
    window: (today) => {
      const period = nextHijriPeriod(today, ramadanOf)
      const start = addDays(period.start, -45)
      return today >= start ? { start, end: period.end } : null
    },
    fill: {
      type: 'custom',
      load: async ({ locale, kids }) => {
        const latest = ramadanSeasons(new Date(), 1)[0]
        if (!latest) return []
        const [tunisian, arab] = await Promise.all([tunisianRamadanSeries(latest, locale, kids), arabRamadanSeries(latest, locale, kids)])
        return [...tunisian, ...arab]
      },
    },
  },
  { id: 'eid-al-fitr', weight: 95, kids: true, accent: '245 190 80', window: hijriYearly(SHAWWAL, 1, 3, 2), fill: eidMovies },
  { id: 'eid-al-adha', weight: 95, kids: true, accent: '245 190 80', window: hijriYearly(DHU_AL_HIJJAH, 10, 4, 2), fill: eidMovies },
  // Tunisia's national days (the dates are fixed by law).
  { id: 'independence-day', weight: 80, kids: false, accent: '231 0 19', window: yearly('03-17', '03-21'), fill: tunisianCinema },
  { id: 'republic-day', weight: 80, kids: false, accent: '231 0 19', window: yearly('07-22', '07-26'), fill: tunisianCinema },
  { id: 'womens-day', weight: 80, kids: false, accent: '231 0 19', window: yearly('08-10', '08-14'), fill: tunisianCinema },
  { id: 'new-year', weight: 70, kids: true, accent: '255 210 120', window: yearly('12-27', '01-02'), fill: { type: 'discover', kinds: ['movie'], keywords: ["new year's eve"], minVotes: 80 } },
  { id: 'christmas', weight: 60, kids: true, accent: '220 50 60', window: yearly('12-01', '12-26'), fill: { type: 'discover', kinds: ['movie', 'tv'], keywords: ['christmas'], minVotes: 100 } },
  { id: 'halloween', weight: 60, kids: true, accent: '255 120 30', window: yearly('10-01', '10-31'), fill: { type: 'discover', kinds: ['movie', 'tv'], keywords: ['halloween'], minVotes: 100 } },
  {
    id: 'valentines', weight: 60, kids: false, accent: '255 70 120', window: yearly('02-01', '02-14'),
    fill: { type: 'discover', kinds: ['movie'], keywords: ["valentine's day"], minVotes: 50 },
  },
  {
    id: 'awards', weight: 40, kids: false, accent: '245 200 90', window: yearly('01-15', '03-15'),
    // Last year's best-reviewed films, the ones the awards are about.
    fill: {
      type: 'custom',
      load: ({ locale, today, kids, pages }) => discover('movie', {
        primary_release_year: Number(today.slice(0, 4)) - 1, sort_by: 'vote_average.desc', 'vote_average.gte': 7,
      }, { locale, kids, today, seed: 'awards', minVotes: 400, pages }),
    },
  },
  { id: 'back-to-school', weight: 35, kids: true, accent: '90 160 255', window: yearly('09-01', '09-21'), fill: { type: 'discover', kinds: ['movie', 'tv'], keywords: ['high school'], minVotes: 200 } },
  { id: 'summer', weight: 30, kids: true, accent: '255 170 60', window: yearly('07-01', '08-31'), fill: { type: 'discover', kinds: ['movie'], keywords: ['summer', 'summer vacation', 'beach', 'road trip'], minVotes: 200 } },
  { id: 'winter', weight: 20, kids: true, accent: '140 190 255', window: yearly('01-03', '02-28'), fill: { type: 'discover', kinds: ['movie'], keywords: ['snow', 'winter'], minVotes: 200 } },
]

const RULE_BY_ID = new Map(RULES.map((rule) => [rule.id, rule]))

export const isMomentId = (value: string): value is MomentId => RULE_BY_ID.has(value as MomentId)

/** Every moment of the year (each has a page). */
export const MOMENT_IDS: MomentId[] = RULES.map((rule) => rule.id)

const toMoment = (rule: Rule, window: Window, today: string): Moment => ({
  ...window,
  id: rule.id,
  weight: rule.weight,
  accent: rule.accent,
  href: rule.href ?? `/moments/${rule.id}`,
  daysLeft: daysBetween(today, window.end),
})

/** Moments on today (Tunis), the most important first. */
export function activeMoments(kids: boolean, today = tunisDate()): Moment[] {
  return RULES
    .filter((rule) => !kids || rule.kids)
    .flatMap((rule) => {
      const window = rule.window(today)
      return window ? [toMoment(rule, window, today)] : []
    })
    .sort((a, b) => b.weight - a.weight)
}

/** A moment by id, whether it's on or not (its page stays up all year). */
export function getMoment(id: MomentId, today = tunisDate()): Moment & { active: boolean } {
  const rule = RULE_BY_ID.get(id)!
  const window = rule.window(today)
  return { ...toMoment(rule, window ?? { start: today, end: today }, today), active: !!window }
}

export const momentForKids = (id: MomentId) => RULE_BY_ID.get(id)!.kids

// ---------------------------------------------------------------------------------------------
// TMDB.

/** A keyword's id from its name, looked up (and cached for a month) rather than hard-coded. */
async function keywordId(name: string): Promise<number | null> {
  const data = await tmdbFetchSafe<{ results: { id: number, name: string }[] }>('search/keyword', { query: name }, 30 * 86400)
  return data?.results.find((result) => result.name.toLowerCase() === name.toLowerCase())?.id ?? null
}

const withPoster = (items: any[] | undefined, kind: Kind) =>
  (items ?? []).filter((item) => item.poster_path).map((item) => ({ ...item, media_type: kind }))

/**
 * One discover query, a different slice of it each day: one of its first pages, shuffled by the
 * date, so a moment that lasts a month doesn't show the same row all month.
 */
async function discover(kind: Kind, params: Params, options: { locale: Locale, kids: boolean, today: string, seed: string, minVotes?: number, pages?: number }) {
  const base: Params = { sort_by: 'popularity.desc', 'vote_count.gte': options.minVotes ?? 50, 'vote_average.gte': 6, language: tmdbLanguage(options.locale), ...params }
  const query = options.kids ? kidsDiscoverParams(kind, base) : base
  const pages = options.pages ?? 1
  const first = 1 + (hash(`${options.today}:${options.seed}`) % 3)
  const results = await Promise.all(Array.from({ length: pages }, (_, index) =>
    tmdbFetchSafe<{ results: any[] }>(`discover/${kind}`, { ...query, page: first + index }, 86400)))
  let items = results.flatMap((data) => withPoster(data?.results, kind))
  // A late page can come back short: then the first page.
  if (items.length < 8 && first > 1) {
    items = withPoster((await tmdbFetchSafe<{ results: any[] }>(`discover/${kind}`, { ...query, page: 1 }, 86400))?.results, kind)
  }
  return shuffled(items, `${options.today}:${options.seed}`)
}

/** The titles of a moment, for today. `pages` > 1 on its own page. */
export async function momentItems(id: MomentId, locale: Locale, kids: boolean, pages = 1, today = tunisDate()): Promise<any[]> {
  const rule = RULE_BY_ID.get(id)
  if (!rule || (kids && !rule.kids)) return []
  try {
    const { fill } = rule
    if (fill.type === 'custom') return await fill.load({ locale, kids, today, pages })
    const keywords = fill.keywords ? (await Promise.all(fill.keywords.map(keywordId))).filter((value): value is number => value !== null) : []
    if (fill.keywords && keywords.length === 0) return []
    const lists = await Promise.all(fill.kinds.map((kind) => discover(kind, {
      ...(keywords.length ? { with_keywords: keywords.join('|') } : {}),
      ...fill.params,
    }, { locale, kids, today, seed: id, minVotes: fill.minVotes, pages })))
    // Movies and shows alternate.
    const mixed: any[] = []
    for (let i = 0; i < Math.max(...lists.map((list) => list.length)); i++) {
      for (const list of lists) if (list[i]) mixed.push(list[i])
    }
    return mixed
  } catch (error) {
    console.error(`Moment ${id} failed:`, error)
    return []
  }
}

// ---------------------------------------------------------------------------------------------
// What film is doing: anniversaries and sequels.

/** Round birthdays worth celebrating. */
const ANNIVERSARIES = [10, 15, 20, 25, 30, 40, 50, 60]

const yearsAgo = (date: string, years: number) => {
  const shifted = `${Number(date.slice(0, 4)) - years}${date.slice(4)}`
  // 29 February in a year without one.
  return Number.isNaN(Date.parse(`${shifted}T00:00:00Z`)) || new Date(`${shifted}T00:00:00Z`).toISOString().slice(0, 10) !== shifted
    ? `${shifted.slice(0, 8)}28`
    : shifted
}

export type Anniversary = { item: any, years: number, onTheDay: boolean }

/**
 * Well-known films turning 10, 15, 20... this week (three days either side of today), the ones
 * whose birthday is today first.
 */
export async function anniversaries(locale: Locale, kids: boolean, today = tunisDate()): Promise<Anniversary[]> {
  const found = await Promise.all(ANNIVERSARIES.map(async (years) => {
    const day = yearsAgo(today, years)
    const params: Params = {
      'primary_release_date.gte': addDays(day, -3),
      'primary_release_date.lte': addDays(day, 3),
      sort_by: 'vote_count.desc',
      'vote_count.gte': years >= 40 ? 300 : 1000,
      // Well-loved, not merely well-known.
      'vote_average.gte': 6.5,
      language: tmdbLanguage(locale),
    }
    const data = await tmdbFetchSafe<{ results: any[] }>('discover/movie', kids ? kidsDiscoverParams('movie', params) : params, 86400)
    return withPoster(data?.results, 'movie').slice(0, 3).map((item) => ({ item, years, onTheDay: item.release_date === day }))
  }))
  return found.flat().sort((a, b) => Number(b.onTheDay) - Number(a.onTheDay) || b.item.vote_count - a.item.vote_count)
}

export type SequelCatchUp = { upcoming: { id: number, title: string, date: string }, earlier: any[] }

async function findSequels(today: string): Promise<SequelCatchUp[]> {
  // Films out in the last three weeks or opening in the next six, the most anticipated first.
  const lists = await Promise.all([
    tmdbFetchSafe<{ results: any[] }>('movie/now_playing', {}, 43200),
    tmdbFetchSafe<{ results: any[] }>('movie/upcoming', {}, 43200),
    tmdbFetchSafe<{ results: any[] }>('movie/upcoming', { page: 2 }, 43200),
  ])
  const seen = new Set<number>()
  const candidates = lists.flatMap((data) => data?.results ?? [])
    .filter((item) => item.release_date && item.release_date >= addDays(today, -21) && item.release_date <= addDays(today, 42) && !seen.has(item.id) && seen.add(item.id))
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 20)
  const details = await Promise.all(candidates.map((item) => tmdbFetchSafe<any>(`movie/${item.id}`, {}, 86400)))
  const found = await Promise.all(details.map(async (movie) => {
    const collectionId = movie?.belongs_to_collection?.id
    if (!collectionId) return null
    const collection = await tmdbFetchSafe<{ parts: any[] }>(`collection/${collectionId}`, {}, 86400)
    const earlier = (collection?.parts ?? [])
      .filter((part) => part.id !== movie.id && part.release_date && part.release_date < movie.release_date && part.poster_path && part.vote_count >= 300)
      .sort((a, b) => a.release_date.localeCompare(b.release_date))
      .map((part) => ({ ...part, media_type: 'movie' }))
    return earlier.length ? { upcoming: { id: movie.id, title: movie.title, date: movie.release_date }, earlier } : null
  }))
  return found.filter((entry): entry is SequelCatchUp => entry !== null)
}

// ~60 TMDB calls on a cold cache: worked out twice a day for everyone.
const cachedSequels = unstable_cache((today: string) => findSequels(today), ['moments-sequels'], { revalidate: 43200 })

/** New films in a series, with the earlier films to catch up on (English titles; ids for the rest). */
export async function sequelCatchUps(today = tunisDate()): Promise<SequelCatchUp[]> {
  try {
    return await cachedSequels(today)
  } catch (error) {
    console.error('Sequel catch-up failed:', error)
    return []
  }
}

/** The earlier films of today's sequels as one row (each film once), in the viewer's language. */
export async function sequelRow(locale: Locale, kids: boolean, today = tunisDate()): Promise<{ items: any[], titles: string[] }> {
  const sequels = await sequelCatchUps(today)
  const seen = new Set<number>()
  const parts = sequels.flatMap((entry) => entry.earlier).filter((part) => !seen.has(part.id) && seen.add(part.id)).slice(0, 20)
  const language = tmdbLanguage(locale)
  const localized = language === 'en-US' ? parts : await Promise.all(parts.map(async (part) => {
    const data = await tmdbFetchSafe<any>(`movie/${part.id}`, { language }, 86400)
    return data ? { ...part, title: data.title || part.title, overview: data.overview || part.overview } : part
  }))
  const items = kids ? await filterKidSafe(localized, 'movie') : localized
  const titles = language === 'en-US' ? sequels.map((entry) => entry.upcoming.title) : await Promise.all(sequels.map(async (entry) =>
    (await tmdbFetchSafe<any>(`movie/${entry.upcoming.id}`, { language }, 86400))?.title || entry.upcoming.title))
  return { items, titles }
}
