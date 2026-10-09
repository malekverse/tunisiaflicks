// A title's soundtrack: GET /api/soundtrack?type=movie|tv&id=&kids=0|1
//   → {status: 'found', album, tracks} | {status: 'none'}
//
// The album comes from the soundtracks cache (searched on Deezer when missing or stale, see
// lib/soundtrack). Tracks are listed fresh from Deezer, without their preview links (each preview
// plays through /api/soundtrack/preview/{track}, which fetches a link that hasn't expired).
// Kids profiles get no explicit tracks and no link out. `kids` must still be the page's profile:
// otherwise 409 {code:'profile_changed'} and the page refreshes.
import { NextResponse } from 'next/server'
import { getKidsMode } from '@/src/lib/profiles'
import { clientIp, rateLimit, tooManyRequests } from '@/src/lib/rate-limit'
import { getAlbumTracks } from '@/src/lib/deezer'
import { resolveSoundtrack, soundtrackFacts } from '@/src/lib/soundtrack'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const json = (body: unknown, status = 200, cache = 'no-store') => NextResponse.json(body, { status, headers: { 'Cache-Control': cache } })

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const type = params.get('type')
  const id = params.get('id') ?? ''
  const kidsParam = params.get('kids')
  if (type !== 'movie' && type !== 'tv') return json({ code: 'invalid_type' }, 400)
  if (!/^[0-9]{1,9}$/.test(id)) return json({ code: 'invalid_id' }, 400)
  if (kidsParam !== '0' && kidsParam !== '1') return json({ code: 'invalid_kids' }, 400)

  const limit = await rateLimit(`soundtrack:${clientIp(request.headers)}`, 120, 600)
  if (!limit.ok) return tooManyRequests(limit.retryAfter)

  const kids = await getKidsMode()
  if (kids !== (kidsParam === '1')) return json({ code: 'profile_changed' }, 409)

  const tmdbId = String(Number(id))
  const facts = await soundtrackFacts(type, tmdbId)
  if (!facts) return json({ code: 'unknown_title' }, 404)

  let album
  try {
    album = await resolveSoundtrack(type, tmdbId, facts)
  } catch (error) {
    console.error('soundtrack:', error)
    return json({ code: 'unavailable' }, 503)
  }
  if (!album) return json({ status: 'none' }, 200, 'private, max-age=3600')

  const tracks = (await getAlbumTracks(album.albumId)) ?? []
  return json({
    status: 'found',
    album: { ...album, link: kids ? null : album.link },
    tracks: tracks
      .filter((track) => !(kids && track.explicit))
      .map((track) => ({ id: track.id, title: track.title, artist: track.artist, duration: track.duration, explicit: track.explicit, preview: track.hasPreview })),
  }, 200, 'private, max-age=3600')
}
