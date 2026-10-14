import { tmdbFetchSafe } from '@/src/lib/tmdb'
import { SHARE_CARD_SIZE, keptShareImage } from '@/src/lib/share-image-store'

// Share card for /movie/:id (what Facebook, WhatsApp, Messenger, X and Telegram show).
export const dynamic = 'force-dynamic'
export const maxDuration = 30
export const alt = 'Movie on TunisiaFlicks'
export const size = SHARE_CARD_SIZE
export const contentType = 'image/jpeg'

const runtime = (minutes?: number) =>
  minutes ? `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)}h ` : ''}${minutes % 60}m` : null

async function draw({ params }: { params: { id: string } }) {
  // The drawing code loads only when a card has to be drawn (a kept card never needs it).
  const { posterGlow, renderFallbackCard, renderTitleCard, shareLogo, tmdbImage } = await import('@/src/lib/og')
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

/** Kept once drawn, so a crawler never waits (lib/share-image-store). */
export default function Image({ params }: { params: { id: string } }) {
  return keptShareImage(`movie/${params.id}`, () => draw({ params }))
}
