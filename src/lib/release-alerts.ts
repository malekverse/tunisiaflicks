// The daily release-alert job (run by /api/cron/notify). Safe to run any number of times:
//  1. every followed title is checked on TMDB; a release / new episode becomes one notification per follower,
//     keyed by a unique (userId, event_key) so it can never be created twice, and only then does the
//     follow's marker move forward (a crash in between just retries, it never loses or doubles an alert);
//  2. each user's pending notifications are claimed, sent as ONE email, then marked sent.
// New notifications are also pushed right away to the follower's devices that opted in (lib/push.ts).
//
// Each notification is stamped `kidSafe` when it's created (Kids profiles only see those in the
// bell, and devices bound to a Kids profile only get those pushed). An account that turned off
// "Release alerts by email" (users.emailPrefs.releaseAlerts === false) keeps the bell and the
// pushes, never the e-mail. Every e-mail takes a slot of the day's shared bulk budget
// (reserveMail in lib/email.ts); once it's spent the rest waits for the next run.
import { randomUUID } from 'crypto'
import { MongoServerError, ObjectId } from 'mongodb'
import clientPromise from '@/src/lib/mongodb'
import { sendReleaseAlertsEmail, type ReleaseAlert } from '@/src/lib/email'
import {
  alertCollections, episodeCode, fetchTitleSnapshot, hasReleased, isNewerEpisode, todayUtc, type TitleSnapshot,
} from '@/src/lib/follows'
import type { FollowMediaType, ReleaseNotification } from '@/src/lib/models/Follow'
import { pushToUser } from '@/src/lib/push'
import { isKidSafe } from '@/src/lib/kids'
import { tmdbFetchSafe } from '@/src/lib/tmdb'
import { createTranslator } from '@/src/lib/i18n'

const TMDB_CONCURRENCY = 6
/** Gmail allows ~500 messages a day; whatever is left over goes out on the next run. */
const MAX_EMAILS_PER_RUN = 200
const MAX_EMAIL_ATTEMPTS = 3
/** A claim older than this was left behind by a crashed run and may be taken over. */
const STALE_CLAIM_MS = 30 * 60 * 1000

export type ReleaseAlertStats = {
  titlesChecked: number
  titlesFailed: number
  titlesSkipped: number
  notificationsCreated: number
  usersEmailed: number
  emailsFailed: number
  emailsDeferred: number
  /** Accounts with release e-mails turned off: their alerts were marked done without an e-mail. */
  emailsSkipped: number
  /** Left for the next run because today's bulk mail budget is spent. */
  emailsOverQuota: number
}

const isDuplicateKey = (error: unknown) => error instanceof MongoServerError && error.code === 11000

const formatDate = (date?: string | null) =>
  date ? new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : null

function headline(doc: Pick<ReleaseNotification, 'kind' | 'episode'>, releaseDate?: string | null) {
  if (doc.kind === 'movie_released') {
    const date = formatDate(releaseDate)
    return date ? `Out now (released ${date})` : 'Out now'
  }
  const episode = doc.episode
  if (!episode) return 'New episode out now'
  const name = episode.name ? ` · ${episode.name}` : ''
  const date = formatDate(episode.air_date)
  return `New episode: ${episodeCode(episode)}${name}${date ? ` (aired ${date})` : ''}`
}

/** Runs `worker` over `items` with at most `limit` in flight; stops picking up new items once `shouldStop()`. */
async function eachLimited<T>(items: T[], limit: number, shouldStop: () => boolean, worker: (item: T) => Promise<void>) {
  let next = 0
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length && !shouldStop()) {
      await worker(items[next++])
    }
  })
  await Promise.all(lanes)
  return next
}

export async function runReleaseAlerts({ deadline = Date.now() + 50_000 }: { deadline?: number } = {}): Promise<ReleaseAlertStats> {
  const { follows, notifications } = await alertCollections()
  const now = new Date()
  const today = todayUtc()
  const timeUp = () => Date.now() > deadline
  const stats: ReleaseAlertStats = {
    titlesChecked: 0, titlesFailed: 0, titlesSkipped: 0, notificationsCreated: 0, usersEmailed: 0, emailsFailed: 0, emailsDeferred: 0,
    emailsSkipped: 0, emailsOverQuota: 0,
  }

  // ---- 1. Detect releases / new episodes -------------------------------------------------------
  // One TMDB call per distinct title (not per follower). Movies already announced drop out.
  // Least recently checked first, so a run that hits the deadline is picked up by the next one.
  const titles = await follows.aggregate<{ _id: { media_type: FollowMediaType, tmdbId: string } }>([
    { $match: { $or: [{ media_type: 'tv' }, { media_type: 'movie', released_notified_at: null }] } },
    { $group: { _id: { media_type: '$media_type', tmdbId: '$tmdbId' }, checked_at: { $min: '$checked_at' } } },
    { $sort: { checked_at: 1 } },
  ]).toArray()

  // Whether a title may reach Kids profiles: worked out once per title, only when someone is due.
  const kidSafeOf = new Map<string, Promise<boolean>>()
  const kidSafeTitle = (snapshot: TitleSnapshot) => {
    const key = `${snapshot.media_type}:${snapshot.tmdbId}`
    let pending = kidSafeOf.get(key)
    if (!pending) {
      pending = tmdbFetchSafe(`${snapshot.media_type}/${snapshot.tmdbId}`, {}, 86400)
        .then((detail) => (detail ? isKidSafe(detail, snapshot.media_type) : false))
        .catch(() => false)
      kidSafeOf.set(key, pending)
    }
    return pending
  }

  const notify = async (snapshot: TitleSnapshot, userId: string, doc: Pick<ReleaseNotification, 'kind' | 'event_key' | 'episode'>) => {
    const kidSafe = await kidSafeTitle(snapshot)
    try {
      const notification: ReleaseNotification & { kidSafe: boolean } = {
        userId,
        media_type: snapshot.media_type,
        tmdbId: snapshot.tmdbId,
        title: snapshot.title,
        poster_path: snapshot.poster_path,
        ...doc,
        kidSafe,
        created_at: now,
        read: false,
        email_status: 'pending',
      }
      await notifications.insertOne(notification)
      stats.notificationsCreated++
    } catch (error) {
      if (!isDuplicateKey(error)) throw error // already created by an earlier (interrupted) run
      return
    }
    // Best effort: the email and the in-app bell remain the reliable channels.
    await pushToUser(userId, (device) => {
      const t = createTranslator(device.locale)
      const episode = doc.episode
        ? t('alerts.newEpisodeCode', { episode: t('common.seasonEpisode', { season: doc.episode.season, episode: doc.episode.episode }) })
        : t('alerts.newEpisode')
      return {
        title: snapshot.title,
        body: doc.kind === 'movie_released' ? t('alerts.outNow') : episode,
        url: `/${snapshot.media_type}/${snapshot.tmdbId}`,
        tag: doc.event_key,
      }
    }, 'alerts', { kidSafe }).catch((error) => console.error('Release alert push failed:', error))
  }

  const checkTitle = async ({ _id: { media_type, tmdbId } }: (typeof titles)[number]) => {
    let snapshot: TitleSnapshot
    try {
      snapshot = await fetchTitleSnapshot(media_type, tmdbId, 0)
    } catch (error) {
      console.error(`Release alerts: TMDB ${media_type}/${tmdbId} failed`, error)
      stats.titlesFailed++
      return
    }
    stats.titlesChecked++

    const titleFilter = { media_type, tmdbId }
    await follows.updateMany(titleFilter, {
      $set: {
        title: snapshot.title,
        poster_path: snapshot.poster_path,
        checked_at: now,
        ...(media_type === 'movie' ? { release_date: snapshot.release_date } : {}),
      },
    })

    if (media_type === 'movie') {
      if (!hasReleased(snapshot.release_date, today)) return
      const due = await follows.find({ ...titleFilter, released_notified_at: null }).project<{ _id: ObjectId, userId: string }>({ userId: 1 }).toArray()
      for (const follow of due) {
        await notify(snapshot, follow.userId, { kind: 'movie_released', event_key: `movie:${tmdbId}:released`, episode: null })
        await follows.updateOne({ _id: follow._id }, { $set: { released_notified_at: now } })
      }
      return
    }

    const latest = snapshot.last_episode
    if (!latest || latest.season < 1 || (latest.air_date && latest.air_date > today)) return
    const marker = { season: latest.season, episode: latest.episode, air_date: latest.air_date ?? null }
    const due = await follows.find({
      ...titleFilter,
      $or: [
        { last_episode: null },
        { 'last_episode.season': { $lt: latest.season } },
        { 'last_episode.season': latest.season, 'last_episode.episode': { $lt: latest.episode } },
      ],
    }).project<{ _id: ObjectId, userId: string, last_episode?: typeof marker | null }>({ userId: 1, last_episode: 1 }).toArray()
    for (const follow of due) {
      if (!isNewerEpisode(latest, follow.last_episode)) continue
      await notify(snapshot, follow.userId, { kind: 'new_episode', event_key: `tv:${tmdbId}:${episodeCode(latest)}`, episode: latest })
      await follows.updateOne({ _id: follow._id }, { $set: { last_episode: marker } })
    }
  }

  const started = await eachLimited(titles, TMDB_CONCURRENCY, timeUp, checkTitle)
  stats.titlesSkipped = titles.length - started

  // ---- 2. One email per user ---------------------------------------------------------------------
  const claimable = () => ({
    $or: [
      { email_status: 'pending' as const },
      { email_status: 'sending' as const, email_claimed_at: { $lt: new Date(Date.now() - STALE_CLAIM_MS) } },
    ],
  })
  const userIds: string[] = await notifications.distinct('userId', claimable())
  const users = (await clientPromise).db().collection('users')
  const claim = randomUUID()

  let overQuota = false
  for (const userId of userIds) {
    if (overQuota) {
      stats.emailsOverQuota++
      continue
    }
    if (stats.usersEmailed + stats.emailsFailed >= MAX_EMAILS_PER_RUN || timeUp()) {
      stats.emailsDeferred++
      continue
    }

    // Claim this user's pending alerts so an overlapping run can't email them too.
    await notifications.updateMany({ userId, ...claimable() }, {
      $set: { email_status: 'sending', email_claim: claim, email_claimed_at: new Date() },
    })
    const docs = await notifications.find({ userId, email_status: 'sending', email_claim: claim }).sort({ created_at: 1 }).toArray()
    if (docs.length === 0) continue
    const ids = docs.map((doc) => doc._id)

    const user = ObjectId.isValid(userId) ? await users.findOne({ _id: new ObjectId(userId) }, { projection: { email: 1, name: 1, emailPrefs: 1 } }) : null
    if (!user?.email) {
      // Account gone or without an email: keep the in-app notifications, never try to email them.
      await notifications.updateMany({ _id: { $in: ids } }, { $set: { email_status: 'failed', email_claim: null } })
      continue
    }
    if (user.emailPrefs?.releaseAlerts === false) {
      // Release e-mails turned off: the bell and the pushes already have them; done, no e-mail.
      await notifications.updateMany({ _id: { $in: ids } }, { $set: { email_status: 'sent', emailed_at: null, email_claim: null } })
      stats.emailsSkipped++
      continue
    }

    // Movies need their release date for the headline; it lives on the follow.
    const movieIds = docs.filter((doc) => doc.kind === 'movie_released').map((doc) => doc.tmdbId)
    const releaseDates = new Map(
      movieIds.length === 0 ? [] : (await follows.find({ userId, media_type: 'movie', tmdbId: { $in: movieIds } }, { projection: { tmdbId: 1, release_date: 1 } }).toArray())
        .map((follow) => [follow.tmdbId, follow.release_date] as const)
    )
    const alerts: ReleaseAlert[] = docs.map((doc) => ({
      media_type: doc.media_type,
      tmdbId: doc.tmdbId,
      title: doc.title,
      poster_path: doc.poster_path,
      headline: headline(doc, releaseDates.get(doc.tmdbId)),
    }))

    try {
      const result = await sendReleaseAlertsEmail(user.email, user.name, alerts)
      if (result === 'quota') {
        // Today's bulk budget is spent: back to pending (not an attempt), and stop e-mailing.
        await notifications.updateMany({ _id: { $in: ids }, email_claim: claim }, { $set: { email_status: 'pending', email_claim: null } })
        stats.emailsOverQuota++
        overQuota = true
        continue
      }
      await notifications.updateMany({ _id: { $in: ids } }, { $set: { email_status: 'sent', emailed_at: new Date(), email_claim: null } })
      stats.usersEmailed++
    } catch (error) {
      console.error(`Release alerts: email to user ${userId} failed`, error)
      stats.emailsFailed++
      // Back to pending for the next run, unless it already failed too many times.
      await notifications.updateMany({ _id: { $in: ids } }, [{
        $set: {
          email_attempts: { $add: [{ $ifNull: ['$email_attempts', 0] }, 1] },
          email_claim: null,
        },
      }, {
        $set: { email_status: { $cond: [{ $gte: ['$email_attempts', MAX_EMAIL_ATTEMPTS] }, 'failed', 'pending'] } },
      }])
    }
  }

  return stats
}
