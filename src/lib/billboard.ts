// The home page billboard: today's most talked-about movies and shows, with what a cinematic
// header needs (backdrop, title logo, trailer, a few facts). Refreshed with TMDB's daily trending
// list, so it follows what people are watching without anyone curating it.
import { tmdbFetchSafe, withTranslatedFields } from '@/src/lib/tmdb'
import { filterKidSafe } from '@/src/lib/kids'
import { isArabicScript, type Locale } from '@/src/lib/i18n'
import { pickLogo, pickTrailer } from '@/src/lib/media-assets'

export type BillboardItem = {
  id: number
  kind: 'movie' | 'tv'
  title: string
  overview: string
  backdrop: string
  poster: string | null
  /** The title-treatment logo and its width/height ratio. */
  logo: { path: string, ratio: number } | null
  /** YouTube key of the official trailer. */
  trailer: string | null
  year: string
  rating: number
  genres: string[]
  runtime: number | null
  seasons: number | null
}

const SLIDES = 6
const DETAIL_TTL = 6 * 3600

/** `only: 'tv'` for the TV page's billboard (shows only); otherwise movies and shows together. */
export async function getBillboard(kids: boolean, locale: Locale, only?: 'movie' | 'tv'): Promise<BillboardItem[]> {
  const trending = await tmdbFetchSafe<{ results: any[] }>(`trending/${only ?? 'all'}/day`, {}, 3600)
  let candidates = (trending?.results ?? [])
    .map((item) => (only ? { ...item, media_type: only } : item))
    .filter((item) => (item.media_type === 'movie' || item.media_type === 'tv') && item.backdrop_path && item.overview)
  if (kids) candidates = await filterKidSafe(candidates)

  const arabic = isArabicScript(locale)
  const items = await Promise.all(candidates.slice(0, SLIDES).map(async (item): Promise<BillboardItem | null> => {
    const kind: 'movie' | 'tv' = item.media_type
    const [detail, translated] = await Promise.all([
      tmdbFetchSafe(`${kind}/${item.id}`, { append_to_response: 'images,videos', include_image_language: 'en,null' }, DETAIL_TTL),
      // Arabic UI: TMDB's Arabic overview and genre names where they exist.
      arabic ? tmdbFetchSafe(`${kind}/${item.id}`, { language: 'ar' }, DETAIL_TTL) : null,
    ])
    if (!detail) return null
    const data = withTranslatedFields(detail, translated, ['overview', 'genres'])
    return {
      id: item.id,
      kind,
      title: data.title || data.name || '',
      overview: data.overview || item.overview,
      backdrop: data.backdrop_path || item.backdrop_path,
      poster: data.poster_path ?? null,
      logo: pickLogo(data.images?.logos),
      trailer: pickTrailer(data.videos?.results),
      year: (data.release_date || data.first_air_date || '').slice(0, 4),
      rating: data.vote_average || 0,
      genres: (data.genres ?? []).slice(0, 3).map((genre: any) => genre.name),
      runtime: kind === 'movie' ? data.runtime || null : null,
      seasons: kind === 'tv' ? data.number_of_seasons || null : null,
    }
  }))
  return items.filter((item): item is BillboardItem => item !== null)
}
