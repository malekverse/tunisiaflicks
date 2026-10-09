// The Tunisian TV cron (GET /api/cron/tunisian-tv, through runCron): every phase checks the
// deadline before it starts something, so a run from cron-job.org (22s) always answers in time
// and says `more` when work is left.
//
// A. Feeds: the uploads (UULF) and lives (UULV) feeds of channels last read 25+ minutes ago, five
//    at a time; the channel feed (Shorts dropped) when the uploads feed fails. Playlists named in
//    descriptions are noted when they belong to the channel.
// B. Playlists: with YOUTUBE_API_KEY, the Data API (playlists, playlistItems ≤4 pages, videos,
//    channels; never search.list; 3,000 units a day at most). Without it, each playlist's feed
//    (15 entries): such series are never "complete". On-air playlists every 2h (30 min for a
//    Ramadan series during Ramadan), the others weekly.
// C. Verify: oEmbed for 40 new videos and 20 checked more than 7 days ago; cover checks.
// D. Derive: series, kinds, cadence, Ramadan, colours (derive.ts).
// E. Prune (retention below), then revalidateTag('ttv').
import 'server-only'
import { revalidateTag } from 'next/cache'
import { Binary, type AnyBulkWriteOperation } from 'mongodb'
import { ramadanStatus } from '@/src/lib/ramadan'
import { isYouTubeId } from '@/src/lib/youtube'
import type { CronResult } from '@/src/lib/cron'
import { enabledChannels, livesPlaylist, tunisianTvOff, uploadsPlaylist, type TvChannelDef } from './channels'
import { ttv, type TtvChannelDoc, type TtvCollections, type TtvPlaylistRef, type TtvSeriesDoc, type TtvVideoDoc } from './db'
import { deriveChannel, seriesIdOf } from './derive'
import {
  coverColor, fetchAvatar, fetchFeed, fetchFeedWithRetry, hasMaxresCover, isPlaylistId, oembedStatus, unitsToday, youtubeApi, youtubeApiKey,
  type EmbedStatus,
} from './net'
import { cleanDescription, looksLiveNow, parseEpisodeTitle, parseIsoDuration, playlistIdsIn, seriesKey, type FeedEntry } from './parse'
import type { TvChannelStatus } from './view'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export const FEED_EVERY_MS = 25 * MINUTE
const FEED_BATCH = 5
const VERIFY_NEW = 40
const VERIFY_OLD = 20
const RECHECK_MS = 7 * DAY
const MAX_PLAYLISTS_PER_CHANNEL = 40
const SHOW_KEEP = 60

/** What one run did (numbers only: they go to the cron log). */
type Stats = Record<string, number | boolean>

export type IngestScope = 'feeds' | 'full'

const timeLeft = (deadline: number) => deadline - Date.now()

async function inBatches<T, R>(items: T[], size: number, deadline: number, reserve: number, run: (item: T) => Promise<R>): Promise<{ results: R[], skipped: number }> {
  const results: R[] = []
  let index = 0
  while (index < items.length) {
    if (timeLeft(deadline) < reserve) break
    const batch = items.slice(index, index + size)
    results.push(...(await Promise.all(batch.map(run))))
    index += batch.length
  }
  return { results, skipped: items.length - index }
}

// ---------------------------------------------------------------------------------------------
// Videos

type Upload = { id: string, title: string, description: string, publishedAt: string, views: number | null, live?: boolean }

const fromEntry = (entry: FeedEntry, live = false): Upload => ({
  id: entry.id, title: entry.title, description: entry.description, publishedAt: entry.publishedAt, views: entry.views, live,
})

/** The upsert of one upload; `series` files it under a playlist's series. */
function upsertVideo(channel: string, upload: Upload, now: Date, series?: { id: string, playlistId: string }): AnyBulkWriteOperation<TtvVideoDoc> {
  const info = parseEpisodeTitle(upload.title)
  const set: Partial<TtvVideoDoc> = {
    title: upload.title,
    description: cleanDescription(upload.description, { title: upload.title }) || null,
    episode: info.episode,
    part: info.part,
    season: info.season,
    date: info.date,
    subtitle: info.subtitle,
    seriesName: info.series,
    seriesNameAlt: info.seriesAlt,
    clip: info.clip,
    live: upload.live === true,
    updatedAt: now,
  }
  if (upload.views !== null) set.views = upload.views
  const onInsert: Partial<TtvVideoDoc> = {
    channelId: channel,
    publishedAt: new Date(upload.publishedAt),
    duration: null,
    status: 'new',
    checkedAt: null,
    recheckAt: now,
    seenAt: now,
  }
  if (upload.views === null) onInsert.views = null
  if (series) {
    set.seriesId = series.id
    return { updateOne: { filter: { _id: upload.id }, update: { $set: set, $setOnInsert: onInsert, $addToSet: { playlistIds: series.playlistId } }, upsert: true } }
  }
  return { updateOne: { filter: { _id: upload.id }, update: { $set: set, $setOnInsert: { ...onInsert, seriesId: null, playlistIds: [] } }, upsert: true } }
}

// ---------------------------------------------------------------------------------------------
// A. Feeds

type FeedRead = {
  def: TvChannelDef
  ok: boolean
  uploads: FeedEntry[]
  /** The lives feed's entries; [] when the channel has none (404); null when it couldn't be read. */
  lives: FeedEntry[] | null
}

async function readChannel(def: TvChannelDef, deadline: number): Promise<FeedRead> {
  const [uploads, lives] = await Promise.all([
    fetchFeedWithRetry({ playlist: uploadsPlaylist(def.youtubeId) }, deadline),
    fetchFeed({ playlist: livesPlaylist(def.youtubeId) }, deadline),
  ])
  const mine = (entry: FeedEntry) => !entry.isShort && (!entry.channelId || entry.channelId === def.youtubeId)
  let entries: FeedEntry[] | null = uploads.ok && (!uploads.feed.channelId || uploads.feed.channelId === def.youtubeId) ? uploads.feed.entries.filter(mine) : null
  let liveEntries: FeedEntry[] | null = lives.ok
    ? (lives.feed.channelId && lives.feed.channelId !== def.youtubeId ? null : lives.feed.entries.filter(mine))
    : lives.status === 404 ? [] : null
  if (entries === null && timeLeft(deadline) > 4000) {
    // The channel feed lists everything, Shorts and lives included.
    const channel = await fetchFeedWithRetry({ channel: def.youtubeId }, deadline)
    if (channel.ok && channel.feed.channelId === def.youtubeId) {
      entries = channel.feed.entries.filter(mine)
      liveEntries ??= entries
    }
  }
  return { def, ok: entries !== null, uploads: entries ?? [], lives: liveEntries }
}

function statusOf(doc: Pick<TtvChannelDoc, 'feedFailures' | 'feedOkAt' | 'lastUploadAt' | 'status'>, now: Date): TvChannelStatus {
  if (doc.feedFailures >= 6 && (!doc.feedOkAt || now.getTime() - doc.feedOkAt.getTime() > 72 * HOUR)) return 'unreachable'
  if (!doc.lastUploadAt) return doc.status === 'unreachable' ? 'active' : doc.status
  const age = now.getTime() - doc.lastUploadAt.getTime()
  return age < 30 * DAY ? 'active' : age < 180 * DAY ? 'quiet' : 'dormant'
}

/** The channel documents, created from the table when missing and kept in step with it. */
async function ensureChannels(db: TtvCollections, defs: TvChannelDef[], now: Date): Promise<Map<string, TtvChannelDoc>> {
  if (defs.length > 0) {
    await db.channels.bulkWrite(defs.map((def) => ({
      updateOne: {
        filter: { _id: def.slug },
        update: {
          $set: { slug: def.slug, name: def.name, nameAr: def.nameAr, handle: def.handle, youtubeId: def.youtubeId, kind: def.kind, disabled: false },
          $setOnInsert: {
            avatar: null, color: def.color, status: 'active' as TvChannelStatus, lastUploadAt: null, weekCount: 0, feedReadAt: null, feedOkAt: null,
            feedFailures: 0, live: null, playlists: [], updatedAt: now,
          },
        },
        upsert: true,
      },
    })), { ordered: false })
  }
  // Channels switched off by the environment are marked, so the pages skip them.
  await db.channels.updateMany({ _id: { $nin: defs.map((def) => def.slug) } }, { $set: { disabled: true } })
  const docs = await db.channels.find({ _id: { $in: defs.map((def) => def.slug) } }).toArray()
  return new Map(docs.map((doc) => [doc._id, doc]))
}

async function phaseFeeds(db: TtvCollections, defs: TvChannelDef[], docs: Map<string, TtvChannelDoc>, o: { deadline: number, now: Date, all: boolean }, stats: Stats) {
  const due = defs.filter((def) => {
    const read = docs.get(def.slug)?.feedReadAt
    return o.all || !read || o.now.getTime() - read.getTime() >= FEED_EVERY_MS
  })
  // Least recently read first.
  due.sort((a, b) => (docs.get(a.slug)?.feedReadAt?.getTime() ?? 0) - (docs.get(b.slug)?.feedReadAt?.getTime() ?? 0))
  // A channel gets 7 seconds (its retries and the fallback included); the phase leaves 11 for the rest.
  const { results, skipped } = await inBatches(due, FEED_BATCH, o.deadline, 11000, (def) => readChannel(def, Math.min(o.deadline - 6000, Date.now() + 7000)))
  stats.feedsDue = due.length
  const failed = results.filter((read) => !read.ok).length
  stats.feedsRead = results.length - failed
  stats.feedsFailed = failed
  if (skipped > 0) stats.more = true
  // Most feeds failing at once is YouTube, not the channels: statuses stay as they are.
  const outage = results.length >= 3 && failed / results.length >= 0.8
  stats.outage = outage

  const writes: AnyBulkWriteOperation<TtvVideoDoc>[] = []
  for (const read of results) {
    const doc = docs.get(read.def.slug)
    if (!doc) continue
    const now = o.now
    const liveEntry = read.lives?.find((entry) => looksLiveNow(entry, now)) ?? null
    const seen = new Set<string>()
    for (const entry of [...read.uploads, ...(read.lives ?? [])]) {
      if (seen.has(entry.id)) continue
      seen.add(entry.id)
      writes.push(upsertVideo(read.def.slug, fromEntry(entry, entry.id === liveEntry?.id), now))
    }

    const update: Partial<TtvChannelDoc> = { feedReadAt: now, updatedAt: now }
    if (read.ok) {
      const newest = read.uploads.reduce<Date | null>((top, entry) => {
        const at = new Date(entry.publishedAt)
        return !top || at > top ? at : top
      }, doc.lastUploadAt)
      update.feedOkAt = now
      update.feedFailures = 0
      update.lastUploadAt = newest
      update.weekCount = read.uploads.filter((entry) => now.getTime() - Date.parse(entry.publishedAt) < 7 * DAY).length
      // Playlists the channel links in its descriptions (checked against the playlist's own feed later).
      const known = new Set(doc.playlists.map((ref) => ref.id))
      const found = read.uploads.flatMap((entry) => playlistIdsIn(entry.description)).filter((id) => isPlaylistId(id) && !known.has(id))
      const fresh = [...new Set(found)].map((id): TtvPlaylistRef => ({ id, readAt: null, failures: 0 }))
      if (fresh.length) update.playlists = [...fresh, ...doc.playlists].slice(0, MAX_PLAYLISTS_PER_CHANNEL)
    } else if (!outage) {
      update.feedFailures = doc.feedFailures + 1
    }
    if (read.lives !== null) {
      update.live = liveEntry ? { videoId: liveEntry.id, title: liveEntry.title, since: new Date(liveEntry.publishedAt) } : null
    } else if (doc.live && o.now.getTime() - doc.live.since.getTime() > 14 * HOUR) {
      update.live = null
    }
    const merged = { ...doc, ...update }
    if (!outage) update.status = statusOf(merged, o.now)
    Object.assign(doc, update)
    await db.channels.updateOne({ _id: doc._id }, { $set: update })
  }
  if (writes.length) {
    const result = await db.videos.bulkWrite(writes, { ordered: false })
    stats.videosNew = result.upsertedCount
  }
}

// ---------------------------------------------------------------------------------------------
// B. Playlists

type ApiList<T> = { items?: T[], nextPageToken?: string }
type ApiPlaylist = { id: string, snippet?: { title?: string, channelId?: string }, contentDetails?: { itemCount?: number } }
type ApiPlaylistItem = {
  snippet?: { title?: string, description?: string, videoOwnerChannelId?: string, resourceId?: { videoId?: string } }
  contentDetails?: { videoId?: string, videoPublishedAt?: string }
  status?: { privacyStatus?: string }
}
type ApiVideo = {
  id: string
  snippet?: { liveBroadcastContent?: string }
  contentDetails?: { duration?: string }
  status?: { embeddable?: boolean, privacyStatus?: string, uploadStatus?: string }
  statistics?: { viewCount?: string }
}
type ApiChannel = { id: string, snippet?: { thumbnails?: Record<string, { url?: string }> } }

/** Once a week with the API: each channel's playlists (titles and sizes) and pictures. */
async function listWithApi(db: TtvCollections, defs: TvChannelDef[], docs: Map<string, TtvChannelDoc>, o: { deadline: number, now: Date }, stats: Stats) {
  const stale = defs.filter((def) => {
    const at = docs.get(def.slug)?.avatarAt
    return !at || o.now.getTime() - at.getTime() > 7 * DAY
  })
  if (stale.length && timeLeft(o.deadline) > 8000) {
    const answer = await youtubeApi<ApiList<ApiChannel>>(db, 'channels', { part: 'snippet', id: stale.map((def) => def.youtubeId).join(','), maxResults: 50 }, o.deadline)
    for (const item of answer?.items ?? []) {
      const def = stale.find((candidate) => candidate.youtubeId === item.id)
      const url = item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url
      if (!def || !url || timeLeft(o.deadline) < 6000) continue
      const picture = await fetchAvatar(url, o.deadline)
      const update: Partial<TtvChannelDoc> = { avatar: url, avatarAt: o.now }
      if (picture) {
        update.avatarData = new Binary(picture.data)
        if (picture.color) update.color = picture.color
      }
      await db.channels.updateOne({ _id: def.slug }, { $set: update })
      stats.avatars = (Number(stats.avatars) || 0) + 1
    }
  }

  for (const def of defs) {
    const doc = docs.get(def.slug)
    if (!doc || (doc.playlistsListedAt && o.now.getTime() - doc.playlistsListedAt.getTime() < 7 * DAY)) continue
    if (timeLeft(o.deadline) < 8000) {
      stats.more = true
      break
    }
    const found: ApiPlaylist[] = []
    let page: string | undefined
    for (let n = 0; n < 2; n++) {
      const answer = await youtubeApi<ApiList<ApiPlaylist>>(db, 'playlists', { part: 'snippet,contentDetails', channelId: def.youtubeId, maxResults: 50, ...(page ? { pageToken: page } : {}) }, o.deadline)
      if (!answer) break
      found.push(...(answer.items ?? []))
      page = answer.nextPageToken
      if (!page) break
    }
    const refs = new Map(doc.playlists.map((ref) => [ref.id, ref]))
    for (const item of found) {
      if (!isPlaylistId(item.id) || (item.snippet?.channelId && item.snippet.channelId !== def.youtubeId)) continue
      refs.set(item.id, { ...(refs.get(item.id) ?? { readAt: null, failures: 0 }), id: item.id, title: item.snippet?.title ?? null, itemCount: item.contentDetails?.itemCount ?? null })
    }
    // Biggest playlists first: the series, not the one-off collections.
    const playlists = [...refs.values()].sort((a, b) => (b.itemCount ?? 0) - (a.itemCount ?? 0)).slice(0, MAX_PLAYLISTS_PER_CHANNEL)
    doc.playlists = playlists
    doc.playlistsListedAt = o.now
    await db.channels.updateOne({ _id: def.slug }, { $set: { playlists, playlistsListedAt: o.now } })
  }
}

/** When a playlist is next due: on air every 2h (30 min for this Ramadan's series), else weekly. */
function playlistDue(ref: TtvPlaylistRef, series: Pick<TtvSeriesDoc, 'lastAt' | 'ramadan'> | undefined, o: { now: Date, ramadanYear: number | null }): boolean {
  if (ref.rejected || (ref.failures ?? 0) >= 6) return false
  if (!ref.readAt) return true
  const age = o.now.getTime() - ref.readAt.getTime()
  // A failed read (YouTube's feeds often fail) is retried sooner, a little later each time.
  if ((ref.failures ?? 0) > 0) return age >= (ref.failures ?? 1) * HOUR
  const onAir = !!series && o.now.getTime() - series.lastAt.getTime() < 21 * DAY
  if (!onAir) return age >= 7 * DAY
  if (o.ramadanYear !== null && series?.ramadan === o.ramadanYear) return age >= 30 * MINUTE
  return age >= 2 * HOUR
}

type PlaylistRead = { uploads: Upload[], title: string | null, complete: boolean } | { rejected: true } | null

async function readPlaylistWithApi(db: TtvCollections, def: TvChannelDef, ref: TtvPlaylistRef, deadline: number): Promise<PlaylistRead> {
  let title = ref.title ?? null
  if (!title) {
    const answer = await youtubeApi<ApiList<ApiPlaylist>>(db, 'playlists', { part: 'snippet,contentDetails', id: ref.id }, deadline)
    const item = answer?.items?.[0]
    if (!answer) return null
    if (!item || (item.snippet?.channelId && item.snippet.channelId !== def.youtubeId)) return { rejected: true }
    title = item.snippet?.title ?? null
  }
  const uploads: Upload[] = []
  let page: string | undefined
  let complete = false
  for (let n = 0; n < 4; n++) {
    if (timeLeft(deadline) < 3000) break
    const answer = await youtubeApi<ApiList<ApiPlaylistItem>>(db, 'playlistItems', { part: 'snippet,contentDetails,status', playlistId: ref.id, maxResults: 50, ...(page ? { pageToken: page } : {}) }, deadline)
    if (!answer) return uploads.length ? { uploads, title, complete: false } : null
    for (const item of answer.items ?? []) {
      const id = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId
      const published = item.contentDetails?.videoPublishedAt
      if (!isYouTubeId(id) || !published || item.status?.privacyStatus === 'private') continue
      if (item.snippet?.videoOwnerChannelId && item.snippet.videoOwnerChannelId !== def.youtubeId) continue
      uploads.push({ id, title: item.snippet?.title ?? '', description: item.snippet?.description ?? '', publishedAt: new Date(published).toISOString(), views: null })
    }
    page = answer.nextPageToken
    if (!page) {
      complete = true
      break
    }
  }
  return { uploads, title, complete }
}

async function readPlaylistFeed(def: TvChannelDef, ref: TtvPlaylistRef, deadline: number): Promise<PlaylistRead> {
  const read = await fetchFeedWithRetry({ playlist: ref.id }, deadline)
  if (!read.ok) return null
  // Only a playlist of this channel's own videos.
  if (read.feed.channelId !== def.youtubeId) return { rejected: true }
  return { uploads: read.feed.entries.filter((entry) => !entry.isShort).map((entry) => fromEntry(entry)), title: read.feed.title, complete: false }
}

async function phasePlaylists(db: TtvCollections, defs: TvChannelDef[], docs: Map<string, TtvChannelDoc>, o: { deadline: number, now: Date }, stats: Stats) {
  const withApi = !!youtubeApiKey()
  if (withApi) await listWithApi(db, defs, docs, o, stats)

  const status = ramadanStatus(o.now)
  const ramadanYear = status.phase === 'during' ? status.hijriYear : null
  const seriesDocs = await db.series.find({ channelId: { $in: defs.map((def) => def.slug) } }, { projection: { lastAt: 1, ramadan: 1 } }).toArray()
  const seriesById = new Map(seriesDocs.map((series) => [series._id, series]))

  const due: { def: TvChannelDef, ref: TtvPlaylistRef }[] = []
  for (const def of defs) {
    for (const ref of docs.get(def.slug)?.playlists ?? []) {
      if (playlistDue(ref, ref.seriesId ? seriesById.get(ref.seriesId) : undefined, { now: o.now, ramadanYear })) due.push({ def, ref })
    }
  }
  due.sort((a, b) => (a.ref.readAt?.getTime() ?? 0) - (b.ref.readAt?.getTime() ?? 0))
  stats.playlistsDue = due.length

  let read = 0
  const { skipped } = await inBatches(due, 4, o.deadline, 7000, async ({ def, ref }) => {
    const result = withApi ? await readPlaylistWithApi(db, def, ref, o.deadline) : await readPlaylistFeed(def, ref, o.deadline)
    const doc = docs.get(def.slug)
    if (!doc) return
    const at = doc.playlists.findIndex((candidate) => candidate.id === ref.id)
    if (at < 0) return
    if (result === null) {
      doc.playlists[at] = { ...ref, failures: (ref.failures ?? 0) + 1, readAt: o.now }
      return
    }
    if ('rejected' in result) {
      doc.playlists[at] = { ...ref, rejected: true, readAt: o.now }
      return
    }
    const info = parseEpisodeTitle(result.title ?? '')
    const name = info.series || (result.title ?? '').trim()
    const key = seriesKey(name)
    if (!key || result.uploads.length === 0) {
      doc.playlists[at] = { ...ref, title: result.title, readAt: o.now, failures: 0, seriesId: null }
      return
    }
    const seriesId = seriesIdOf(def.slug, key)
    const oldest = result.uploads.reduce((min, upload) => (upload.publishedAt < min ? upload.publishedAt : min), result.uploads[0].publishedAt)
    const newest = result.uploads.reduce((max, upload) => (upload.publishedAt > max ? upload.publishedAt : max), result.uploads[0].publishedAt)
    await db.series.updateOne({ _id: seriesId }, {
      $set: {
        channelId: def.slug, source: 'playlist', key, playlistId: ref.id, title: name, titleAlt: info.seriesAlt,
        // Complete only when the API read the whole playlist.
        complete: withApi && result.complete,
        updatedAt: o.now,
      },
      $setOnInsert: {
        kind: 'show', seasons: [], episodeCount: 0, firstAt: new Date(oldest), lastAt: new Date(newest), coverId: null, coverMaxres: false,
        color: null, ramadan: null, cadence: null, description: null, playable: 1, hidden: false,
      },
    }, { upsert: true })
    await db.videos.bulkWrite(result.uploads.map((upload) => upsertVideo(def.slug, upload, o.now, { id: seriesId, playlistId: ref.id })), { ordered: false })
    doc.playlists[at] = { ...ref, title: result.title, readAt: o.now, failures: 0, seriesId }
    read++
  })
  for (const def of defs) {
    const doc = docs.get(def.slug)
    if (doc) await db.channels.updateOne({ _id: def.slug }, { $set: { playlists: doc.playlists } })
  }
  stats.playlistsRead = read
  if (skipped > 0) stats.more = true
}

// ---------------------------------------------------------------------------------------------
// C. Verify

async function phaseVerify(db: TtvCollections, docs: Map<string, TtvChannelDoc>, o: { deadline: number, now: Date }, stats: Stats) {
  const fresh = await db.videos.find({ status: 'new' }, { projection: { _id: 1, channelId: 1 } }).sort({ publishedAt: -1 }).limit(VERIFY_NEW).toArray()
  // recheckAt is checkedAt + 7 days.
  const old = await db.videos.find({ status: { $in: ['ok', 'blocked'] }, recheckAt: { $lte: o.now } }, { projection: { _id: 1, channelId: 1 } })
    .sort({ recheckAt: 1 }).limit(VERIFY_OLD).toArray()
  const queue = [...fresh, ...old]
  const results = new Map<string, EmbedStatus>()
  const details = new Map<string, Partial<TtvVideoDoc>>()

  // With the API: one call checks 50 videos (duration, embedding, live) for one unit.
  if (youtubeApiKey() && fresh.length && timeLeft(o.deadline) > 6000) {
    const ids = fresh.map((video) => video._id)
    const answer = await youtubeApi<ApiList<ApiVideo>>(db, 'videos', { part: 'snippet,contentDetails,status,statistics', id: ids.join(','), maxResults: 50 }, o.deadline)
    if (answer) {
      const byId = new Map((answer.items ?? []).map((item) => [item.id, item]))
      for (const id of ids) {
        const item = byId.get(id)
        if (!item || item.status?.privacyStatus === 'private' || item.status?.uploadStatus === 'rejected') {
          results.set(id, 'gone')
          continue
        }
        results.set(id, item.status?.embeddable === false ? 'blocked' : 'ok')
        const views = Number(item.statistics?.viewCount)
        details.set(id, {
          duration: parseIsoDuration(item.contentDetails?.duration),
          live: item.snippet?.liveBroadcastContent === 'live',
          ...(Number.isFinite(views) ? { views } : {}),
        })
      }
    }
  }

  const pending = queue.filter((video) => !results.has(video._id))
  const { skipped } = await inBatches(pending, 8, o.deadline, 4000, async (video) => {
    results.set(video._id, await oembedStatus(video._id, o.deadline))
  })
  if (skipped > 0) stats.more = true

  const writes: AnyBulkWriteOperation<TtvVideoDoc>[] = []
  let ok = 0
  let blocked = 0
  let gone = 0
  for (const [id, status] of results) {
    if (status === 'unknown') continue
    if (status === 'ok') ok++
    else if (status === 'blocked') blocked++
    else gone++
    writes.push({
      updateOne: {
        filter: { _id: id },
        update: { $set: { status, checkedAt: o.now, recheckAt: new Date(o.now.getTime() + RECHECK_MS), ...(status === 'gone' ? { goneAt: o.now } : {}), ...(details.get(id) ?? {}) } },
      },
    })
  }
  if (writes.length) await db.videos.bulkWrite(writes, { ordered: false })
  // Not 'ok': runCron's own answer has that key.
  Object.assign(stats, { verified: writes.length, playable: ok, blocked, gone })

  // A live channel whose broadcast the API says is over: no longer live.
  for (const doc of docs.values()) {
    if (doc.live && details.has(doc.live.videoId) && details.get(doc.live.videoId)?.live === false) {
      doc.live = null
      await db.channels.updateOne({ _id: doc._id }, { $set: { live: null } })
    }
  }
}

// ---------------------------------------------------------------------------------------------
// D. Derive

async function phaseDerive(db: TtvCollections, defs: TvChannelDef[], o: { deadline: number, now: Date }, stats: Stats) {
  let seriesWritten = 0
  let covers = 0
  let colors = 0
  for (const def of defs) {
    if (timeLeft(o.deadline) < 1500) {
      stats.more = true
      break
    }
    const videos = await db.videos.find({ channelId: def.slug }, {
      projection: { _id: 1, title: 1, publishedAt: 1, seriesId: 1, playlistIds: 1, episode: 1, part: 1, season: 1, date: 1, clip: 1, status: 1, duration: 1, seriesName: 1, seriesNameAlt: 1, description: 1 },
    }).toArray()
    const existing = await db.series.find({ channelId: def.slug }).toArray()
    const { series, assign } = deriveChannel({ channel: def.slug, kind: def.kind, videos, existing, now: o.now })

    // Covers: is there a 1280×720 picture, and what light does it give? A few per run.
    for (const item of series) {
      if (!item.coverId || item.hidden) continue
      if (item.coverCheckedId !== item.coverId && covers < 10 && timeLeft(o.deadline) > 3000) {
        covers++
        const maxres = await hasMaxresCover(item.coverId, o.deadline)
        if (maxres !== null) {
          item.coverMaxres = maxres
          item.coverCheckedId = item.coverId
        }
      }
      if (item.colorOf !== item.coverId && colors < 6 && timeLeft(o.deadline) > 3000) {
        colors++
        const color = await coverColor(item.coverId, o.deadline)
        item.colorOf = item.coverId
        if (color) item.color = color
      }
    }

    const seriesWrites: AnyBulkWriteOperation<TtvSeriesDoc>[] = series.map((item) => ({
      replaceOne: { filter: { _id: item._id }, replacement: { ...item, updatedAt: o.now }, upsert: true },
    }))
    const keep = new Set(series.map((item) => item._id))
    const orphans = existing.filter((item) => !keep.has(item._id)).map((item) => item._id)
    if (seriesWrites.length) await db.series.bulkWrite(seriesWrites, { ordered: false })
    if (orphans.length) await db.series.deleteMany({ _id: { $in: orphans } })
    seriesWritten += seriesWrites.length

    const kindOf = new Map(series.map((item) => [item._id, item.kind]))
    const videoWrites: AnyBulkWriteOperation<TtvVideoDoc>[] = []
    for (const video of videos) {
      const seriesId = assign.get(video._id) ?? null
      const set: Partial<TtvVideoDoc> = {}
      if (seriesId !== video.seriesId) set.seriesId = seriesId
      // Descriptions are kept for drama episodes only.
      if (video.description && (!seriesId || kindOf.get(seriesId) !== 'drama')) set.description = null
      if (Object.keys(set).length) videoWrites.push({ updateOne: { filter: { _id: video._id }, update: { $set: set } } })
    }
    if (videoWrites.length) await db.videos.bulkWrite(videoWrites, { ordered: false })
  }
  Object.assign(stats, { series: seriesWritten, covers, colors })
}

// ---------------------------------------------------------------------------------------------
// E. Prune

/**
 * Retention: removed videos 30 days after they went; videos in no series after 45 days; videos
 * of hidden series (clips, or mostly unplayable) after 30; a talk or entertainment show keeps its
 * latest 60.
 */
async function phasePrune(db: TtvCollections, o: { now: Date }, stats: Stats) {
  const ago = (days: number) => new Date(o.now.getTime() - days * DAY)
  let pruned = 0
  pruned += (await db.videos.deleteMany({ status: 'gone', goneAt: { $lt: ago(30) } })).deletedCount
  pruned += (await db.videos.deleteMany({ seriesId: null, publishedAt: { $lt: ago(45) }, live: { $ne: true } })).deletedCount
  const hidden = await db.series.find({ hidden: true }, { projection: { _id: 1 } }).toArray()
  if (hidden.length) pruned += (await db.videos.deleteMany({ seriesId: { $in: hidden.map((item) => item._id) }, publishedAt: { $lt: ago(30) } })).deletedCount
  // 60 videos are at least 20 broadcasts (three parts at most): only those shows can be over.
  const shows = await db.series.find({ kind: 'show', episodeCount: { $gte: SHOW_KEEP / 3 } }, { projection: { _id: 1 } }).toArray()
  for (const show of shows) {
    const cutoff = await db.videos.find({ seriesId: show._id }, { projection: { publishedAt: 1 } }).sort({ publishedAt: -1 }).skip(SHOW_KEEP - 1).limit(1).toArray()
    if (cutoff[0]) pruned += (await db.videos.deleteMany({ seriesId: show._id, publishedAt: { $lt: cutoff[0].publishedAt } })).deletedCount
  }
  stats.pruned = pruned
  const [channels, series, videos] = await Promise.all([db.channels.estimatedDocumentCount(), db.series.estimatedDocumentCount(), db.videos.estimatedDocumentCount()])
  Object.assign(stats, { ttvChannels: channels, ttvSeries: series, ttvVideos: videos })
}

// ---------------------------------------------------------------------------------------------

/** One run of the Tunisian TV cron (see the top of this file). */
export async function runTunisianTvIngest(o: { deadline: number, scope?: IngestScope, now?: Date }): Promise<CronResult> {
  if (tunisianTvOff()) return { status: 'idle', off: true }
  const now = o.now ?? new Date()
  const scope = o.scope ?? 'full'
  const db = await ttv()
  const defs = enabledChannels()
  const stats: Stats = { more: false, api: !!youtubeApiKey() }

  await db.meta.updateOne({ _id: 'state' }, { $setOnInsert: { startedAt: now } }, { upsert: true })
  const docs = await ensureChannels(db, defs, now)
  const ctx = { deadline: o.deadline, now }

  const timed = async (name: string, run: () => Promise<void>) => {
    const started = Date.now()
    await run()
    stats['ms' + name] = Date.now() - started
  }
  // ?scope=full also rereads the feeds read less than 25 minutes ago.
  await timed('Feeds', () => phaseFeeds(db, defs, docs, { ...ctx, all: o.scope === 'full' }, stats))
  // Checking new videos comes before playlists: a tile must never offer what can't play here.
  if (timeLeft(o.deadline) > 4000) await timed('Verify', () => phaseVerify(db, docs, ctx, stats))
  else stats.more = true
  if (scope === 'full' && timeLeft(o.deadline) > 7000) await timed('Playlists', () => phasePlaylists(db, defs, docs, ctx, stats))
  else if (scope === 'full') stats.more = true
  await timed('Derive', () => phaseDerive(db, defs, ctx, stats))
  // Pruning can wait for the next run when this one is out of time.
  if (timeLeft(o.deadline) > 1500) await timed('Prune', () => phasePrune(db, ctx, stats))
  else stats.more = true
  if (youtubeApiKey()) stats.units = await unitsToday(db)

  await db.meta.updateOne({ _id: 'state' }, { $set: { lastRunAt: new Date() } })
  revalidateTag('ttv')
  return stats
}
