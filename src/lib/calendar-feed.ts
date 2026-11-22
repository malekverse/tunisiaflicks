// Your release calendar: one private link per account that a calendar app subscribes to once, and
// then keeps up to date by itself with every release the person follows (films' release dates,
// shows' episodes). The link's secret lives on the user document; a new link retires the old one.
// The feed is read by calendar apps a few times a day and the CDN keeps each answer for hours,
// so it costs a handful of function calls per subscriber per day.
import 'server-only'
import { randomBytes } from 'crypto'
import { ObjectId } from 'mongodb'
import clientPromise from '@/src/lib/mongodb'
import { tmdbFetchSafe } from '@/src/lib/tmdb'
import { isLocale, type Locale } from '@/src/lib/i18n/locales'
import type { ReleaseEvent } from '@/src/lib/calendar'
import { episodeEvents, inWindow, isFeedToken } from '@/src/lib/calendar-feed-rules'

const MAX_FOLLOWS = 300
const SHOW_TTL = 6 * 3600
const SEASON_TTL = 86400

type FeedField = { token: string, locale: Locale, createdAt: Date }

async function users() {
  const collection = (await clientPromise).db().collection('users')
  await collection.createIndex({ 'calendarFeed.token': 1 }, { unique: true, sparse: true }).catch(() => {})
  return collection
}

const objectId = (userId: string) => (ObjectId.isValid(userId) ? new ObjectId(userId) : null)

export async function getFeed(userId: string): Promise<FeedField | null> {
  const _id = objectId(userId)
  if (!_id) return null
  const user = await (await users()).findOne({ _id }, { projection: { calendarFeed: 1 } })
  return user?.calendarFeed && isFeedToken(user.calendarFeed.token) ? user.calendarFeed as FeedField : null
}

/** A new link (the old one, if any, stops working). */
export async function createFeed(userId: string, locale: Locale): Promise<FeedField | null> {
  const _id = objectId(userId)
  if (!_id) return null
  const feed: FeedField = { token: randomBytes(24).toString('base64url'), locale, createdAt: new Date() }
  await (await users()).updateOne({ _id }, { $set: { calendarFeed: feed } })
  return feed
}

export async function removeFeed(userId: string) {
  const _id = objectId(userId)
  if (_id) await (await users()).updateOne({ _id }, { $unset: { calendarFeed: '' } })
}

export async function feedOwner(token: string): Promise<{ userId: string, locale: Locale } | null> {
  if (!isFeedToken(token)) return null
  const user = await (await users()).findOne({ 'calendarFeed.token': token }, { projection: { _id: 1, 'calendarFeed.locale': 1 } })
  if (!user) return null
  const locale = user.calendarFeed?.locale
  return { userId: String(user._id), locale: isLocale(locale) ? locale : 'en' }
}

/** `work` over `items`, a few at a time (TMDB answers 429 to a burst). */
async function pooled<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      out[index] = await work(items[index])
    }
  }))
  return out
}

/** Every release in the calendar's window for what this account follows. */
export async function feedEvents(userId: string, today = new Date().toISOString().slice(0, 10)): Promise<ReleaseEvent[]> {
  const db = (await clientPromise).db()
  const follows = await db.collection('follows')
    .find({ userId }, { projection: { media_type: 1, tmdbId: 1, title: 1, release_date: 1 } })
    .sort({ created_at: -1 })
    .limit(MAX_FOLLOWS)
    .toArray()

  const events: ReleaseEvent[] = []
  for (const follow of follows) {
    if (follow.media_type === 'movie' && inWindow(follow.release_date, today)) {
      events.push({ kind: 'movie', id: String(follow.tmdbId), date: follow.release_date, title: String(follow.title ?? '') })
    }
  }

  const shows = follows.filter((follow) => follow.media_type === 'tv' && /^\d{1,9}$/.test(String(follow.tmdbId)))
  const lists = await pooled(shows, 6, async (follow): Promise<ReleaseEvent[]> => {
    const show = await tmdbFetchSafe<any>(`tv/${follow.tmdbId}`, {}, SHOW_TTL)
    if (!show?.id) return []
    // The season on air now (the next episode's), and the one that just ended if it's different.
    const seasons = new Set<number>()
    if (Number.isInteger(show.next_episode_to_air?.season_number)) seasons.add(show.next_episode_to_air.season_number)
    if (Number.isInteger(show.last_episode_to_air?.season_number) && inWindow(show.last_episode_to_air.air_date, today)) seasons.add(show.last_episode_to_air.season_number)
    const found = await Promise.all([...seasons].map(async (number) => {
      const season = await tmdbFetchSafe<any>(`tv/${show.id}/season/${number}`, {}, SEASON_TTL)
      return season ? episodeEvents(show, season, today) : []
    }))
    return found.flat().slice(0, 40)
  })
  return [...events, ...lists.flat()]
}
