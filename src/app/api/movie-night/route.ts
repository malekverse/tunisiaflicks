// Movie nights: GET your nights (?next=1: just the next one, for the menu's tile), POST a new one
// {title?, starts_at, tz, place?, note?, candidates?: ['movie:550'], invite?: handles, vote_closes_at?}.
// JSON, never cached; grown-up profiles with a page only (see requireSocial).
import { getLocale } from '@/src/lib/i18n/server'
import { createNight, listMyNights, listNightsPage } from '@/src/lib/movie-night'
import { readJson, requireSocial, socialError, socialJson, socialRateLimit } from '@/src/lib/social/session'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const gate = await requireSocial()
  if ('error' in gate) return gate.error
  if (new URL(request.url).searchParams.get('next') === '1') {
    const [next] = await listMyNights(gate.ref, { within: 60 })
    return socialJson({ next: next ?? null })
  }
  return socialJson(await listNightsPage(gate.ref))
}

export async function POST(request: Request) {
  const gate = await requireSocial({ write: true, needsHandle: true })
  if ('error' in gate) return gate.error
  const limited = await socialRateLimit([[`night:create:${gate.ref.userId}`, 10, 60 * 60]])
  if (limited) return limited
  const body = await readJson(request)
  if (!body) return socialError(400, 'invalid')
  const result = await createNight(gate.ref, body, getLocale())
  if ('error' in result) return socialError(result.status, result.error)
  return socialJson({ id: result.id, sent: result.sent, skipped: result.skipped }, 201)
}
