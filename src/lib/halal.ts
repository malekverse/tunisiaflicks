// Halal mode (a per-profile setting, Settings > Halal mode): titles with sex scenes, nudity, or a
// romance at the centre with intimate moments are left out of the whole catalogue, and their pages
// say so. The rules are in ./halal-rules (pure); this file gathers the evidence and remembers it.
//
// How it reaches every page: tmdbFetch (lib/tmdb) hands each answer that carries titles (lists,
// search, recommendations, filmographies) to halalFilter, which drops the hidden ones when the
// viewer's profile is in Halal mode. Nothing else in the app has to know about it.
//
// Per title, stored once in `halalRatings` ({_id: 'movie:603'}):
// - facts: what TMDB says (adult, sexual-content keywords, US rating), read on first sight;
// - grades: an AI's parents-guide grades (Groq, the free key Ask already uses), or null when it
//   doesn't know the title. Asked in the background, never while a page waits: until the grades
//   are in, the strict fallback decides (see halal-rules);
// - reports: viewers in Halal mode who flagged it.
//
// Environment: GROQ_API_KEY (without it, facts and the fallback decide alone), HALAL_AI_MODELS
// (comma-separated, tried in order; default gpt-oss-120b then gpt-oss-20b), HALAL_AI_DAILY_CALLS
// (model calls per day for the whole site, default 400; Ask has its own budget).
import { tmdbFetchSafe } from '@/src/lib/tmdb'
import { GROQ_BASE, listModels } from '@/src/lib/ai-search/config'
import { parseFirstJson } from '@/src/lib/ai-search/json'
import {
  hiddenByFacts, isHidden, keyOf, readGrades, titleLists, titleRef, withoutHidden,
  type Facts, type Grades, type Kind, type TitleRef,
} from '@/src/lib/halal-rules'

/** Bumped when the prompt changes: grades from an older prompt are asked again. */
export const HALAL_PROMPT_VERSION = 1
const COLLECTION = 'halalRatings'
const WEEK = 604800
/** New titles whose TMDB facts are read while the page waits, how many at once, and later in the background. */
const FACTS_NOW = 24
const FACTS_AT_ONCE = 6
const FACTS_LATER = 120
/** Titles per model call, and calls in flight per server instance. */
const BATCH = 20
const MAX_IN_FLIGHT = 2
/** A title the AI didn't know is asked again after this long (models learn). */
const UNKNOWN_RETRY_MS = 90 * 86400_000

type Doc = {
  _id: string
  facts?: Facts
  grades?: Grades | null
  v?: number
  reports?: number
  title?: string
  year?: string
  gradedAt?: Date
  updatedAt?: Date
}

// The database is loaded on first use, not with the module: tmdbFetch loads this module for every
// list, and a viewer not in Halal mode (or a test without a database) never needs it.
const database = async () => (await (await import('@/src/lib/mongodb')).default).db()
const collection = async () => (await database()).collection<Doc>(COLLECTION)

// ---- the viewer's setting ----------------------------------------------------------------------

/**
 * Whether this request's profile is in Halal mode. False wherever there is no viewer (cron jobs,
 * cached builders, share cards): those answers are shared, so they are never filtered.
 */
export async function viewerInHalalMode(): Promise<boolean> {
  try {
    const { getHalalMode } = await import('@/src/lib/profiles')
    return await getHalalMode()
  } catch {
    return false
  }
}

// ---- TMDB facts --------------------------------------------------------------------------------

async function usRating(kind: Kind, id: number): Promise<string | null> {
  if (kind === 'movie') {
    const data = await tmdbFetchSafe<{ results?: any[] }>(`movie/${id}/release_dates`, {}, WEEK)
    if (!data) return null
    const us = data.results?.find((entry) => entry.iso_3166_1 === 'US')
    return us?.release_dates?.map((release: any) => release.certification).find(Boolean) ?? ''
  }
  const data = await tmdbFetchSafe<{ results?: any[] }>(`tv/${id}/content_ratings`, {}, WEEK)
  if (!data) return null
  return data.results?.find((entry) => entry.iso_3166_1 === 'US')?.rating ?? ''
}

async function keywordIds(kind: Kind, id: number): Promise<number[] | null> {
  const data = await tmdbFetchSafe<{ keywords?: any[], results?: any[] }>(`${kind}/${id}/keywords`, {}, WEEK)
  if (!data) return null
  const list = kind === 'movie' ? data.keywords : data.results
  return (Array.isArray(list) ? list : []).map((keyword) => Number(keyword?.id)).filter(Number.isInteger)
}

/** `work` over `items`, at most `limit` at a time (TMDB answers 429 to a burst). */
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

/** TMDB's facts for a title, or undefined when TMDB couldn't answer (then they're asked again later). */
async function factsOf(ref: TitleRef): Promise<Facts | undefined> {
  const [keywords, cert] = await Promise.all([keywordIds(ref.kind, ref.id), usRating(ref.kind, ref.id)])
  if (keywords === null) return undefined
  return { adult: ref.adult === true, genres: ref.genres ?? [], keywords, cert }
}

// ---- the AI's grades ---------------------------------------------------------------------------

export const HALAL_SYSTEM_PROMPT = `You rate films and TV series the way a parents guide does (like IMDb's Parents Guide), from your knowledge of each specific title.
For each title give:
- sex: the strongest sexual content anywhere in it (for a series: in any episode). "none"; "mild" = kissing in bed, sexual jokes or references, implied sex off-screen; "moderate" = a sex scene without explicit nudity, or sex as a recurring theme; "severe" = explicit or graphic sex scenes.
- nudity: "none"; "mild" = brief partial nudity (bare back, cleavage-focused shots; a man shirtless is NOT nudity); "moderate" = bare breasts or buttocks; "severe" = full or frontal nudity.
- romance: "none"; "subplot" = a love story on the side; "central" = the story is mainly a romance with kissing/intimacy.
- known: false if you do not know this title well enough to rate it (do not guess).
Answer with JSON only: {"items":[{"id":"<id>","sex":"...","nudity":"...","romance":"...","known":true}]}, one item per input title, same ids.`

function models(): string[] {
  const custom = (process.env.HALAL_AI_MODELS ?? '').split(',').map((id) => id.trim()).filter(Boolean)
  return custom.length ? custom : ['openai/gpt-oss-120b', 'openai/gpt-oss-20b']
}

function dailyCalls(): number {
  const value = Number(process.env.HALAL_AI_DAILY_CALLS)
  return Number.isInteger(value) && value > 0 ? value : 400
}

/** Models resting after a 429, until when (per server instance). */
const resting = new Map<string, number>()
let inFlight = 0
/** Titles being graded right now on this instance (so two rows don't ask twice). */
const grading = new Set<string>()

/** One model call for the whole day's budget, or false when it's spent. */
async function takeCall(): Promise<boolean> {
  try {
    const day = new Date().toISOString().slice(0, 10)
    const state = (await database()).collection<{ _id: string, calls: number, expiresAt: Date }>('halalState')
    const result = await state.findOneAndUpdate(
      { _id: `calls:${day}` },
      { $inc: { calls: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + 3 * 86400_000) } },
      { upsert: true, returnDocument: 'after' },
    )
    return (result.value?.calls ?? 1) <= dailyCalls()
  } catch {
    return false
  }
}

/** Asks a model to grade these titles. Never throws: titles it couldn't grade are simply missing. */
async function askModel(refs: TitleRef[], timeoutMs: number): Promise<Map<string, Grades | null>> {
  const graded = new Map<string, Grades | null>()
  const key = process.env.GROQ_API_KEY
  if (!key || !refs.length || !(await takeCall())) return graded
  const available = new Set((await listModels()).map((model) => model.id))
  const now = Date.now()
  for (const model of models()) {
    if (available.size && !available.has(model)) continue
    if ((resting.get(model) ?? 0) > now) continue
    const body: Record<string, unknown> = {
      model,
      temperature: 0,
      seed: 7,
      max_completion_tokens: 3500,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: HALAL_SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(refs.map((ref) => ({ id: keyOf(ref), title: ref.title, year: ref.year || undefined, type: ref.kind === 'tv' ? 'series' : 'film' }))) },
      ],
    }
    if (/gpt-oss/i.test(model)) {
      body.reasoning_effort = 'medium'
      body.include_reasoning = false
    }
    try {
      const response = await fetch(`${GROQ_BASE}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (response.status === 429) {
        const retry = Number(response.headers.get('retry-after'))
        resting.set(model, Date.now() + (Number.isFinite(retry) && retry > 0 ? retry * 1000 : 60_000))
        continue
      }
      if (!response.ok) continue
      const data = await response.json()
      const answer = parseFirstJson(String(data?.choices?.[0]?.message?.content ?? '')) as any
      const wanted = new Set(refs.map(keyOf))
      for (const item of Array.isArray(answer?.items) ? answer.items : []) {
        const id = String(item?.id ?? '')
        const grades = readGrades(item)
        if (wanted.has(id) && grades !== undefined) graded.set(id, grades)
      }
      if (graded.size) return graded
    } catch {
      // Timeout, network or bad JSON: try the next model.
    }
  }
  return graded
}

/** Grades titles that have none yet (one model call, at most BATCH titles) and stores them. */
export async function gradeTitles(refs: TitleRef[], { timeoutMs = 30_000 }: { timeoutMs?: number } = {}): Promise<number> {
  const todo = refs.filter((ref) => !grading.has(keyOf(ref))).slice(0, BATCH)
  if (!todo.length || inFlight >= MAX_IN_FLIGHT || !process.env.GROQ_API_KEY) return 0
  inFlight++
  todo.forEach((ref) => grading.add(keyOf(ref)))
  try {
    const graded = await askModel(todo, timeoutMs)
    if (!graded.size) return 0
    const at = new Date()
    const col = await collection()
    await col.bulkWrite(todo.filter((ref) => graded.has(keyOf(ref))).map((ref) => ({
      updateOne: {
        filter: { _id: keyOf(ref) },
        update: { $set: { grades: graded.get(keyOf(ref))!, v: HALAL_PROMPT_VERSION, gradedAt: at, title: ref.title, year: ref.year, updatedAt: at } },
        upsert: true,
      },
    })), { ordered: false })
    return graded.size
  } catch (error) {
    console.error('Halal mode: grading failed', error)
    return 0
  } finally {
    todo.forEach((ref) => grading.delete(keyOf(ref)))
    inFlight--
  }
}

/** Work that may finish after the answer is sent (Vercel's waitUntil when there is one). */
function inBackground(work: Promise<unknown>) {
  const done = work.catch((error) => console.error('Halal mode: background work failed', error))
  try {
    const context = (globalThis as any)[Symbol.for('@vercel/request-context')]?.get?.()
    context?.waitUntil?.(done)
  } catch { /* not on Vercel: the server keeps running anyway */ }
}

const needsGrades = (doc: Doc | undefined) => {
  if (!doc || doc.grades === undefined || (doc.v ?? 0) < HALAL_PROMPT_VERSION) return true
  return doc.grades === null && (!doc.gradedAt || Date.now() - new Date(doc.gradedAt).getTime() > UNKNOWN_RETRY_MS)
}

// ---- deciding ----------------------------------------------------------------------------------

/**
 * Which of these titles Halal mode hides (as 'movie:603' keys). Reads what is stored, fills in
 * TMDB's facts for new titles (cached a week), and leaves the AI's grading to the background.
 */
export async function hiddenTitles(input: TitleRef[], { grade = true }: { grade?: boolean } = {}): Promise<Set<string>> {
  const refs = Array.from(new Map(input.map((ref) => [keyOf(ref), ref])).values())
  const hidden = new Set<string>()
  if (!refs.length) return hidden

  let docs = new Map<string, Doc>()
  try {
    const col = await collection()
    docs = new Map((await col.find({ _id: { $in: refs.map(keyOf) } }).toArray()).map((doc) => [doc._id, doc]))
  } catch (error) {
    console.error('Halal mode: ratings unavailable', error)
  }

  // New titles: TMDB's facts (they're needed to decide), stored for next time. The first ones
  // while the page waits, a few at a time; the rest of a long list (a filmography) in the
  // background, decided meanwhile from the list item alone.
  const fresh = refs.filter((ref) => !docs.get(keyOf(ref))?.facts)
  const storeFacts = (ref: TitleRef, found: Facts | undefined) => {
    if (!found) return null
    const key = keyOf(ref)
    docs.set(key, { ...(docs.get(key) ?? { _id: key }), facts: found })
    return collection().then((col) => col.updateOne(
      { _id: key },
      { $set: { facts: found, title: ref.title, year: ref.year, updatedAt: new Date() } },
      { upsert: true },
    ))
  }
  const now = fresh.slice(0, FACTS_NOW)
  const found = await pooled(now, FACTS_AT_ONCE, factsOf)
  const factWrites: Promise<unknown>[] = now.map((ref, index) => storeFacts(ref, found[index])).filter((write): write is Promise<any> => write !== null)
  const later = fresh.slice(FACTS_NOW, FACTS_NOW + FACTS_LATER)
  if (later.length) factWrites.push(pooled(later, 2, async (ref) => storeFacts(ref, await factsOf(ref))))

  for (const ref of refs) {
    const doc = docs.get(keyOf(ref))
    if (isHidden({ reports: doc?.reports, facts: doc?.facts, grades: doc?.grades, item: ref })) hidden.add(keyOf(ref))
  }

  // Grades for what isn't settled (a report or TMDB's facts settle it for good), asked in the
  // background, the most popular titles first (lists come sorted that way).
  const settled = (doc: Doc | undefined) => (doc?.reports ?? 0) > 0 || (doc?.facts !== undefined && hiddenByFacts(doc.facts))
  const ungraded = grade ? refs.filter((ref) => !settled(docs.get(keyOf(ref))) && needsGrades(docs.get(keyOf(ref)))) : []
  inBackground(Promise.all([...factWrites, ungraded.length ? gradeTitles(ungraded) : null]))
  return hidden
}

/** Whether Halal mode hides one title (a detail page; the TMDB detail object or a list item). */
export async function isHalalHidden(item: any, kind: Kind): Promise<boolean> {
  const ref = titleRef({ ...item, media_type: kind }, kind)
  if (!ref) return false
  return (await hiddenTitles([ref])).has(keyOf(ref))
}

/**
 * tmdbFetch's hook: the answer without the titles Halal mode hides, when the viewer's profile is
 * in Halal mode (otherwise the answer itself, untouched).
 */
export async function halalFilter<T>(path: string, json: T): Promise<T> {
  const lists = titleLists(path, json)
  if (!lists.length || !(await viewerInHalalMode())) return json
  const refs = lists.flatMap(({ list, kind }) => list.map((item) => titleRef(item, kind)).filter((ref): ref is TitleRef => ref !== null))
  if (!refs.length) return json
  return withoutHidden(path, json, await hiddenTitles(refs))
}

/** A viewer in Halal mode flags a title: from now on it's hidden for everyone in Halal mode. */
export async function reportTitle(ref: { kind: Kind, id: number }, profileId: string): Promise<void> {
  const col = await collection()
  await col.updateOne(
    { _id: keyOf(ref), reporters: { $ne: profileId } } as any,
    { $inc: { reports: 1 }, $addToSet: { reporters: profileId }, $set: { updatedAt: new Date() } } as any,
    { upsert: false },
  ).then(async (result) => {
    // Never seen before: create it with this report.
    if (result.matchedCount === 0) {
      await col.updateOne(
        { _id: keyOf(ref) },
        { $setOnInsert: { reports: 1, reporters: [profileId], updatedAt: new Date() } } as any,
        { upsert: true },
      )
    }
  })
}

// ---- the warm-up job ---------------------------------------------------------------------------

/** What most viewers see first: grading these ahead means they're decided by the AI, not the fallback. */
const WARM_LISTS = [
  'trending/movie/week', 'trending/tv/week', 'movie/popular', 'tv/popular',
  'movie/top_rated', 'tv/top_rated', 'movie/now_playing', 'tv/on_the_air',
]

/**
 * The `halal` cron job (/api/cron/halal): grades the titles of the main lists that have no grades
 * yet, one model call (20 titles) at a time until the time budget or the day's calls run out.
 */
export async function runHalalCron({ deadline, pages = 3 }: { deadline: number, pages?: number }) {
  if (!process.env.GROQ_API_KEY) return { status: 'idle' as const, reason: 'no GROQ_API_KEY' }
  const answers = await Promise.all(WARM_LISTS.flatMap((path) =>
    Array.from({ length: pages }, (_, page) => tmdbFetchSafe<any>(path, { page: page + 1 }, 21600, { shared: true }).then((json) => ({ path, json })))))
  const refs = Array.from(new Map(answers.flatMap(({ path, json }) =>
    titleLists(path, json).flatMap(({ list, kind }) => list.map((item) => titleRef(item, kind))))
    .filter((ref): ref is TitleRef => ref !== null)
    .map((ref) => [keyOf(ref), ref])).values())

  const col = await collection()
  const docs = new Map((await col.find({ _id: { $in: refs.map(keyOf) } }).toArray()).map((doc) => [doc._id, doc]))
  const todo = refs.filter((ref) => {
    const doc = docs.get(keyOf(ref))
    return !((doc?.reports ?? 0) > 0 || (doc?.facts !== undefined && hiddenByFacts(doc.facts))) && needsGrades(doc)
  })

  let graded = 0
  while (todo.length && deadline - Date.now() > 12_000) {
    const done = await gradeTitles(todo.splice(0, BATCH), { timeoutMs: Math.min(30_000, deadline - Date.now() - 2_000) })
    if (!done) break   // the day's calls are spent, or every model is resting: next run
    graded += done
  }
  return { status: todo.length ? 'more' as const : 'done' as const, more: todo.length > 0 && graded > 0, graded, left: todo.length, seen: refs.length }
}
