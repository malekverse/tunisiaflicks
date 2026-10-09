// The badge collections and their indexes (created lazily, once per server instance). Native driver
// (mongodb 5.9: findOneAndUpdate answers { value }).
import 'server-only'
import type { Collection } from 'mongodb'
import clientPromise from '@/src/lib/mongodb'
import type { BadgeId, Level } from './catalogue'
import type { Streak } from './time'
import type { TitleFacts } from './metrics'

export type EarnedBadge = {
  level: Level
  /** First earned. */
  at: Date
  /** When the current level was reached. */
  levelAt: Date
  /** The level the owner has opened in the dialog (the shelf shows a dot above it). */
  seenLevel: number
  /** The level the inbox has told them about. */
  announcedLevel: number
}

/** One per profile; _id is the profile id. */
export type BadgesDoc = {
  _id: string
  userId: string
  kids: boolean
  version: number
  computedAt: Date
  /** The Tunis day of the last computation (a new day recomputes: streaks and Ramadan move). */
  computedDay: string
  /** Set by every play; cleared by the computation that saw it. */
  dirtyAt?: Date
  /** The last computation ran out of TMDB budget: the next view finishes it. */
  factsIncomplete?: boolean
  /** A level is above what the inbox announced (the cron picks it up). */
  pendingAnnounce?: boolean
  earned: Partial<Record<BadgeId, EarnedBadge>>
  /** The measured value behind each badge. */
  progress: Partial<Record<BadgeId, number>>
  streak: Streak
  /** 'Badges and streak' is off: no log is kept and the shelf is hidden. */
  disabled?: boolean
}

export type ActivityDayDoc = { d: number; n?: true; e?: true; k: string[] }

/** One per profile and month: _id `${profileId}:${YYYY-MM}`. Kept 13 months (expireAt, TTL). */
export type WatchActivityDoc = {
  _id: string
  userId: string
  profileId: string
  month: string
  days: ActivityDayDoc[]
  expireAt: Date
}

export type TitleFactsDoc = TitleFacts & { _id: string; expireAt: Date }

let ready: Promise<unknown> | null = null

export async function badgesDb(): Promise<{
  badges: Collection<BadgesDoc>
  activity: Collection<WatchActivityDoc>
  facts: Collection<TitleFactsDoc>
}> {
  const db = (await clientPromise).db()
  const badges = db.collection<BadgesDoc>('badges')
  const activity = db.collection<WatchActivityDoc>('watchActivity')
  const facts = db.collection<TitleFactsDoc>('titleFacts')
  ready ??= Promise.all([
    badges.createIndex({ userId: 1 }),
    badges.createIndex({ dirtyAt: 1 }, { sparse: true }),
    badges.createIndex({ pendingAnnounce: 1 }, { sparse: true }),
    activity.createIndex({ profileId: 1, month: 1 }),
    activity.createIndex({ userId: 1 }),
    activity.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }),
    facts.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }),
  ]).catch((error) => {
    ready = null
    console.error('badges: creating indexes failed', error)
  })
  await ready
  return { badges, activity, facts }
}
