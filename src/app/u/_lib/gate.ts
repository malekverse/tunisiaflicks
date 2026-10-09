// The real status codes of /u/[handle] and /me, answered by the middleware. Every page streams
// behind the root loading screen, which goes out with a 200 before the page knows anything: a
// notFound() or a redirect inside the page can change what is shown, never the status. So the
// middleware settles it first.
// - /u/[handle]: an address that can't be a handle is a 404 and an upper-case one a 308 on their
//   own; for the rest it asks the page's gate (/u/[handle]/gate, internal, the same rules as the
//   page: unknown, Kids, blocked either way, a guest over the view limit) and turns its answer
//   into a 404 or a 308.
// - /me: someone signed in asks /me/gate, and a profile with a page goes to it with a 302.
// Whatever goes wrong (no secret, slow, an error), the page renders as it would anyway.
// Edge-safe and free of Next.js imports (./middleware-gate.ts makes the responses), so
// tests/social-pages.unit.test.mjs runs it as it is.
import { normalizeHandle } from '@/src/lib/social/rules'
import { HANDLE_RE } from '@/src/lib/social/types'

/** The header that proves a request to a gate comes from the middleware. */
export const GATE_HEADER = 'x-tf-page-gate'
/** The visitor's address, for the guest view limit (the gate itself is called by the middleware). */
export const GATE_IP_HEADER = 'x-tf-page-gate-ip'
// A slow answer lets the page answer instead (the dev server compiles the gate on first use).
const GATE_TIMEOUT_MS = process.env.NODE_ENV === 'development' ? 15_000 : 3000

/** What a gate route answers. */
export type GateAnswer = { kind: 'not_found' } | { kind: 'redirect'; to: string } | { kind: 'page' }
/** What the middleware does: a 404, a redirect to /u/<to>, or nothing (null). */
export type GateDecision = { kind: 'not_found' } | { kind: 'redirect'; to: string; status: 302 | 308 } | null

/** sha256 of the secret (never the secret itself), in hex: what the middleware sends, the gates expect. */
export async function gateToken(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`tf-u-gate:${secret}`))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Constant-time comparison of two hex tokens. */
export function sameToken(a: string | null | undefined, b: string): boolean {
  if (typeof a !== 'string' || a.length !== b.length) return false
  let difference = 0
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index)
  return difference === 0
}

/**
 * What the address alone says about /u/<segment>: not one (skip), never a handle (404), a handle
 * written in another case or with an @ (308 to the plain one), or a handle to ask the gate about.
 */
export function readHandlePath(pathname: string):
  | { kind: 'skip' }
  | { kind: 'not_found' }
  | { kind: 'redirect'; to: string }
  | { kind: 'check'; handle: string } {
  const match = /^\/u\/([^/]+)$/.exec(pathname)
  if (!match) return { kind: 'skip' }
  let decoded: string
  try {
    decoded = decodeURIComponent(match[1])
  } catch {
    return { kind: 'not_found' }
  }
  const handle = normalizeHandle(decoded)
  if (!handle || !HANDLE_RE.test(handle)) return { kind: 'not_found' }
  if (handle !== match[1]) return { kind: 'redirect', to: handle }
  return { kind: 'check', handle }
}

/** The first hop of x-forwarded-for, as the page's rate limit reads it (lib/rate-limit clientIp). */
const visitorIp = (headers: Headers) => headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown'

/** A NextAuth session cookie (plain or __Secure-), chunked or not. */
const hasSession = (headers: Headers) => /(?:^|;\s*)(?:__Secure-)?next-auth\.session-token(?:\.\d+)?=/.test(headers.get('cookie') ?? '')

type Fetch = typeof fetch

/** Asks a gate route as the visitor; null when it doesn't answer well and in time. */
async function askGate(path: string, request: { origin: string; headers: Headers }, secret: string, fetchImpl: Fetch): Promise<GateAnswer | null> {
  // A plain controller and timer (AbortSignal.timeout isn't in every edge runtime).
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GATE_TIMEOUT_MS)
  try {
    const headers = new Headers({ [GATE_HEADER]: await gateToken(secret), [GATE_IP_HEADER]: visitorIp(request.headers) })
    const cookie = request.headers.get('cookie')
    if (cookie) headers.set('cookie', cookie)
    const response = await fetchImpl(new URL(path, request.origin), { headers, cache: 'no-store', redirect: 'manual', signal: controller.signal })
    if (!response.ok) return null
    const answer = (await response.json()) as Partial<GateAnswer>
    if (answer.kind === 'not_found' || answer.kind === 'page') return { kind: answer.kind }
    if (answer.kind === 'redirect' && typeof answer.to === 'string' && HANDLE_RE.test(answer.to)) return { kind: 'redirect', to: answer.to }
    return null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * A 404 or a redirect for this request when the page would answer one; null to let it through.
 * Prefetches go through (they only render the loading screen).
 */
export async function decideProfileGate(
  request: { method: string; pathname: string; origin: string; headers: Headers },
  opts: { secret?: string; fetch?: Fetch } = {},
): Promise<GateDecision> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null
  const me = request.pathname === '/me'
  let gatePath = '/me/gate'
  if (!me) {
    const path = readHandlePath(request.pathname)
    if (path.kind === 'skip') return null
    if (path.kind === 'not_found') return path
    if (path.kind === 'redirect') return { ...path, status: 308 }
    gatePath = `/u/${path.handle}/gate`
  }
  if (request.headers.get('next-router-prefetch') || request.headers.get('purpose') === 'prefetch') return null
  // /me has a page to go to only for someone signed in.
  if (me && !hasSession(request.headers)) return null

  const secret = opts.secret ?? process.env.NEXTAUTH_SECRET
  if (!secret) return null
  const answer = await askGate(gatePath, request, secret, opts.fetch ?? fetch)
  if (answer?.kind === 'not_found' && !me) return answer
  if (answer?.kind === 'redirect') return { kind: 'redirect', to: answer.to, status: me ? 302 : 308 }
  return null
}
