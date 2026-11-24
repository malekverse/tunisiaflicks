// "Play on my TV"'s rules (lib/tv-send keeps the waiting titles): what may be sent to a TV, and the
// page it opens there. Pure, so it's unit-tested.

export type SentMedia = { type: 'movie', id: string } | { type: 'tv', id: string, season: number, episode: number }
export type Sent = { media: SentMedia, title: string, fromName: string }

const episodeNumber = (value: unknown) => Number.isInteger(value) && (value as number) >= 0 && (value as number) < 1000

/** What a sender may send, checked: a film, or a show's episode, by its TMDB id. */
export function cleanSentMedia(raw: unknown): SentMedia | null {
  const value = raw as Record<string, unknown> | null
  const id = typeof value?.id === 'number' ? String(value.id) : value?.id
  if (typeof id !== 'string' || !/^\d{1,9}$/.test(id)) return null
  if (value?.type === 'movie') return { type: 'movie', id }
  if (value?.type === 'tv' && episodeNumber(value.season) && episodeNumber(value.episode)) return { type: 'tv', id, season: value.season as number, episode: value.episode as number }
  return null
}

/** The TV's page to open: the player, at the episode. */
export function sentPath(media: SentMedia): string {
  return media.type === 'movie' ? `/movie/${media.id}#streamSection` : `/tv/${media.id}?s=${media.season}&e=${media.episode}#streamSection`
}

