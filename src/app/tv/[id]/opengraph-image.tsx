import { OG_SIZE, posterGlow, renderFallbackCard, renderTitleCard, shareLogo, tmdbImage } from '@/src/lib/og'
import { tmdbFetchSafe } from '@/src/lib/tmdb'

// Share card for /tv/:id (what Facebook, WhatsApp, Messenger, X and Telegram show).
export const revalidate = 86400
export const maxDuration = 30
export const alt = 'TV series on TunisiaFlicks'
export const size = OG_SIZE
export const contentType = 'image/jpeg'

export default async function Image({ params }: { params: { id: string } }) {
  const show = /^\d+$/.test(params.id)
    ? await tmdbFetchSafe(`tv/${params.id}`, { append_to_response: 'images', include_image_language: 'en,null' }, 86400)
    : null
  if (!show) return renderFallbackCard()

  const start = show.first_air_date?.slice(0, 4)
  const ended = show.status === 'Ended' || show.status === 'Canceled'
  const years = start ? `${start}${ended && show.last_air_date ? `–${show.last_air_date.slice(0, 4)}` : '–'}` : null
  const seasons = show.number_of_seasons ? `${show.number_of_seasons} season${show.number_of_seasons > 1 ? 's' : ''}` : null

  return renderTitleCard({
    title: show.name,
    backdrop: tmdbImage(show.backdrop_path, 'w1280'),
    poster: tmdbImage(show.poster_path, 'w500'),
    logo: shareLogo(show.images?.logos),
    glow: await posterGlow(show.poster_path),
    rating: show.vote_count > 20 ? show.vote_average : null,
    facts: [years, seasons, (show.genres ?? []).slice(0, 2).map((genre: any) => genre.name).join(', ')],
    line: show.tagline || show.overview,
    cta: 'Watch now',
  })
}
