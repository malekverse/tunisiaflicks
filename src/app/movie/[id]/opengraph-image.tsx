import { OG_SIZE, renderFallbackCard, renderShareCard, tmdbImage } from '@/src/lib/og'
import { tmdbFetchSafe } from '@/src/lib/tmdb'

// Share card for /movie/:id (what Facebook, WhatsApp, Messenger, X and Telegram show).
export const revalidate = 86400
export const alt = 'Movie on TunisiaFlicks'
export const size = OG_SIZE
export const contentType = 'image/jpeg'

const runtime = (minutes?: number) =>
  minutes ? `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)}h ` : ''}${minutes % 60}m` : null

export default async function Image({ params }: { params: { id: string } }) {
  const movie = /^\d+$/.test(params.id) ? await tmdbFetchSafe(`movie/${params.id}`) : null
  if (!movie) return renderFallbackCard()

  return renderShareCard({
    eyebrow: 'Movie',
    title: movie.title,
    meta: [movie.release_date?.slice(0, 4), runtime(movie.runtime), (movie.genres ?? []).slice(0, 2).map((g: any) => g.name).join(', ')]
      .filter(Boolean).join('  •  '),
    rating: movie.vote_count > 20 ? movie.vote_average : null,
    description: movie.tagline || movie.overview,
    backdrop: tmdbImage(movie.backdrop_path, 'w1280'),
    poster: tmdbImage(movie.poster_path, 'w500'),
  })
}
