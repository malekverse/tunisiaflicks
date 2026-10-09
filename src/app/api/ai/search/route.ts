// POST /api/ai/search: Ask. A sentence (q) becomes real TMDB titles, or a plan already understood
// (plan, the `p=` string) is run again (a chip removed, Show more, a shared link) without any model
// call. The answer streams as NDJSON lines (see AskEvent): plan, then results; or switch (go to
// the title search); or error.
//
// Guards, in order: Ask enabled (else 404, as if it didn't exist), JSON only (415), same origin
// (403), not a TV signed in with a code, not a Kids profile, not TV mode (403), a valid body (400),
// a valid plan (400), the rate limits (429 {code, retryAfter, signIn}).
// The model never writes what people see: chips are labelled here from TMDB ids, notices quote the
// person's own words.
import { randomBytes } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import { authOptions } from '@/src/lib/auth'
import { getKidsMode } from '@/src/lib/profiles'
import { isTvMode } from '@/src/lib/tv-mode'
import { denyLimitedSession } from '@/src/lib/session-scope'
import { getLocale } from '@/src/lib/i18n/server'
import { clientIp } from '@/src/lib/rate-limit'
import { TmdbError } from '@/src/lib/tmdb'
import { aiSearchEnabled } from '@/src/lib/ai-search/config'
import { countStat } from '@/src/lib/ai-search/cache'
import { checkAskLimits } from '@/src/lib/ai-search/limits'
import { cleanInput, scrubPersonal, MAX_QUERY } from '@/src/lib/ai-search/normalize'
import { encodePlan, hasFacets, MAX_PLAN_LENGTH } from '@/src/lib/ai-search/plan-codec'
import { parsePlan } from '@/src/lib/ai-search/schema'
import { interpret } from '@/src/lib/ai-search/interpret'
import { InvalidPlanError, checkPlan, chipsFor, resolveRaw, type Names } from '@/src/lib/ai-search/resolve'
import { CatalogueUnavailableError, executePlan } from '@/src/lib/ai-search/execute'
import type { AskEvent, AskNotice, SearchPlan } from '@/src/lib/ai-search/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 25

/** The first-party guest id (16 random bytes), so guests' limits don't depend on their IP alone. */
const GUEST_COOKIE = 'tf-gid'
const MAX_BODY = 4096

const bodySchema = z.object({
  q: z.string().max(MAX_QUERY * 2).optional(),
  plan: z.string().min(1).max(MAX_PLAN_LENGTH).optional(),
  page: z.number().int().min(1).max(5).optional(),
}).strict()

const refuse = (status: number, code: string, extra?: Record<string, unknown>, headers?: Record<string, string>) =>
  NextResponse.json({ code, ...extra }, { status, headers: { 'Cache-Control': 'no-store', ...headers } })

/** The page asking is this site: its Origin names the host the request came to. */
function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  const host = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || request.headers.get('host')
  if (!origin || !host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  if (!aiSearchEnabled()) return refuse(404, 'not_found')
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) return refuse(415, 'json_only')
  if (!sameOrigin(request)) return refuse(403, 'cross_origin')
  const denied = await denyLimitedSession()
  if (denied) return denied
  if (await getKidsMode()) return refuse(403, 'kids')
  if (isTvMode()) return refuse(403, 'tv_mode')

  let body: z.infer<typeof bodySchema>
  try {
    const text = await request.text()
    if (text.length > MAX_BODY) return refuse(400, 'bad_body')
    const parsed = bodySchema.safeParse(JSON.parse(text))
    if (!parsed.success) return refuse(400, 'bad_body')
    body = parsed.data
  } catch {
    return refuse(400, 'bad_body')
  }
  const question = scrubPersonal(cleanInput(body.q ?? ''))
  const page = body.page ?? 1
  let plan: SearchPlan | null = null
  if (body.plan !== undefined) {
    plan = parsePlan(body.plan)
    if (!plan) return refuse(400, 'bad_plan')
  } else if (!question) {
    return refuse(400, 'empty')
  }

  const session = await getServerSession(authOptions)
  const userId = session?.user?.id ? String(session.user.id) : null
  const cookie = request.cookies.get(GUEST_COOKIE)?.value
  let guestId = !userId && cookie && /^[a-f0-9]{32}$/.test(cookie) ? cookie : null
  const newGuest = !userId && !guestId ? randomBytes(16).toString('hex') : null
  if (newGuest) guestId = newGuest
  const withGuest = <T extends NextResponse>(response: T): T => {
    if (newGuest) {
      response.cookies.set(GUEST_COOKIE, newGuest, {
        httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365, secure: request.nextUrl.protocol === 'https:',
      })
    }
    return response
  }

  const limits = await checkAskLimits({ userId, guestId, ip: clientIp(request.headers) }, { interpret: !plan })
  if (limits.ok === false) {
    countStat('limited')
    return withGuest(refuse(429, limits.code, { retryAfter: limits.retryAfter, signIn: limits.signIn }, { 'Retry-After': String(limits.retryAfter) }))
  }

  const locale = getLocale()
  // A browser's plan is checked against TMDB before answering, so a crafted one is a 400.
  let names: Names | null = null
  if (plan) {
    try {
      names = await checkPlan(plan, locale)
    } catch (error) {
      if (error instanceof InvalidPlanError) return withGuest(refuse(400, 'bad_plan'))
      console.error('ai search plan check:', error)
      return withGuest(refuse(502, 'tmdb'))
    }
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AskEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
        } catch {
          // The reader went away (a newer question): nothing to do.
        }
      }
      try {
        if (plan && names) {
          countStat('plans')
          send({ t: 'plan', p: encodePlan(plan), chips: chipsFor(plan, names, locale), ai: true, notices: [], src: 'plan' })
          send({ t: 'results', ...(await executePlan(plan, { locale, page })), page })
        } else {
          countStat('asks')
          const meaning = await interpret(question, { guest: !userId, modelAllowed: limits.modelAllowed })
          if (meaning.switchTo) {
            countStat('switches')
            send({ t: 'switch', q: meaning.switchTo.q, reason: meaning.switchTo.reason })
          } else {
            const resolved = await resolveRaw(meaning.plan, locale)
            if (!hasFacets(resolved.plan)) {
              // Nothing could be found on TMDB (an unknown person, a theme with no keyword).
              countStat('switches')
              send({ t: 'switch', q: question, reason: meaning.resting ? 'resting' : 'title' })
            } else {
              const notices: AskNotice[] = [...(meaning.resting ? [{ code: 'resting' as const }] : []), ...resolved.notices]
              send({
                t: 'plan', p: encodePlan(resolved.plan), chips: chipsFor(resolved.plan, resolved.names, locale), ai: meaning.ai, notices,
                src: meaning.source === 'title' ? 'parser' : meaning.source,
              })
              send({ t: 'results', ...(await executePlan(resolved.plan, { locale, page: 1 })), page: 1 })
            }
          }
        }
      } catch (error) {
        countStat('errors')
        const catalogue = error instanceof CatalogueUnavailableError || error instanceof TmdbError
        if (!catalogue) console.error('ai search:', error)
        send({ t: 'error', code: catalogue ? 'tmdb' : 'failed' })
      }
      try {
        controller.close()
      } catch {
        // Already closed by the reader.
      }
    },
  })

  return withGuest(new NextResponse(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  }))
}
