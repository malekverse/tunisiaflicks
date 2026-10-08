// Scheduled jobs, free: Vercel's single cron, cron-job.org and a GitHub Actions fallback all call
// the same GET routes (/api/cron/<job>) with a Bearer secret. This module is the one place that
// checks the secret, picks a time budget, keeps two runs of a job from overlapping, and answers.
//
// Every cron route is the same three lines (see docs/SCHEDULER.md):
//
//   export const dynamic = 'force-dynamic'
//   export const maxDuration = 60
//   export const GET = (r: Request) => runCron(r, '<name>', (ctx) => myJob(ctx))
//
// The job gets `{ deadline, source }`: it stops starting new work once Date.now() nears the
// deadline and answers `more: true` when work is left, so the caller (GitHub loops on it, the
// others simply come back later) can call again. Nothing here imports the database at load time,
// so the unit tests can check the secret and the deadlines without one.
import { createHash, randomUUID, timingSafeEqual } from 'crypto'

/** Extra secrets (one per external scheduler) must be at least this long; shorter ones are ignored. */
export const MIN_EXTRA_SECRET_LENGTH = 32
/** How long a run holds its job's lease: past maxDuration (60s), so a killed run frees it soon after. */
export const CRON_LEASE_MS = 70_000
/** Time budgets. cron-job.org gives up on a request after 30s, so its calls (and unknown ones) get 22s. */
export const LONG_BUDGET_MS = 45_000
export const SHORT_BUDGET_MS = 22_000

/** Days a run stays in the cronRuns log. */
const RUN_LOG_DAYS = 14

export type CronStatus = 'done' | 'more' | 'busy' | 'idle' | 'quota' | 'error'
export type CronContext = { deadline: number; source: string }
export type CronResult = Record<string, unknown> & { more?: boolean; status?: CronStatus }

const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest()

/** CRON_SECRET (Vercel's own cron) plus each long-enough CRON_SECRETS_EXTRA entry. */
function configuredSecrets(): string[] {
  const secrets: string[] = []
  const main = process.env.CRON_SECRET?.trim()
  if (main) secrets.push(main)
  for (const entry of (process.env.CRON_SECRETS_EXTRA ?? '').split(',')) {
    const secret = entry.trim()
    if (secret.length >= MIN_EXTRA_SECRET_LENGTH) secrets.push(secret)
  }
  return secrets
}

/**
 * `Authorization: Bearer <secret>` where the secret is CRON_SECRET or one of CRON_SECRETS_EXTRA.
 * Compared as SHA-256 digests with timingSafeEqual (equal lengths, constant time), against every
 * configured secret. With no secret configured nothing is ever authorized.
 */
export function isCronAuthorized(r: Request): boolean {
  const header = r.headers.get('authorization') ?? ''
  if (!header.startsWith('Bearer ')) return false
  const token = header.slice('Bearer '.length)
  if (!token) return false
  const given = sha256(token)
  let ok = false
  for (const secret of configuredSecrets()) {
    // No early exit: every configured secret is compared.
    if (timingSafeEqual(given, sha256(secret))) ok = true
  }
  return ok
}

/**
 * When a run must stop starting new work. GitHub Actions and Vercel's cron wait for the answer
 * (maxDuration 60s): 45s. cron-job.org aborts at 30s, and anything unknown gets the same 22s.
 */
export function cronDeadline(source: string): number {
  const long = source === 'github' || source === 'vercel' || /vercel-cron/i.test(source)
  return Date.now() + (long ? LONG_BUDGET_MS : SHORT_BUDGET_MS)
}

/** Who is calling: the X-Cron-Source header, or Vercel's cron by its user agent. */
export function cronSource(r: Request): string {
  const declared = (r.headers.get('x-cron-source') ?? '').trim().toLowerCase()
  if (/^[a-z0-9-]{1,24}$/.test(declared)) return declared
  return /vercel-cron/i.test(r.headers.get('user-agent') ?? '') ? 'vercel' : 'unknown'
}

async function database() {
  const clientPromise = (await import('@/src/lib/mongodb')).default
  return (await clientPromise).db()
}

type LeaseDoc = { _id: string; lease_until: Date; owner?: string | null; started_at?: Date; finished_at?: Date }

const isDuplicateKey = (error: unknown) => (error as { code?: number })?.code === 11000

/**
 * Runs `fn` while holding the lease 'cron:<key>' in `jobs` for `ms`. The claim is one upsert on
 * an expired (or missing) lease: when another run holds it, the upsert collides with the existing
 * document (duplicate key 11000) and the answer is `{ busy: true }`. Only the owner releases it.
 */
export async function withLease<T>(key: string, ms: number, fn: () => Promise<T>): Promise<{ busy: true } | { busy: false; value: T }> {
  const jobs = (await database()).collection<LeaseDoc>('jobs')
  const _id = `cron:${key}`
  const owner = randomUUID()
  const now = new Date()
  try {
    await jobs.updateOne(
      { _id, $or: [{ lease_until: { $lt: now } }, { lease_until: { $exists: false } }] },
      { $set: { lease_until: new Date(now.getTime() + ms), owner, started_at: now } },
      { upsert: true },
    )
  } catch (error) {
    if (isDuplicateKey(error)) return { busy: true }
    throw error
  }
  try {
    return { busy: false, value: await fn() }
  } finally {
    await jobs.updateOne({ _id, owner }, { $set: { lease_until: new Date(), owner: null, finished_at: new Date() } })
      .catch((error) => console.error(`cron ${key}: releasing the lease failed`, error))
  }
}

type RunLog = { job: string; source: string; status: CronStatus; ms: number; at: Date; stats: Record<string, number | boolean> }

let runIndexReady: Promise<unknown> | null = null

/** One line per run in `cronRuns` (kept 14 days): numbers and flags only, never ids or addresses. */
async function logRun(entry: Omit<RunLog, 'at'>) {
  try {
    const runs = (await database()).collection<RunLog>('cronRuns')
    runIndexReady ??= runs.createIndex({ at: 1 }, { expireAfterSeconds: RUN_LOG_DAYS * 86400 }).catch(() => { runIndexReady = null })
    await runIndexReady
    await runs.insertOne({ ...entry, at: new Date() })
  } catch (error) {
    console.error(`cron ${entry.job}: logging the run failed`, error)
  }
}

/** Only numbers and booleans travel to the log (a job's stats never carry personal data, but be sure). */
function plainStats(stats: Record<string, unknown>): Record<string, number | boolean> {
  const plain: Record<string, number | boolean> = {}
  for (const [key, value] of Object.entries(stats)) {
    if ((typeof value === 'number' && Number.isFinite(value)) || typeof value === 'boolean') plain[key] = value
  }
  return plain
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

/**
 * The whole life of a cron request: secret → lease (70s) → fn({ deadline, source }) → answer.
 * 401 when the secret is wrong; 200 `{ ok, job, status, more, ms, ...stats }` otherwise, including
 * when another run holds the lease ('busy') or there is nothing to do ('idle'), so schedulers
 * don't report those as failures; 500 `{ ok: false }` when the job throws.
 */
export async function runCron(r: Request, name: string, fn: (ctx: CronContext) => Promise<CronResult>): Promise<Response> {
  if (!isCronAuthorized(r)) return json({ ok: false, error: 'Unauthorized' }, 401)
  const started = Date.now()
  const source = cronSource(r)
  try {
    const run = await withLease(name, CRON_LEASE_MS, () => fn({ deadline: cronDeadline(source), source }))
    const ms = Date.now() - started
    if (!('value' in run)) {
      await logRun({ job: name, source, status: 'busy', ms, stats: {} })
      return json({ ok: true, job: name, status: 'busy', more: false, ms })
    }
    const { more: rawMore, status: declared, ...stats } = run.value ?? {}
    const more = rawMore === true
    const status: CronStatus = declared ?? (more ? 'more' : 'done')
    const clean = plainStats(stats)
    await logRun({ job: name, source, status, ms, stats: clean })
    return json({ ok: true, job: name, status, more, ms, ...clean })
  } catch (error) {
    const ms = Date.now() - started
    console.error(`cron ${name} failed:`, error)
    await logRun({ job: name, source, status: 'error', ms, stats: {} })
    return json({ ok: false, job: name, status: 'error', more: false, ms }, 500)
  }
}
