// What the desktop app's local player (player-service) needs to know about a title, so the TMDB key
// stays on the server instead of shipping in every installer:
// GET /api/player/title?type=movie|tv&id=<tmdb id> → { imdb, names, year }
//
// `imdb` finds the torrents and subtitles, `names` (the title and the original title) checks release
// names against the right show, `year` tells the right film from its remakes. Public, cached a day at
// the edge, rate limited per IP for the requests the cache doesn't absorb.
import { NextResponse } from 'next/server'
import { tmdbFetch, TmdbError } from '@/src/lib/tmdb'
import { clientIp, rateLimit, tooManyRequests } from '@/src/lib/rate-limit'

export const dynamic = 'force-dynamic'

const DAY = 86400
const noStore = { 'Cache-Control': 'no-store' }

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const type = params.get('type')
  const id = params.get('id') ?? ''
  if (type !== 'movie' && type !== 'tv') return NextResponse.json({ code: 'invalid_type' }, { status: 400, headers: noStore })
  if (!/^[0-9]{1,9}$/.test(id)) return NextResponse.json({ code: 'invalid_id' }, { status: 400, headers: noStore })

  const limit = await rateLimit(`player-title:${clientIp(request.headers)}`, 300, 600)
  if (!limit.ok) return tooManyRequests(limit.retryAfter)

  try {
    const data = await tmdbFetch(`${type}/${Number(id)}`, { append_to_response: 'external_ids' }, DAY)
    const names = [data.title, data.original_title, data.name, data.original_name]
      .filter((name): name is string => typeof name === 'string' && name.trim() !== '')
    const year = Number(String(data.release_date || data.first_air_date || '').slice(0, 4)) || null
    return NextResponse.json(
      { imdb: data.imdb_id || data.external_ids?.imdb_id || null, names: Array.from(new Set(names)), year },
      { headers: { 'Cache-Control': `public, max-age=${DAY}, s-maxage=${DAY}, stale-while-revalidate=${7 * DAY}` } }
    )
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) {
      return NextResponse.json({ code: 'not_found' }, { status: 404, headers: { 'Cache-Control': `public, s-maxage=${DAY}` } })
    }
    console.error(error)
    return NextResponse.json({ code: 'tmdb_unavailable' }, { status: 502, headers: noStore })
  }
}
