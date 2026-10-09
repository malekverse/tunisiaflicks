// "Pick of the day": one movie or show, the same for everyone on a given (Tunis) day, with a reason
// to watch it today. The reasons come from what's going on, in this order of interest:
//
// 1. Film news: a sequel opening (watch the earlier film first), a series whose new season has just
//    started, a well-loved film whose birthday is today.
// 2. The season: the leading moment of the calendar (Halloween, Eid, summer...; see lib/moments).
// 3. The day of the week: Monday's hidden gem, Tuesday's classic, Wednesday abroad...
//
// The kind of reason changes from one day to the next, and a title isn't picked again within a
// year: the first request of the day decides and stores the pick (MongoDB), every later request
// and the evening notification read it. Without the database the choice is still deterministic.
import clientPromise from '@/src/lib/mongodb'
import { tmdbFetchSafe, tmdbLanguage } from '@/src/lib/tmdb'
import { localizeDetail, logoLanguages, translatedRecord } from '@/src/lib/tmdb-locale'
import { formatDate } from '@/src/lib/i18n/format'
import { filterKidSafe, kidsDiscoverParams } from '@/src/lib/kids'
import { activeMoments, anniversaries, momentItems, sequelCatchUps, type MomentId } from '@/src/lib/moments'
import { addDays, tunisDate } from '@/src/lib/hijri'
import { hash } from '@/src/lib/seed'
import { createTranslator, isArabicScript, type Locale, type TKey } from '@/src/lib/i18n'

type Kind = 'movie' | 'tv'
type Params = Record<string, string | number | boolean | undefined>

export type PickTheme = 'binge' | 'hiddenGem' | 'classic' | 'worldCinema' | 'arabCinema' | 'crowdPleaser' | 'family'

export type PickReason =
  | { type: 'sequel', sequelId: number, date: string }
  | { type: 'newSeason', season: number }
  | { type: 'anniversary', years: number }
  | { type: 'moment', moment: MomentId }
  | { type: 'theme', theme: PickTheme }

export type PickOfTheDay = {
  kind: Kind
  date: string
  data: any
  reason: PickReason
  /** Why it's today's pick, in the viewer's language. */
  why: string
}

/** Today's date in Tunisia (YYYY-MM-DD). */
export const tunisToday = () => tunisDate()

type Candidate = { kind: Kind, id: number, reason: PickReason, rating: number }

const usable = (item: any) => !!item?.backdrop_path && !!item?.overview

const candidate = (kind: Kind, item: any, reason: PickReason): Candidate => ({ kind, id: item.id, reason, rating: item.vote_average ?? 0 })

// ---------------------------------------------------------------------------------------------
// Where candidates come from.

/** The best earlier film of a series whose new film opens within a week either way. */
async function sequelCandidates(today: string, kids: boolean): Promise<Candidate[]> {
  const sequels = (await sequelCatchUps(today)).filter((entry) => entry.upcoming.date >= addDays(today, -7) && entry.upcoming.date <= addDays(today, 10))
  const found = await Promise.all(sequels.map(async (entry) => {
    const parts = (kids ? await filterKidSafe(entry.earlier, 'movie') : entry.earlier).filter(usable)
    return parts.map((part) => candidate('movie', part, { type: 'sequel', sequelId: entry.upcoming.id, date: entry.upcoming.date }))
  }))
  return found.flat()
}

/** Well-loved films born on this very day, 15 years ago or more. */
async function anniversaryCandidates(today: string, kids: boolean): Promise<Candidate[]> {
  const found = await anniversaries('en', kids, today)
  return found
    .filter((entry) => entry.onTheDay && entry.years >= 15 && entry.item.vote_average >= 7 && usable(entry.item))
    .map((entry) => candidate('movie', entry.item, { type: 'anniversary', years: entry.years }))
}

/** Series in this week's trends whose new season began in the last week. */
async function newSeasonCandidates(today: string, kids: boolean): Promise<Candidate[]> {
  if (kids) return []
  const trending = await tmdbFetchSafe<{ results: any[] }>('trending/tv/week', {}, 21600)
  const shows = await Promise.all((trending?.results ?? []).slice(0, 12).map((item) => tmdbFetchSafe<any>(`tv/${item.id}`, {}, 21600)))
  return shows.flatMap((show) => {
    const episode = show?.last_episode_to_air
    const premiere = episode?.episode_number === 1 && episode.season_number > 1 && episode.air_date >= addDays(today, -7) && episode.air_date <= today
    return premiere && usable(show) && show.vote_average >= 7 ? [candidate('tv', show, { type: 'newSeason', season: episode.season_number })] : []
  })
}

/** Well-rated titles of the season's leading moment. */
async function momentCandidates(today: string, kids: boolean): Promise<Candidate[]> {
  const moment = activeMoments(kids, today)[0]
  if (!moment) return []
  const items = await momentItems(moment.id, 'en', kids, 1, today)
  return items
    .filter((item) => usable(item) && item.vote_average >= 6.8)
    .map((item) => candidate(item.media_type, item, { type: 'moment', moment: moment.id }))
}

// A theme for each day of the week (Sunday first).
const WEEK: PickTheme[] = ['binge', 'hiddenGem', 'classic', 'worldCinema', 'arabCinema', 'crowdPleaser', 'family']
const LANGUAGES = ['fr', 'ko', 'ja', 'es', 'it', 'de', 'fa', 'da', 'sv', 'pt', 'hi', 'tr', 'zh']

function themeQuery(theme: PickTheme, today: string, seed: number): { kind: Kind, params: Params, pages: number } {
  const year = Number(today.slice(0, 4))
  switch (theme) {
    case 'binge':
      // Talk shows, news, reality and soaps make poor picks.
      return { kind: 'tv', params: { sort_by: 'vote_average.desc', 'vote_count.gte': 500, without_genres: '10763,10764,10767,10766' }, pages: 10 }
    case 'hiddenGem':
      return { kind: 'movie', params: { sort_by: 'vote_average.desc', 'vote_average.gte': 7.4, 'vote_count.gte': 250, 'vote_count.lte': 2500 }, pages: 8 }
    case 'classic':
      return { kind: 'movie', params: { sort_by: 'vote_average.desc', 'vote_count.gte': 1500, 'primary_release_date.lte': `${year - 30}-12-31` }, pages: 8 }
    case 'worldCinema':
      return { kind: 'movie', params: { sort_by: 'vote_average.desc', 'vote_count.gte': 400, with_original_language: LANGUAGES[seed % LANGUAGES.length] }, pages: 3 }
    case 'arabCinema':
      return { kind: seed % 2 ? 'tv' : 'movie', params: { sort_by: 'vote_count.desc', 'vote_average.gte': 6.8, 'vote_count.gte': 20, with_original_language: 'ar' }, pages: 3 }
    case 'crowdPleaser':
      return { kind: 'movie', params: { sort_by: 'popularity.desc', 'vote_average.gte': 7, 'vote_count.gte': 1000, 'primary_release_date.gte': `${year - 3}-01-01` }, pages: 5 }
    case 'family':
      return { kind: 'movie', params: { sort_by: 'vote_average.desc', 'vote_average.gte': 7, 'vote_count.gte': 1000, with_genres: '10751' }, pages: 6 }
  }
}

async function themeCandidates(today: string, kids: boolean, seed: number): Promise<Candidate[]> {
  let theme = WEEK[new Date(`${today}T12:00:00Z`).getUTCDay()]
  // Kids profiles: the Arabic catalogue has no age ratings to filter on.
  if (kids && theme === 'arabCinema') theme = 'family'
  const { kind, params, pages } = themeQuery(theme, today, seed)
  const page = 1 + ((seed >>> 4) % pages)
  const query = kids ? kidsDiscoverParams(kind, { ...params, 'vote_count.gte': 100 }) : params
  let data = await tmdbFetchSafe<{ results: any[] }>(`discover/${kind}`, { ...query, page }, 86400)
  if (!data?.results?.length) data = await tmdbFetchSafe<{ results: any[] }>(`discover/${kind}`, { ...query, page: 1 }, 86400)
  return (data?.results ?? []).filter(usable).map((item) => candidate(kind, item, { type: 'theme', theme }))
}

// ---------------------------------------------------------------------------------------------
// Memory.

type StoredPick = { _id: string, date: string, kids: boolean, kind: Kind, id: number, reason: PickReason, expires_at: Date }

async function picksCollection() {
  try {
    const collection = (await clientPromise).db().collection<StoredPick>('dailyPicks')
    await collection.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }).catch(() => {})
    return collection
  } catch (error) {
    console.error('Pick of the day: no database, picking without memory:', error)
    return null
  }
}

const pickKey = (date: string, kids: boolean) => `${date}${kids ? ':kids' : ''}`

async function choose(date: string, kids: boolean): Promise<{ kind: Kind, id: number, reason: PickReason } | null> {
  const collection = await picksCollection()
  const stored = await collection?.findOne({ _id: pickKey(date, kids) }).catch(() => null)
  if (stored) return stored

  // What was picked this past year (never again), and yesterday's kind of reason (not twice running).
  const history = collection
    ? await collection.find({ kids, date: { $gte: addDays(date, -365), $lt: date } }, { projection: { kind: 1, id: 1, date: 1, reason: 1 } }).toArray().catch(() => [])
    : []
  const used = new Set(history.map((entry) => `${entry.kind}:${entry.id}`))
  const yesterday = history.find((entry) => entry.date === addDays(date, -1))?.reason.type

  const seed = hash(pickKey(date, kids))
  const [sequels, birthdays, seasons, moment, theme] = await Promise.all([
    sequelCandidates(date, kids).catch(() => []),
    anniversaryCandidates(date, kids).catch(() => []),
    newSeasonCandidates(date, kids).catch(() => []),
    momentCandidates(date, kids).catch(() => []),
    themeCandidates(date, kids, seed).catch(() => []),
  ])
  const fresh = (list: Candidate[]) => list.filter((item) => !used.has(`${item.kind}:${item.id}`) && item.reason.type !== yesterday)
  const tiers = [fresh([...sequels, ...birthdays, ...seasons]), fresh(moment), theme.filter((item) => !used.has(`${item.kind}:${item.id}`))]
  const tier = tiers.find((list) => list.length > 0)
  if (!tier) return null
  // Among the best few of the tier, the day's draw.
  const best = [...tier].sort((a, b) => b.rating - a.rating).slice(0, 5)
  const winner = best[(seed >>> 8) % best.length]

  if (!collection) return winner
  const doc: StoredPick = { _id: pickKey(date, kids), date, kids, kind: winner.kind, id: winner.id, reason: winner.reason, expires_at: new Date(Date.parse(`${date}T00:00:00Z`) + 400 * 86400000) }
  try {
    // Two first requests at once: the one stored first wins, for both.
    return (await collection.findOneAndUpdate({ _id: doc._id }, { $setOnInsert: doc }, { upsert: true, returnDocument: 'after' })).value ?? winner
  } catch {
    return (await collection.findOne({ _id: doc._id }).catch(() => null)) ?? winner
  }
}

// ---------------------------------------------------------------------------------------------
// Today's pick, in the viewer's language.

async function describe(reason: PickReason, locale: Locale): Promise<string> {
  const t = createTranslator(locale)
  switch (reason.type) {
    case 'sequel': {
      const sequel = await tmdbFetchSafe<any>(`movie/${reason.sequelId}`, { language: tmdbLanguage(locale) }, 86400)
      const title = sequel?.title || ''
      if (reason.date <= tunisToday()) return t('pick.why.sequelOut', { title })
      const date = formatDate(reason.date, locale, { day: 'numeric', month: 'long' })
      return t('pick.why.sequel', { title, date })
    }
    case 'newSeason':
      return t('pick.why.newSeason', { season: reason.season })
    case 'anniversary':
      return t('pick.why.anniversary', { years: reason.years })
    case 'moment':
      return t('pick.why.moment', { moment: t(`moment.${reason.moment}.title` as TKey) })
    case 'theme':
      return t(`pick.why.${reason.theme}` as TKey)
  }
}

export async function getPickOfTheDay(kids: boolean, locale: Locale, date = tunisToday()): Promise<PickOfTheDay | null> {
  const pick = await choose(date, kids)
  if (!pick) return null
  const [english, translated, why] = await Promise.all([
    tmdbFetchSafe(`${pick.kind}/${pick.id}`, { append_to_response: 'images', include_image_language: logoLanguages(locale) }, 86400),
    translatedRecord(pick.kind, String(pick.id), locale, 86400),
    describe(pick.reason, locale),
  ])
  if (!english) return null
  // The viewer's language where TMDB has it, English otherwise (see lib/tmdb-locale). In Arabic the
  // pick also takes TMDB's Arabic title and tagline, as it always has (and no English tagline).
  let data = localizeDetail(english, translated, locale)
  if (isArabicScript(locale) && translated) {
    data = { ...data, title: translated.title || data.title, name: translated.name || data.name, tagline: translated.tagline || '' }
  }
  return { kind: pick.kind, date, data: { ...data, overview: data.overview || '' }, reason: pick.reason, why }
}
