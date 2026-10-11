// "Not halal? Report it" (components/halal/HalalReport): a viewer in Halal mode flags a title, and
// it's hidden for everyone in Halal mode from then on (lib/halal). One vote per profile per title.
import { NextResponse } from 'next/server'
import { requireActiveProfile } from '@/src/lib/profiles'
import { rateLimit } from '@/src/lib/rate-limit'
import { reportTitle } from '@/src/lib/halal'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const result = await requireActiveProfile()
  if ('error' in result) return result.error
  if (result.profile.halal !== true) return NextResponse.json({ error: 'Halal mode is off' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const kind = body?.kind
  const id = Number(body?.id)
  if ((kind !== 'movie' && kind !== 'tv') || !Number.isInteger(id) || id <= 0 || id > 1e9) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }
  const limit = await rateLimit(`halal-report:${result.userId}`, 30, 86400)
  if (!limit.ok) return NextResponse.json({ error: 'Too many reports today' }, { status: 429 })

  await reportTitle({ kind, id }, result.profile.id)
  return NextResponse.json({ success: true })
}
