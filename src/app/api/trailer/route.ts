import { NextResponse, type NextRequest } from 'next/server'
import { tmdbFetchSafe } from '@/src/lib/tmdb'

// YouTube trailer key for a title, for card hover previews. Cached a day at the edge and in the
// TMDB data cache, so hovering the same card again is free.
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type')
  const id = request.nextUrl.searchParams.get('id') ?? ''
  if ((type !== 'movie' && type !== 'tv') || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'Invalid type or id' }, { status: 400 })
  }

  const data = await tmdbFetchSafe<{ results: any[] }>(`${type}/${id}/videos`, {}, 86400)
  const videos = (data?.results ?? []).filter((video) => video.site === 'YouTube' && video.key)
  const trailer = videos.find((video) => video.type === 'Trailer' && video.official)
    ?? videos.find((video) => video.type === 'Trailer')
    ?? videos.find((video) => video.type === 'Teaser')

  return NextResponse.json(
    { key: trailer?.key ?? null },
    { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } }
  )
}
