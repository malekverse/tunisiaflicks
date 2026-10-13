import { OG_SIZE, renderFallbackCard, renderTitleCard } from '@/src/lib/og'
import { getAnimeDetail } from '@/src/lib/anime/server'

// Share card for /anime/:id (what Facebook, WhatsApp, Messenger, X and Telegram show): the anime's
// cover beside its title, like a movie's card without a backdrop (AniList's banners are short and
// wide, and blur when stretched over the card). Shared by everyone, so it reads AniList with no
// viewer; a title the site never shows (adult) gets the plain TunisiaFlicks card.
export const revalidate = 86400
export const maxDuration = 30
export const alt = 'Anime on TunisiaFlicks'
export const size = OG_SIZE
export const contentType = 'image/jpeg'

const FORMAT: Record<string, string> = { TV: 'TV', TV_SHORT: 'TV short', MOVIE: 'Movie', SPECIAL: 'Special', OVA: 'OVA', ONA: 'ONA', MUSIC: 'Music' }

/** '#e4a15d' (AniList's cover colour) → '228 161 93', the cards' glow format. */
const glowOf = (hex: string | null) => {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex ?? '')
  return match ? match.slice(1).map((part) => parseInt(part, 16)).join(' ') : null
}

export default async function Image({ params }: { params: { id: string } }) {
  const id = /^\d{1,9}$/.test(params.id) ? Number(params.id) : 0
  const detail = id ? await getAnimeDetail(id, { kids: false, halal: false, language: 'english' }) : null
  if (!detail || detail.hidden) return renderFallbackCard()

  const { card } = detail
  const episodes = card.episodes ? `${card.episodes} episode${card.episodes === 1 ? '' : 's'}` : null
  return renderTitleCard({
    title: card.title,
    poster: card.cover,
    glow: glowOf(card.color),
    rating: card.score,
    facts: [card.year ? String(card.year) : null, card.format ? FORMAT[card.format] ?? null : null, card.format === 'MOVIE' ? null : episodes, card.genres.slice(0, 2).join(', ')],
    line: card.description,
    cta: card.status === 'NOT_YET_RELEASED' ? 'Watch the trailer' : 'Watch now',
  })
}
