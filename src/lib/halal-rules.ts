// Halal mode's rules, pure (no I/O), so the tests can check every decision.
//
// A title is hidden when it has sex scenes, any nudity, or a romance at the centre of the story
// with intimate moments. Violence, horror, language, drugs and alcohol don't count.
//
// The evidence, strongest first:
// 1. A viewer in Halal mode reported it ("Not halal?" on its page): hidden for everyone in Halal mode.
// 2. TMDB says so for certain: an adult title, a sexual-content keyword, an NC-17 / X rating.
// 3. An AI's parents-guide grades for the title (sex, nudity, romance), asked once and stored. It
//    rates from its knowledge of the title, like IMDb's Parents Guide; it says when it doesn't know.
// 4. Nothing better yet (the AI hasn't answered, or doesn't know the title): the strict fallback,
//    which hides adult ratings (R, TV-MA, NC-17) and romance-genre titles.

export type Kind = 'movie' | 'tv'
export type Level = 'none' | 'mild' | 'moderate' | 'severe'
export type Romance = 'none' | 'subplot' | 'central'

/** The AI's parents-guide grades for a title. */
export type Grades = { sex: Level, nudity: Level, romance: Romance }

/** What TMDB says about a title. `cert`: its US rating ('' when it has none, null when unknown). */
export type Facts = { adult: boolean, genres: number[], keywords: number[], cert: string | null }

export const LEVELS: readonly Level[] = ['none', 'mild', 'moderate', 'severe']
export const ROMANCE: readonly Romance[] = ['none', 'subplot', 'central']

/** TMDB's Romance genre (movies; TV has no romance genre). */
export const ROMANCE_GENRE = 10749

/**
 * TMDB keywords that mean sexual content or nudity. Looked up on TMDB (search/keyword); tagging is
 * sparse, so a missing keyword proves nothing, but a present one is decisive.
 */
export const SEXUAL_KEYWORDS: ReadonlySet<number> = new Set([
  281741, // nudity
  359980, // female nudity
  359981, // female frontal nudity
  359982, // female rear nudity
  380575, // female full frontal nudity
  380475, // male nudity
  367629, // male frontal nudity
  360333, // male rear nudity
  362559, // brief male frontal nudity
  384749, // sex & nudity: severe
  246601, // nude
  10031, // nudism
  213417, // nudist
  326200, // topless women
  348208, // topless girls
  353548, // female star appears topless
  329587, // topless bikini
  354470, // sex scene
  267122, // sex
  155301, // rough sex
  347060, // explicit sex
  329280, // sexual content
  256466, // erotic
  302868, // erotic comedy
  298666, // erotic romance
  190370, // erotic movie
  325693, // erotica
  155477, // softcore
  445, // pornography
  3688, // strip club
  14794, // lust
  170827, // sex comedy
  382287, // teen sex comedy
])

/** Ratings that settle it on their own (sexual content is the usual reason for them). */
const ALWAYS_HIDDEN_RATINGS = new Set(['NC-17', 'X'])
/** Ratings the fallback treats as not halal while nothing better is known. */
const FALLBACK_HIDDEN_RATINGS = new Set(['R', 'NC-17', 'X', 'TV-MA'])

const isLevel = (value: unknown): value is Level => LEVELS.includes(value as Level)
const isRomance = (value: unknown): value is Romance => ROMANCE.includes(value as Romance)

/** Hidden by the AI's grades: any nudity, a real sex scene, or a romance at the centre with intimacy. */
export function hiddenByGrades(grades: Grades): boolean {
  return grades.nudity !== 'none'
    || grades.sex === 'moderate' || grades.sex === 'severe'
    || (grades.romance === 'central' && grades.sex !== 'none')
}

/** Hidden for certain by what TMDB says (adult, a sexual keyword, an NC-17 / X rating). */
export function hiddenByFacts(facts: Facts): boolean {
  return facts.adult
    || facts.keywords.some((id) => SEXUAL_KEYWORDS.has(id))
    || (facts.cert !== null && ALWAYS_HIDDEN_RATINGS.has(facts.cert))
}

/** The strict fallback when there are no grades: adult ratings and romance-genre titles are hidden. */
export function fallbackHidden(facts: Facts): boolean {
  return hiddenByFacts(facts)
    || (facts.cert !== null && FALLBACK_HIDDEN_RATINGS.has(facts.cert))
    || facts.genres.includes(ROMANCE_GENRE)
}

/**
 * The decision for one title. `grades`: undefined = not asked yet, null = the AI doesn't know it.
 * `facts`: undefined when TMDB couldn't be asked; then only what the list item itself says counts.
 */
export function isHidden({ reports = 0, facts, grades, item }: {
  reports?: number
  facts?: Facts
  grades?: Grades | null
  item?: { adult?: boolean, genres?: number[] }
}): boolean {
  if (reports > 0) return true
  if (facts && hiddenByFacts(facts)) return true
  if (grades) return hiddenByGrades(grades)
  if (facts) return fallbackHidden(facts)
  // Not even TMDB's facts: hide what looks risky from the list item alone.
  return item?.adult === true || (item?.genres ?? []).includes(ROMANCE_GENRE)
}

/** A model's answer for one title as grades: null when it doesn't know the title, undefined when unreadable. */
export function readGrades(raw: any): Grades | null | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  if (raw.known === false) return null
  if (!isLevel(raw.sex) || !isLevel(raw.nudity) || !isRomance(raw.romance)) return undefined
  return { sex: raw.sex, nudity: raw.nudity, romance: raw.romance }
}

// ---- which TMDB answers carry titles ----------------------------------------------------------

/** TMDB endpoints whose answer is a list of titles (`results`, `cast`/`crew` or `parts`). */
const TITLE_LISTS = [
  /^discover\/(movie|tv)$/,
  /^trending\/(all|movie|tv)\/(day|week)$/,
  /^search\/(multi|movie|tv)$/,
  /^(movie|tv)\/(popular|top_rated|now_playing|upcoming|on_the_air|airing_today)$/,
  /^(movie|tv)\/\d+\/(recommendations|similar)$/,
  /^person\/\d+\/(combined_credits|movie_credits|tv_credits)$/,
  /^collection\/\d+$/,
  /^keyword\/\d+\/movies$/,
]
/** A detail answer that may carry title lists through append_to_response. */
const DETAIL = /^(movie|tv|person)\/\d+$/
const APPENDED_LISTS = /\b(recommendations|similar|combined_credits|movie_credits|tv_credits)\b/

const clean = (path: string) => path.replace(/^\/+/, '').split('?')[0]

/** Whether a TMDB answer may need Halal filtering (cheap: no I/O). */
export function mayCarryTitles(path: string, params: Record<string, unknown> = {}): boolean {
  const p = clean(path)
  if (TITLE_LISTS.some((pattern) => pattern.test(p))) return true
  return DETAIL.test(p) && typeof params.append_to_response === 'string' && APPENDED_LISTS.test(params.append_to_response)
}

/** The kind of the titles in an answer, when the path says (discover/movie, tv/1399/similar, movie_credits…). */
export function kindOfPath(path: string): Kind | null {
  const p = clean(path)
  const match = /^(?:discover|trending|search)\/(movie|tv)\b/.exec(p) ?? /^(movie|tv)\//.exec(p)
  if (match) return match[1] as Kind
  if (/\/movie_credits$/.test(p) || /^collection\//.test(p) || /^keyword\//.test(p)) return 'movie'
  if (/\/tv_credits$/.test(p)) return 'tv'
  return null
}

/** One title as the filter sees it. */
export type TitleRef = { kind: Kind, id: number, title: string, year: string, adult?: boolean, genres?: number[] }

export const keyOf = (ref: { kind: Kind, id: number | string }) => `${ref.kind}:${ref.id}`

/** A TMDB list item as a TitleRef (null for people, keywords, and anything without a usable id). */
export function titleRef(item: any, fallbackKind: Kind | null): TitleRef | null {
  if (!item || typeof item !== 'object') return null
  const kind = item.media_type === 'movie' || item.media_type === 'tv' ? item.media_type : item.media_type ? null : fallbackKind
  const id = Number(item.id)
  if (!kind || !Number.isInteger(id) || id <= 0) return null
  const title = String(item.title ?? item.name ?? item.original_title ?? item.original_name ?? '')
  const date = String(item.release_date ?? item.first_air_date ?? '')
  return {
    kind, id, title, year: /^\d{4}/.test(date) ? date.slice(0, 4) : '',
    adult: item.adult === true,
    genres: Array.isArray(item.genre_ids) ? item.genre_ids : Array.isArray(item.genres) ? item.genres.map((g: any) => g?.id).filter(Number.isInteger) : [],
  }
}

/** Every list of titles inside a TMDB answer, with the kind its items default to. */
export function titleLists(path: string, json: any): { list: any[], kind: Kind | null }[] {
  if (!json || typeof json !== 'object') return []
  const kind = kindOfPath(path)
  const out: { list: any[], kind: Kind | null }[] = []
  const add = (list: unknown, listKind: Kind | null) => { if (Array.isArray(list)) out.push({ list, kind: listKind }) }
  add(json.results, kind)
  add(json.parts, 'movie')
  add(json.cast, kind)
  add(json.crew, kind)
  // Detail answers with appended lists.
  const detailKind = /^(movie|tv)\//.exec(clean(path))?.[1] as Kind | undefined
  for (const key of ['recommendations', 'similar']) add(json[key]?.results, detailKind ?? null)
  add(json.combined_credits?.cast, null)
  add(json.combined_credits?.crew, null)
  add(json.movie_credits?.cast, 'movie')
  add(json.movie_credits?.crew, 'movie')
  add(json.tv_credits?.cast, 'tv')
  add(json.tv_credits?.crew, 'tv')
  // People in a multi search: their "known for" titles.
  if (Array.isArray(json.results)) for (const item of json.results) if (item?.media_type === 'person') add(item.known_for, null)
  return out
}

/** A copy of a TMDB answer without the hidden titles (people and everything else untouched). */
export function withoutHidden(path: string, json: any, hidden: ReadonlySet<string>): any {
  if (!hidden.size) return json
  const keep = (list: any[], kind: Kind | null) => list.filter((item) => {
    const ref = titleRef(item, kind)
    return !ref || !hidden.has(keyOf(ref))
  })
  const kind = kindOfPath(path)
  const detailKind = (/^(movie|tv)\//.exec(clean(path))?.[1] as Kind | undefined) ?? null
  const copy = { ...json }
  if (Array.isArray(copy.results)) {
    copy.results = keep(copy.results, kind).map((item: any) =>
      item?.media_type === 'person' && Array.isArray(item.known_for) ? { ...item, known_for: keep(item.known_for, null) } : item)
  }
  if (Array.isArray(copy.parts)) copy.parts = keep(copy.parts, 'movie')
  if (Array.isArray(copy.cast)) copy.cast = keep(copy.cast, kind)
  if (Array.isArray(copy.crew)) copy.crew = keep(copy.crew, kind)
  for (const key of ['recommendations', 'similar']) {
    if (Array.isArray(copy[key]?.results)) copy[key] = { ...copy[key], results: keep(copy[key].results, detailKind) }
  }
  for (const [key, listKind] of [['combined_credits', null], ['movie_credits', 'movie'], ['tv_credits', 'tv']] as const) {
    if (copy[key] && typeof copy[key] === 'object') {
      copy[key] = {
        ...copy[key],
        ...(Array.isArray(copy[key].cast) ? { cast: keep(copy[key].cast, listKind) } : {}),
        ...(Array.isArray(copy[key].crew) ? { crew: keep(copy[key].crew, listKind) } : {}),
      }
    }
  }
  return copy
}
