import { tmdbFetchSafe } from '@/src/lib/tmdb'
import { SHARE_CARD_SIZE, keptShareImage } from '@/src/lib/share-image-store'

// Share card for /tv/:id (what Facebook, WhatsApp, Messenger, X and Telegram show).
export const dynamic = 'force-dynamic'
export const maxDuration = 30
export const alt = 'TV series on TunisiaFlicks'
export const size = SHARE_CARD_SIZE
export const contentType = 'image/jpeg'

async function draw({ params }: { params: { id: string } }) {
  // The drawing code loads only when a card has to be drawn (a kept card never needs it).
  const { posterGlow, renderFallbackCard, renderTitleCard, shareLogo, tmdbImage } = await import('@/src/lib/og')
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

/** Kept once drawn, so a crawler never waits (lib/share-image-store). */
export default function Image({ params }: { params: { id: string } }) {
  return keptShareImage(`tv/${params.id}`, () => draw({ params }))
}
