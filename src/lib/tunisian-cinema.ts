// Tunisian cinema spotlight: Tunisian productions on TMDB (origin country TN), plus the actors and
// directors who appear most across the best-known of them.
import { tmdbFetchSafe, tmdbLanguage } from '@/src/lib/tmdb'
import { filterKidSafe } from '@/src/lib/kids'
import type { Locale } from '@/src/lib/i18n'

type Params = Record<string, string | number | boolean | undefined>
export type Star = { id: number, name: string, profile_path: string, department: string, credits: number, knownFor: string }

const DAY = 86400
const today = () => new Date().toISOString().slice(0, 10)
const yearsAgo = (years: number) => `${new Date().getFullYear() - years}-01-01`

async function discover(kind: 'movie' | 'tv', params: Params, language: string, pages = 1) {
  const results = await Promise.all(Array.from({ length: pages }, (_, index) =>
    tmdbFetchSafe<{ results: any[] }>(`discover/${kind}`, { with_origin_country: 'TN', language, page: index + 1, ...params }, DAY)))
  const seen = new Set<number>()
  return results.flatMap((data) => data?.results ?? [])
    .filter((item) => item.poster_path && !seen.has(item.id) && seen.add(item.id))
    .map((item) => ({ ...item, media_type: kind }))
}

/** The people credited most often (cast and directors) across the given titles. */
async function starsOf(titles: { id: number, media_type: 'movie' | 'tv', title?: string, name?: string }[], language: string): Promise<Star[]> {
  const credits = await Promise.all(titles.map((title) =>
    tmdbFetchSafe<any>(title.media_type === 'movie' ? `movie/${title.id}/credits` : `tv/${title.id}/aggregate_credits`, { language }, 7 * DAY)))
  const people = new Map<number, Star & { score: number }>()
  credits.forEach((data, index) => {
    if (!data) return
    const work = titles[index].title || titles[index].name || ''
    const cast = (data.cast ?? []).slice(0, 8)
    const directors = (data.crew ?? []).filter((member: any) => member.job === 'Director' || member.jobs?.some((job: any) => job.job === 'Director'))
    for (const [person, weight] of [...cast.map((p: any) => [p, 1] as const), ...directors.map((p: any) => [p, 1.2] as const)]) {
      if (!person.profile_path) continue
      const entry = people.get(person.id) ?? {
        id: person.id, name: person.name, profile_path: person.profile_path,
        department: person.known_for_department ?? (weight > 1 ? 'Directing' : 'Acting'), credits: 0, knownFor: work, score: 0,
      }
      entry.credits++
      entry.score += weight + (person.popularity ?? 0) / 100
      people.set(person.id, entry)
    }
  })
  const candidates = [...people.values()].sort((a, b) => b.credits - a.credits || b.score - a.score).slice(0, 36)
  // Co-productions bring French, Belgian... casts: keep people born in Tunisia.
  const details = await Promise.all(candidates.map((person) => tmdbFetchSafe<any>(`person/${person.id}`, {}, 7 * DAY)))
  const tunisian = candidates.filter((_, index) => /tunisia|tunisie|تونس/i.test(details[index]?.place_of_birth ?? ''))
  return tunisian.slice(0, 18).map(({ score: _score, ...star }) => star)
}

export async function getTunisianCinema(locale: Locale, kids: boolean) {
  const language = tmdbLanguage(locale)
  const [recent, loved, classics, popular, series] = await Promise.all([
    discover('movie', { sort_by: 'popularity.desc', 'primary_release_date.gte': yearsAgo(4), 'primary_release_date.lte': today() }, language, 2),
    discover('movie', { sort_by: 'vote_average.desc', 'vote_count.gte': 15 }, language),
    discover('movie', { sort_by: 'popularity.desc', 'primary_release_date.lte': '1999-12-31' }, language, 2),
    discover('movie', { sort_by: 'popularity.desc' }, language),
    discover('tv', { sort_by: 'popularity.desc' }, language, 2),
  ])
  const safe = async (items: any[]) => (kids ? filterKidSafe(items) : items)
  const [recentSafe, lovedSafe, classicsSafe, seriesSafe] = await Promise.all([safe(recent), safe(loved), safe(classics), safe(series)])
  return {
    featured: kids ? null : popular.find((item) => item.backdrop_path) ?? null,
    recent: recentSafe.slice(0, 20),
    loved: lovedSafe.slice(0, 20),
    classics: classicsSafe.slice(0, 20),
    series: seriesSafe.slice(0, 20),
  }
}

/**
 * The stars take ~50 TMDB requests on a cold cache (credits + birthplaces), so the page streams
 * them in separately (cached for a week afterwards).
 */
export async function getTunisianStars(locale: Locale) {
  const language = tmdbLanguage(locale)
  const [popular, series] = await Promise.all([
    discover('movie', { sort_by: 'popularity.desc' }, language),
    discover('tv', { sort_by: 'popularity.desc' }, language),
  ])
  return starsOf([...popular.slice(0, 12), ...series.slice(0, 6)], language)
}
