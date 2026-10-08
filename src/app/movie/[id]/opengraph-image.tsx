import { OG_SIZE, posterGlow, renderFallbackCard, renderTitleCard, shareLogo, tmdbImage } from '@/src/lib/og'
import { tmdbFetchSafe } from '@/src/lib/tmdb'

// Share card for /movie/:id (what Facebook, WhatsApp, Messenger, X and Telegram show).
export const revalidate = 86400
export const maxDuration = 30
export const alt = 'Movie on TunisiaFlicks'
export const size = OG_SIZE
export const contentType = 'image/jpeg'

const runtime = (minutes?: number) =>
  minutes ? `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)}h ` : ''}${minutes % 60}m` : null

export default async function Image({ params }: { params: { id: string } }) {
  const movie = /^\d+$/.test(params.id)
    ? await tmdbFetchSafe(`movie/${params.id}`, { append_to_response: 'images', include_image_language: 'en,null' }, 86400)
    : null
  if (!movie) return renderFallbackCard()

  const released = !movie.release_date || movie.release_date <= new Date().toISOString().slice(0, 10)
  return renderTitleCard({
    title: movie.title,
    backdrop: tmdbImage(movie.backdrop_path, 'w1280'),
    poster: tmdbImage(movie.poster_path, 'w500'),
    logo: shareLogo(movie.images?.logos),
    glow: await posterGlow(movie.poster_path),
    rating: movie.vote_count > 20 ? movie.vote_average : null,
    facts: [movie.release_date?.slice(0, 4), runtime(movie.runtime), (movie.genres ?? []).slice(0, 2).map((genre: any) => genre.name).join(', ')],
    line: movie.tagline || movie.overview,
    cta: released ? 'Watch now' : 'Watch the trailer',
  })
}
