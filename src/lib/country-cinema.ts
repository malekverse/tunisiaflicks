// One country's films and series on TMDB (origin country), for the Arab cinema map: the requests,
// the film of the day, and the people born there. Server only (TMDB key). Every request is cached
// by Next's data cache for a day (people for a week), and the map and a country's page share the
// same three base requests (popular films, popular series, best-known films), so opening a country
// after the map costs a handful of new calls.
import { tmdbFetchSafe } from '@/src/lib/tmdb'
import { filterKidSafe, kidsDiscoverParams } from '@/src/lib/kids'
import { hash } from '@/src/lib/seed'
import type { ArabCountryCode } from '@/src/lib/arab-countries'

const DAY = 86400
const WEEK = 7 * DAY

export type Kind = 'movie' | 'tv'
type Params = Record<string, string | number | boolean | undefined>
export type DiscoverPage = { results: any[], total_results: number, total_pages: number }

/** A title as the map and the panels need it (light enough to send to the browser). */
export type MapTitle = {
  id: number
  kind: Kind
  title: string
  poster: string | null
  backdrop: string | null
  year: string | null
}

export const titleOf = (item: any): string => item.title || item.name || item.original_title || item.original_name || ''
const yearOf = (item: any): string | null => (item.release_date || item.first_air_date || '').slice(0, 4) || null

export function toMapTitle(item: any, kind: Kind): MapTitle {
  return { id: item.id, kind, title: titleOf(item), poster: item.poster_path ?? null, backdrop: item.backdrop_path ?? null, year: yearOf(item) }
}

/** With `media_type`, so cards and filterKidSafe know what each item is. */
const tagged = (page: DiscoverPage | null, kind: Kind) => (page?.results ?? []).map((item) => ({ ...item, media_type: kind }))

/**
 * Titles TMDB files under the wrong country: Cambodian films in Khmer ('km') land under Comoros
 * (KM). Their original language gives them away.
 */
const MISLABELLED: Partial<Record<ArabCountryCode, readonly string[]>> = { km: ['km'] }

/**
 * A page without the mislabelled titles, and a count to match: exact on a single page, otherwise
 * scaled by the share of the first page that was kept.
 */
export function withoutMislabelled(code: ArabCountryCode, page: DiscoverPage | null): DiscoverPage | null {
  const languages = MISLABELLED[code]
  if (!page || !languages) return page
  const all = page.results ?? []
  const results = all.filter((item) => !languages.includes(item.original_language))
  if (results.length === all.length) return page
  const total = (page.total_pages ?? 1) <= 1 ? results.length : Math.round((page.total_results ?? 0) * results.length / Math.max(1, all.length))
  return { ...page, results, total_results: total }
}

/**
 * One discover request for a country. Kids: TMDB's Kids filters (US-certified family titles), and
 * filterKidSafe on top, title by title (see lib/kids). Null when TMDB didn't answer.
 */
export async function countryDiscover(code: ArabCountryCode, kind: Kind, params: Params, language: string, kids: boolean): Promise<DiscoverPage | null> {
  const base: Params = { with_origin_country: code.toUpperCase(), include_adult: false, language, page: 1, ...params }
  const page = withoutMislabelled(code, await tmdbFetchSafe<DiscoverPage>(`discover/${kind}`, kids ? kidsDiscoverParams(kind, base) : base, DAY))
  if (!page || !kids) return page
  const results = await filterKidSafe(tagged(page, kind), kind, 20)
  // What the Kids filters let through, honestly: nothing left means nothing on record for Kids.
  return { ...page, results, total_results: results.length === 0 ? 0 : Math.max(results.length, page.total_results ?? 0) }
}

const today = () => new Date().toISOString().slice(0, 10)
const yearsAgo = (years: number) => `${new Date().getUTCFullYear() - years}-01-01`

/** The requests behind a country's tile and page. The first three are shared with the map. */
export const QUERIES = {
  popularFilms: { kind: 'movie', params: { sort_by: 'popularity.desc' } },
  popularSeries: { kind: 'tv', params: { sort_by: 'popularity.desc' } },
  knownFilms: { kind: 'movie', params: { sort_by: 'vote_count.desc' } },
  newFilms: { kind: 'movie', params: () => ({ sort_by: 'popularity.desc', 'primary_release_date.gte': yearsAgo(5), 'primary_release_date.lte': today() }) },
  favourites: { kind: 'movie', params: { sort_by: 'vote_average.desc', 'vote_count.gte': 10 } },
  classics: { kind: 'movie', params: { sort_by: 'vote_count.desc', 'primary_release_date.lte': '1989-12-31' } },
  firstFilm: { kind: 'movie', params: { sort_by: 'primary_release_date.asc', 'primary_release_date.gte': '1880-01-01' } },
} as const satisfies Record<string, { kind: Kind, params: Params | (() => Params) }>

export type QueryName = keyof typeof QUERIES

export function runQuery(code: ArabCountryCode, name: QueryName, language: string, kids: boolean) {
  const query = QUERIES[name]
  const params = typeof query.params === 'function' ? query.params() : query.params
  return countryDiscover(code, query.kind, params, language, kids)
}

export const itemsOf = (page: DiscoverPage | null, kind: Kind) => tagged(page, kind).filter((item) => item.poster_path)

/**
 * The country's film of the day: one of its best-known or most popular films with a poster, the
 * same all day for everyone (seeded by the date), a series when it has no films.
 */
export function filmOfTheDay(code: ArabCountryCode, date: string, pages: { known: DiscoverPage | null, popular: DiscoverPage | null, series: DiscoverPage | null }): MapTitle | null {
  const seen = new Set<number>()
  const films = [...itemsOf(pages.known, 'movie').slice(0, 8), ...itemsOf(pages.popular, 'movie').slice(0, 8)]
    .filter((item) => !seen.has(item.id) && seen.add(item.id))
  const pool = films.length > 0 ? films : itemsOf(pages.series, 'tv').slice(0, 8)
  if (pool.length === 0) return null
  // Prefer titles with a backdrop (the pick card and the room light look better with one).
  const wide = pool.filter((item) => item.backdrop_path)
  const choice = (wide.length >= 3 ? wide : pool)
  const item = choice[hash(`${date}:arab-map:${code}`) % choice.length]
  return toMapTitle(item, item.media_type)
}

// ---------------------------------------------------------------------------------------------
// People born in the country.

/**
 * Who counts as born in each country: TMDB's place_of_birth (usually English, sometimes French or
 * Arabic) mentions the country or one of its main cities. Never a bare 'عمان' (Amman and Oman are
 * spelled alike), never a bare 'Tripoli' (Lebanon and Libya both have one), and South Sudan is not
 * Sudan.
 */
const BORN_IN: Record<ArabCountryCode, { match: RegExp, not?: RegExp }> = {
  ma: { match: /morocc|maroc|المغرب|casablanca|الدار البيضاء|\brabat\b|الرباط|marrakesh|marrakech|مراكش|\bf[eè]s\b|\bfez\b|فاس|tangier|tanger|طنجة|agadir|أكادير|mekn[eè]s|مكناس|oujda|وجدة|t[eé]touan|تطوان/i },
  dz: { match: /alg[eé]ri|الجزائر|algiers|\balger\b|\boran\b|وهران|\bconstantine\b|قسنطينة|annaba|عنابة|\bblida\b|البليدة|tizi ouzou|تيزي وزو|s[eé]tif|سطيف|b[eé]ja[iï]a|بجاية/i },
  tn: { match: /tunisi|تونس|\bsfax\b|صفاقس|\bsousse\b|سوسة|bizerte|بنزرت|kairouan|القيروان|monastir|المنستير|gab[eè]s|قابس|nabeul|نابل(?!س)/i },
  ly: { match: /libya|libye|ليبيا|benghazi|بنغازي|misrata|مصراتة/i },
  eg: { match: /egypt|[ée]gypte|مصر|\bcairo\b|le caire|القاهرة|الإسكندرية|الاسكندرية|\bgiza\b|الجيزة|port said|بورسعيد|بور سعيد|mansoura|المنصورة|\btanta\b|طنطا|asyut|assiut|أسيوط|\bluxor\b|الأقصر|\baswan\b|أسوان|ismailia|الإسماعيلية/i },
  mr: { match: /mauritani|موريتانيا|nouakchott|نواكشوط|nouadhibou|نواذيبو/i },
  sd: {
    match: /\bsudan\b|soudan|السودان|khartoum|khartum|الخرطوم|omdurman|أم درمان|ام درمان|بورتسودان/i,
    not: /south(ern)? sudan|soudan du sud|sud-soudan|جنوب السودان|\bjuba\b|جوبا/i,
  },
  ps: { match: /palestin|فلسطين|\bgaza\b|غزة|ramallah|رام الله|nablus|naplouse|نابلس|h[eé]bron|الخليل|bethl[eé]em|bethlehem|بيت لحم|\bjenin\b|جنين|west bank|cisjordanie|الضفة الغربية|tulkarm|طولكرم|jericho|j[ée]richo|أريحا|qalqilya|قلقيلية|khan yunis|khan younis|خان يونس/i },
  lb: { match: /leban|liban|لبنان|beirut|beyrouth|بيروت|\bsidon\b|صيدا|zahl[eé]|زحلة|baalbek|بعلبك|jounieh|جونيه/i },
  sy: { match: /syria|syrie|سوريا|سورية|damascus|\bdamas\b|دمشق|aleppo|\balep\b|حلب|\bhoms\b|حمص|\bhama\b|حماة|latakia|lattaqui[eé]|اللاذقية|tartus|طرطوس|deir ez-zor|دير الزور/i },
  iq: { match: /iraq|irak|العراق|baghdad|bagdad|بغداد|\bbasra\b|bassora|البصرة|\bmosul\b|mossoul|الموصل|\berbil\b|\barbil\b|أربيل|najaf|النجف|karbala|كربلاء|kirkuk|كركوك|sulaymaniyah|السليمانية/i },
  jo: { match: /jordan|jordanie|الأردن|الاردن|\bamman\b|عمّان|\birbid\b|إربد|اربد|\bzarqa\b|الزرقاء|\baqaba\b|العقبة/i },
  sa: { match: /saudi|arabie saoudite|السعودية|riyadh|\briyad\b|الرياض|jeddah|jiddah|djeddah|جدة|\bmecca\b|makkah|la mecque|مكة|المدينة المنورة|dammam|الدمام|\bta[iï]f\b|الطائف|\babha\b|أبها/i },
  kw: { match: /kuwait|kowe[iï]t|الكويت/i },
  bh: { match: /bahrain|bahre[iï]n|البحرين|manama|المنامة|muharraq|المحرق/i },
  qa: { match: /qatar|قطر|\bdoha\b|الدوحة/i },
  ae: { match: /emirates|[ée]mirats|الإمارات|الامارات|\buae\b|dubai|duba[iï]|دبي|abu dhabi|abou dabi|أبو ظبي|أبوظبي|ابوظبي|sharjah|charjah|الشارقة|\bajman\b|عجمان|ras al[- ]khaimah|رأس الخيمة/i },
  om: { match: /\boman\b|سلطنة عمان|عُمان|muscat|mascate|مسقط|salalah|صلالة|\bnizwa\b|نزوى|\bsohar\b|صحار/i },
  ye: { match: /yemen|y[ée]men|اليمن|sanaa|sana['’]a|صنعاء|\baden\b|عدن|\btaiz\b|ta['’]izz|تعز|hodeidah|الحديدة|mukalla|المكلا/i },
  dj: { match: /djibouti|جيبوتي/i },
  so: { match: /somalia|somalie|الصومال|mogadishu|mogadiscio|مقديشو|hargeisa|هرجيسا|kismayo|كيسمايو/i },
  km: { match: /comoros|comores|جزر القمر|\bmoroni\b|موروني|anjouan|moh[eé]li/i },
}

/** Lebanon, Pennsylvania; Palestine, Texas; Bethlehem, Pennsylvania; Cairo, Illinois... */
const ELSEWHERE = /\b(usa|u\.s\.a?\.?|united states)\b/i

/** Whether a TMDB place_of_birth is in this country. */
export function bornIn(code: ArabCountryCode, place: string | null | undefined): boolean {
  if (!place) return false
  const rule = BORN_IN[code]
  return rule.match.test(place) && !(rule.not?.test(place) ?? false) && !ELSEWHERE.test(place)
}

export type CountryPerson = { id: number, name: string, profile_path: string, knownFor: string, kind: Kind, workId: number }

/**
 * The people credited most often (cast and directors) across a country's best-known titles, kept
 * when they were born there (co-productions bring French, Belgian... casts). About 50 requests on a
 * cold cache, then a week of cache.
 */
export async function countryPeople(code: ArabCountryCode, titles: { id: number, media_type: Kind, title?: string, name?: string }[], language: string): Promise<CountryPerson[]> {
  const credits = await Promise.all(titles.map((title) =>
    tmdbFetchSafe<any>(title.media_type === 'movie' ? `movie/${title.id}/credits` : `tv/${title.id}/aggregate_credits`, { language }, WEEK)))
  const people = new Map<number, CountryPerson & { credits: number, score: number }>()
  credits.forEach((data, index) => {
    if (!data) return
    const work = titles[index]
    const cast = (data.cast ?? []).slice(0, 8)
    const directors = (data.crew ?? []).filter((member: any) => member.job === 'Director' || member.jobs?.some((job: any) => job.job === 'Director'))
    for (const [person, weight] of [...cast.map((p: any) => [p, 1] as const), ...directors.map((p: any) => [p, 1.2] as const)]) {
      if (!person.profile_path) continue
      const entry = people.get(person.id) ?? {
        id: person.id, name: person.name, profile_path: person.profile_path, knownFor: titleOf(work), kind: work.media_type, workId: work.id, credits: 0, score: 0,
      }
      entry.credits++
      entry.score += weight + (person.popularity ?? 0) / 100
      people.set(person.id, entry)
    }
  })
  const candidates = [...people.values()].sort((a, b) => b.credits - a.credits || b.score - a.score).slice(0, 32)
  const details = await Promise.all(candidates.map((person) => tmdbFetchSafe<any>(`person/${person.id}`, {}, WEEK)))
  return candidates
    .filter((_, index) => bornIn(code, details[index]?.place_of_birth))
    .slice(0, 18)
    .map(({ credits: _credits, score: _score, ...person }) => person)
}
