// Clips: a vertical feed of trailers for what's trending today and this week. Finite on purpose
// (about two dozen): it ends with "You're all caught up" instead of scrolling forever.
import { tmdbFetchSafe } from '@/src/lib/tmdb'
import { localizeDetail, logoLanguages, translatedRecord } from '@/src/lib/tmdb-locale'
import { filterKidSafe } from '@/src/lib/kids'
import type { Locale } from '@/src/lib/i18n'
import { pickLogo, pickTrailer } from '@/src/lib/media-assets'

export type Clip = {
  id: number
  kind: 'movie' | 'tv'
  title: string
  overview: string
  backdrop: string | null
  poster: string | null
  logo: { path: string, ratio: number } | null
  trailer: string
  year: string
  rating: number
  genres: string[]
}

const MAX_CLIPS = 24
// Same request as the billboard's, so the two share TMDB's cached responses.
const DETAIL_PARAMS = { append_to_response: 'images,videos', include_image_language: 'en,null' }
const DETAIL_TTL = 6 * 3600

export async function getClips(kids: boolean, locale: Locale): Promise<Clip[]> {
  const [day, week] = await Promise.all([
    tmdbFetchSafe<{ results: any[] }>('trending/all/day', {}, 3600),
    tmdbFetchSafe<{ results: any[] }>('trending/all/week', {}, 3600),
  ])
  const seen = new Set<string>()
  let candidates = [...(day?.results ?? []), ...(week?.results ?? [])].filter((item) => {
    if ((item.media_type !== 'movie' && item.media_type !== 'tv') || !item.backdrop_path) return false
    const key = `${item.media_type}:${item.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (kids) candidates = await filterKidSafe(candidates)

  const params = { ...DETAIL_PARAMS, include_image_language: logoLanguages(locale) }
  const clips = await Promise.all(candidates.slice(0, MAX_CLIPS + 10).map(async (item): Promise<Clip | null> => {
    const kind: 'movie' | 'tv' = item.media_type
    const [detail, translated] = await Promise.all([
      tmdbFetchSafe(`${kind}/${item.id}`, params, DETAIL_TTL),
      translatedRecord(kind, String(item.id), locale, DETAIL_TTL),
    ])
    const trailer = pickTrailer(detail?.videos?.results)
    if (!detail || !trailer) return null
    const data = localizeDetail(detail, translated, locale)
    return {
      id: item.id,
      kind,
      title: data.title || data.name || '',
      overview: data.overview || item.overview || '',
      backdrop: data.backdrop_path || item.backdrop_path,
      poster: data.poster_path ?? null,
      logo: pickLogo(data.images?.logos),
      trailer,
      year: (data.release_date || data.first_air_date || '').slice(0, 4),
      rating: data.vote_average || 0,
      genres: (data.genres ?? []).slice(0, 2).map((genre: any) => genre.name),
    }
  }))
  return clips.filter((clip): clip is Clip => clip !== null).slice(0, MAX_CLIPS)
}
