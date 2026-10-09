// What the badges need to know about a title, from TMDB, kept 30 days in titleFacts. One run
// fetches at most 40 titles, six at a time, within 3 seconds; whatever is left waits for the next
// run (the badges document says so with factsIncomplete).
import 'server-only'
import { TmdbError, tmdbFetch } from '@/src/lib/tmdb'
import { badgesDb } from './db'
import { factsFromTmdb, type TitleFacts, type TitleKey } from './metrics'

export const FACTS_TTL_DAYS = 30
export const MAX_FETCHES = 40
export const FACTS_BUDGET_MS = 3000
export const FACTS_CONCURRENCY = 6

const TITLE_RE = /^(movie|tv):(\d{1,9})$/

async function fetchFacts(title: TitleKey): Promise<TitleFacts | null> {
  const match = TITLE_RE.exec(title)
  if (!match) return { g: [], l: null, y: null, tn: false, missing: true }
  const [, kind, id] = match as unknown as [string, 'movie' | 'tv', string]
  try {
    return factsFromTmdb(kind, await tmdbFetch(`/${kind}/${id}`, {}, 86400))
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) return { g: [], l: null, y: null, tn: false, missing: true }
    return null
  }
}

/**
 * The facts of `titles`: the stored ones, plus up to `maxFetches` fetched now within `budgetMs`.
 * `incomplete` when some title is still unknown (out of budget, or TMDB failed).
 */
export async function loadFacts(titles: TitleKey[], opts: { budgetMs?: number; maxFetches?: number } = {}): Promise<{ facts: Map<string, TitleFacts>; incomplete: boolean }> {
  const facts = new Map<string, TitleFacts>()
  const unique = [...new Set(titles)].filter((title) => TITLE_RE.test(title))
  if (unique.length === 0) return { facts, incomplete: false }
  const { facts: collection } = await badgesDb()
  for (const doc of await collection.find({ _id: { $in: unique } }).toArray()) {
    const { _id, expireAt: _expireAt, ...rest } = doc
    void _expireAt
    facts.set(_id, rest)
  }
  const missing = unique.filter((title) => !facts.has(title))
  if (missing.length === 0) return { facts, incomplete: false }

  const deadline = Date.now() + (opts.budgetMs ?? FACTS_BUDGET_MS)
  const queue = missing.slice(0, opts.maxFetches ?? MAX_FETCHES)
  const fresh: { _id: string; facts: TitleFacts }[] = []
  const worker = async () => {
    for (let title = queue.shift(); title; title = queue.shift()) {
      const left = deadline - Date.now()
      if (left <= 50) return
      let timer: ReturnType<typeof setTimeout> | undefined
      const found = await Promise.race([
        fetchFacts(title),
        new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), left) }),
      ])
      clearTimeout(timer)
      if (found) {
        facts.set(title, found)
        fresh.push({ _id: title, facts: found })
      }
    }
  }
  await Promise.all(Array.from({ length: FACTS_CONCURRENCY }, worker))
  if (fresh.length) {
    const expireAt = new Date(Date.now() + FACTS_TTL_DAYS * 86_400_000)
    await collection.bulkWrite(
      fresh.map(({ _id, facts: value }) => ({ replaceOne: { filter: { _id }, replacement: { ...value, expireAt }, upsert: true } })),
      { ordered: false },
    ).catch((error) => console.error('badges: saving title facts failed', error))
  }
  return { facts, incomplete: unique.some((title) => !facts.has(title)) }
}
