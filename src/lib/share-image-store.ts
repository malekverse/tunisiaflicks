// Share images that never keep a crawler waiting.
//
// When a link is pasted into WhatsApp, Instagram, Messenger or Facebook, Meta's crawler fetches
// the page's og:image and gives up after a few seconds, then remembers that preview (without a
// picture) for that link. Drawing a card from scratch takes 3 to 8 seconds (pictures to fetch,
// Satori and resvg to run), and every deployment empties Vercel's edge cache, so with frequent
// deployments most shares used to hit a cold card: the link showed no picture.
//
// So every card, once drawn, is kept in the database (`shareImages`, {_id: the card's key}) and
// served from there instantly, across deployments:
// - a kept card is always answered at once; past its freshness it's redrawn in the background
//   (Vercel's waitUntil), and the next share gets the new one;
// - a card never drawn before is drawn while the crawler waits, but the whole answer takes at most
//   ANSWER_BUDGET_MS: past that the crawler gets the TunisiaFlicks brand card (public/share-card.jpg,
//   read from disk) and the real one is finished and kept in the background;
// - the section cards (app/og/[page]) are built with each deployment and served as static files,
//   so the links shared most never reach this code at all;
// - personal cards (a list, a movie night, a page, a year) are kept briefly and never served past
//   PERSONAL_MAX_AGE_MS, so a list turned private stops showing within the hour.
// A card expires 45 days after it was last drawn (TTL on expiresAt; a card in use is redrawn far
// sooner), and at most maxKept() are kept. The brand card standing in for something that doesn't
// exist (og.tsx marks it, FALLBACK_HEADER) is never kept, so made-up links can't fill the database.
import { readFile } from 'fs/promises'
import path from 'path'
import { Binary } from 'mongodb'
import { SITE_URL } from '@/src/lib/seo'

/** Every share card's size (Open Graph's 1.91:1). Here, not in lib/og, so a route can say its size
 *  without loading the drawing code (which only loads when a card has to be drawn). */
export const SHARE_CARD_SIZE = { width: 1200, height: 630 }

/**
 * Marks the brand card standing in for a card that couldn't be drawn (no such title, a list that
 * isn't public, a drawing error; set by lib/og): it's served but never kept, so links to things
 * that don't exist can't fill the database.
 */
export const FALLBACK_HEADER = 'X-Share-Card'

const COLLECTION = 'shareImages'
/**
 * The longest a crawler waits for an answer. Meta keeps whatever picture it gets for a link, the
 * brand card included, so the real card is worth a few seconds: most are kept (the share-cards job
 * draws the trending titles' ahead), and a fresh server needs a moment to reach the database.
 */
export const ANSWER_BUDGET_MS = 4000
/** How long reading a kept card may take (a fresh server's first connection to the database). */
const READ_BUDGET_MS = 3500
/** A card being drawn gets at least this long, even when reading took most of the budget. */
const MIN_DRAW_MS = 500
const CATALOGUE_FRESH_MS = 12 * 3600_000
const PERSONAL_FRESH_MS = 5 * 60_000
const PERSONAL_MAX_AGE_MS = 60 * 60_000
const KEEP_MS = 45 * 86400_000
/** At most this many kept cards (~100 KB each; the database is on a free tier). SHARE_IMAGES_MAX overrides. */
function maxKept(): number {
  const value = Number(process.env.SHARE_IMAGES_MAX)
  return Number.isInteger(value) && value > 0 ? value : 1500
}
/** Larger than any card (they're ~100 KB JPEGs): something is wrong, don't keep it. */
const MAX_BYTES = 2_000_000
/** The static brand card, served when a card isn't ready in time. */
export const BRAND_CARD_PATH = '/share-card.jpg'

type Doc = { _id: string, data: Binary, type: string, renderedAt: Date, expiresAt: Date }
type Card = { data: Uint8Array, type: string, fallback?: boolean }

let indexed = false
async function collection() {
  // Loaded on first use: the routes that import this module stay light until a card is asked for.
  const db = (await (await import('@/src/lib/mongodb')).default).db()
  const col = db.collection<Doc>(COLLECTION)
  if (!indexed) {
    indexed = true
    col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).catch(() => { indexed = false })
  }
  return col
}

/** Work that may finish after the answer is sent (Vercel's waitUntil when there is one). */
function inBackground(work: Promise<unknown>) {
  const done = work.catch((error) => console.error('Share cards: background drawing failed', error))
  try {
    const context = (globalThis as any)[Symbol.for('@vercel/request-context')]?.get?.()
    context?.waitUntil?.(done)
  } catch { /* not on Vercel: the server keeps running anyway */ }
}

/** The promise's value, or null once `ms` have passed (the promise keeps running). */
function within<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms)
    promise.then((value) => { clearTimeout(timer); resolve(value) }, () => { clearTimeout(timer); resolve(null) })
  })
}

/** Cards being drawn on this server instance, so two crawlers asking at once draw it once. */
const drawing = new Map<string, Promise<Card>>()

/** Draws a card and keeps it (keeping is best effort: the card is returned either way). */
function drawAndKeep(key: string, draw: () => Promise<Response>): Promise<Card> {
  let pending = drawing.get(key)
  if (pending) return pending
  pending = (async () => {
    const response = await draw()
    if (!response.ok) throw new Error(`Share card ${key}: drawing answered ${response.status}`)
    const data = new Uint8Array(await response.arrayBuffer())
    const card = { data, type: response.headers.get('content-type') ?? 'image/jpeg', fallback: response.headers.has(FALLBACK_HEADER) }
    if (!card.fallback && data.byteLength > 0 && data.byteLength <= MAX_BYTES) {
      const now = new Date()
      await collection()
        .then(async (col) => {
          // A redraw always replaces; a new card only while there's room.
          const update = { $set: { data: new Binary(data), type: card.type, renderedAt: now, expiresAt: new Date(now.getTime() + KEEP_MS) } }
          const replaced = await col.updateOne({ _id: key }, update)
          if (replaced.matchedCount === 0 && (await col.estimatedDocumentCount()) < maxKept()) await col.updateOne({ _id: key }, update, { upsert: true })
        })
        .catch((error) => console.error(`Share cards: couldn't keep ${key}`, error))
    }
    return card
  })()
  drawing.set(key, pending)
  const forget = () => drawing.delete(key)
  pending.then(forget, forget)
  return pending
}

/**
 * An image response with its exact size (Content-Length). Without it the answer is streamed in
 * chunks, and Meta's image fetcher (WhatsApp, Instagram, Messenger, Facebook) skips an image whose
 * size it can't check: the preview then shows no picture even when the card is there and fast.
 */
function imageResponse(data: Uint8Array, type: string, cacheControl: string): Response {
  return new Response(data, { headers: { 'Content-Type': type, 'Content-Length': String(data.byteLength), 'Cache-Control': cacheControl } })
}

function answer(card: Card, personal: boolean): Response {
  // Vercel's edge keeps it (s-maxage); browsers and crawlers for an hour. The brand card standing in
  // for something missing only briefly (it may exist soon: a list made public, a new title).
  const cache = card.fallback
    ? 'public, max-age=600, s-maxage=600'
    : personal
    ? 'public, max-age=300, s-maxage=300'
    : 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
  return imageResponse(card.data, card.type, cache)
}

let brandBytes: Promise<Uint8Array | null> | null = null

/** The brand card, for a crawler that can't wait: never cached, so the next ask gets the real card. */
async function brandCard(): Promise<Response> {
  // From disk (next.config.js ships it with the functions); over the network if it isn't there.
  brandBytes ??= readFile(path.join(process.cwd(), 'public', BRAND_CARD_PATH.slice(1))).then((data) => new Uint8Array(data), () => null)
  const bytes = await brandBytes
  if (bytes) return imageResponse(bytes, 'image/jpeg', 'no-store')
  const url = `${SITE_URL}${BRAND_CARD_PATH}`
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(2000) })
    if (response.ok) {
      return imageResponse(new Uint8Array(await response.arrayBuffer()), response.headers.get('content-type') ?? 'image/jpeg', 'no-store')
    }
  } catch { /* the redirect below */ }
  return new Response(null, { status: 307, headers: { Location: url, 'Cache-Control': 'no-store' } })
}

/** Which of these keys have a card kept (for the job that draws trending titles' cards ahead). */
export async function keptKeys(keys: string[]): Promise<Set<string>> {
  if (!keys.length) return new Set()
  const col = await collection()
  return new Set((await col.find({ _id: { $in: keys } }, { projection: { _id: 1 } }).toArray()).map((doc) => doc._id))
}

/**
 * The share image `key` ('movie/603', 'og/home'…): kept if there is one, else drawn by `draw`, the
 * whole answer within `budgetMs` (ANSWER_BUDGET_MS), else the brand card while it's drawn and kept
 * in the background. `personal`: the card shows someone's own content (see the top of this file).
 * Never throws.
 */
export async function keptShareImage(key: string, draw: () => Promise<Response>, { personal = false, budgetMs = ANSWER_BUDGET_MS }: { personal?: boolean, budgetMs?: number } = {}): Promise<Response> {
  const started = Date.now()
  const fresh = personal ? PERSONAL_FRESH_MS : CATALOGUE_FRESH_MS
  const read = collection().then((col) => col.findOne({ _id: key }))
  const doc = await within(read, Math.min(READ_BUDGET_MS, budgetMs))
  if (doc?.data) {
    const age = Date.now() - new Date(doc.renderedAt).getTime()
    if (!personal || age <= PERSONAL_MAX_AGE_MS) {
      if (age > fresh) inBackground(drawAndKeep(key, draw))
      return answer({ data: new Uint8Array(doc.data.buffer), type: doc.type }, personal)
    }
  }
  if (doc === null && Date.now() - started >= Math.min(READ_BUDGET_MS, budgetMs)) {
    // The database didn't answer in time: the brand card now; in the background, the card is drawn
    // only if it turns out there's none kept.
    inBackground(read.then((late) => (late?.data ? null : drawAndKeep(key, draw))))
    return brandCard()
  }

  const job = drawAndKeep(key, draw)
  const card = await within(job, Math.max(MIN_DRAW_MS, budgetMs - (Date.now() - started)))
  if (card) return answer(card, personal)
  inBackground(job)
  return brandCard()
}
