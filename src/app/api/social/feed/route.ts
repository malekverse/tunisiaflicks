// The friends feed (/friends): what friends watched and rated, as far as each of them shares.
import { getLocale } from '@/src/lib/i18n/server'
import { getFriendsActivity } from '@/src/lib/social/activity'
import { requireSocial, socialJson } from '@/src/lib/social/session'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const gate = await requireSocial({ needsHandle: true })
  if ('error' in gate) return gate.error
  const params = new URL(request.url).searchParams
  const limit = Number(params.get('limit') ?? 20)
  const feed = await getFriendsActivity(gate.ref, {
    before: params.get('before') ?? undefined,
    limit: Number.isFinite(limit) ? limit : 20,
    locale: getLocale(),
  })
  return socialJson(feed)
}
