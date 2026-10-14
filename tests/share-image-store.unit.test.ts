// Unit tests for lib/share-image-store: a card is kept once drawn and served from the database
// after that; a card that takes too long gives way to the brand card and is kept in the background;
// the brand card standing in for something missing is never kept; a personal card isn't served
// past its age limit. Runs only against a local MongoDB (MONGODB_URI on 127.0.0.1 or localhost),
// in a database of its own:
//   MONGODB_URI=mongodb://127.0.0.1:27017/x npm run test:unit
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const LOCAL = (() => {
  if (!process.env.MONGODB_URI) return false
  try {
    const url = new URL(process.env.MONGODB_URI)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) return false
    url.pathname = `/tf_unit_share_${process.pid}`
    process.env.MONGODB_URI = url.toString()
    return true
  } catch {
    return false
  }
})()

const card = (text: string, headers: Record<string, string> = {}) =>
  new Response(new TextEncoder().encode(text), { headers: { 'Content-Type': 'image/jpeg', ...headers } })
const body = async (response: Response) => new TextDecoder().decode(await response.arrayBuffer())
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
/** Waits (up to 3 s) for background work to show: a busy test run makes it slower. */
async function eventually(check: () => Promise<boolean>) {
  for (let waited = 0; waited < 3000; waited += 100) {
    if (await check()) return true
    await sleep(100)
  }
  return false
}

describe('share image store', { skip: !LOCAL && 'needs MONGODB_URI on a local MongoDB' }, () => {
  let store: typeof import('@/src/lib/share-image-store')
  let db: any
  let realFetch: typeof fetch

  before(async () => {
    store = await import('@/src/lib/share-image-store')
    db = (await (await import('@/src/lib/mongodb')).default).db()
    // The brand card is read from public/; if it ever went online for it, it'd get this instead.
    realFetch = globalThis.fetch
    globalThis.fetch = (async (url: any) => (String(url).endsWith(store.BRAND_CARD_PATH) ? card('brand from the network') : realFetch(url))) as typeof fetch
  })

  after(async () => {
    globalThis.fetch = realFetch
    await db.dropDatabase()
    await (await (await import('@/src/lib/mongodb')).default).close()
  })

  test('drawn once, then served from the database', async () => {
    let draws = 0
    const draw = async () => { draws++; return card('movie 603') }
    const first = await store.keptShareImage('movie/603', draw, { budgetMs: 2000 })
    assert.equal(await body(first), 'movie 603')
    assert.match(first.headers.get('cache-control') ?? '', /s-maxage=86400/)
    const second = await store.keptShareImage('movie/603', draw, { budgetMs: 2000 })
    assert.equal(await body(second), 'movie 603')
    assert.equal(draws, 1, 'the second ask is answered from the database')
    assert.equal(await db.collection('shareImages').countDocuments({ _id: 'movie/603' }), 1)
  })

  test('too slow: the brand card now, the real card kept for the next ask', async () => {
    // Slower than the budget, and than the least a drawing is given (0.4 s).
    const slow = async () => { await sleep(900); return card('tv 1399') }
    const first = await store.keptShareImage('tv/1399', slow, { budgetMs: 50 })
    const brand = readFileSync('public/share-card.jpg')
    assert.deepEqual(Buffer.from(await first.arrayBuffer()), brand, 'the brand card, from disk')
    assert.equal(first.headers.get('cache-control'), 'no-store', 'the stand-in is never cached')
    assert.ok(await eventually(async () => (await db.collection('shareImages').countDocuments({ _id: 'tv/1399' })) === 1), 'kept in the background')
    const next = await store.keptShareImage('tv/1399', async () => card('not drawn again'), { budgetMs: 2000 })
    assert.equal(await body(next), 'tv 1399')
  })

  test('the brand card standing in for something missing is served, never kept', async () => {
    const missing = async () => card('fallback', { [store.FALLBACK_HEADER]: 'fallback' })
    const first = await store.keptShareImage('movie/999999999', missing, { budgetMs: 2000 })
    assert.equal(await body(first), 'fallback')
    assert.match(first.headers.get('cache-control') ?? '', /max-age=600/)
    assert.equal(await db.collection('shareImages').countDocuments({ _id: 'movie/999999999' }), 0)
  })

  test('a personal card past its age limit is drawn again, not served', async () => {
    await db.collection('shareImages').insertOne({
      _id: 'lists/old', data: new (await import('mongodb')).Binary(new TextEncoder().encode('old list')), type: 'image/jpeg',
      renderedAt: new Date(Date.now() - 2 * 3600_000), expiresAt: new Date(Date.now() + 86400_000),
    })
    const response = await store.keptShareImage('lists/old', async () => card('new list'), { personal: true, budgetMs: 2000 })
    assert.equal(await body(response), 'new list')
    assert.match(response.headers.get('cache-control') ?? '', /max-age=300/)
  })

  test('a stale catalogue card is served at once and redrawn in the background', async () => {
    await db.collection('shareImages').insertOne({
      _id: 'og/home', data: new (await import('mongodb')).Binary(new TextEncoder().encode('yesterday')), type: 'image/jpeg',
      renderedAt: new Date(Date.now() - 13 * 3600_000), expiresAt: new Date(Date.now() + 86400_000),
    })
    const response = await store.keptShareImage('og/home', async () => card('today'), { budgetMs: 2000 })
    assert.equal(await body(response), 'yesterday', 'no waiting for the redraw')
    const redrawn = async () => new TextDecoder().decode((await db.collection('shareImages').findOne({ _id: 'og/home' })).data.buffer) === 'today'
    assert.ok(await eventually(redrawn), 'redrawn in the background')
  })
})

describe('share-cards job', () => {
  test('titleKeys: movie and TV keys from the lists, in order, no repeats, no people', async () => {
    const { titleKeys } = await import('@/src/lib/share-cards-cron')
    assert.deepEqual(titleKeys([
      { path: 'trending/movie/day', json: { results: [{ id: 603 }, { id: 550 }] } },
      { path: 'trending/tv/week', json: { results: [{ id: 1399 }, { id: 603, media_type: 'movie' }] } },
      { path: 'tv/popular', json: { results: [{ id: 66732 }, { id: 287, media_type: 'person' }, { id: 'x' }] } },
      { path: 'movie/popular', json: null },
    ]), ['movie/603', 'movie/550', 'tv/1399', 'tv/66732'])
  })
})
