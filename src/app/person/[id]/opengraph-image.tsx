import { OG_SIZE, posterGlow, renderFallbackCard, renderPersonCard, tmdbImage } from '@/src/lib/og'
import { tmdbFetchSafe } from '@/src/lib/tmdb'

// Share card for /person/:id: portrait, name, and a strip of their best-known titles.
export const revalidate = 86400
export const alt = 'Actor on TunisiaFlicks'
export const size = OG_SIZE
export const contentType = 'image/jpeg'

const ROLES: Record<string, string> = { Acting: 'Actor', Directing: 'Director', Writing: 'Writer', Production: 'Producer' }

export default async function Image({ params }: { params: { id: string } }) {
  const person = /^\d+$/.test(params.id) ? await tmdbFetchSafe(`person/${params.id}`, { append_to_response: 'combined_credits' }, 86400) : null
  if (!person) return renderFallbackCard()

  const knownFor = [...(person.combined_credits?.cast ?? []), ...(person.combined_credits?.crew ?? [])]
    .filter((credit: any) => credit.poster_path && (credit.media_type === 'movie' || credit.media_type === 'tv'))
    .sort((a: any, b: any) => (b.vote_count ?? 0) - (a.vote_count ?? 0))
    .filter((credit: any, index: number, list: any[]) => list.findIndex((other) => other.id === credit.id) === index)
  const credits = new Set([...(person.combined_credits?.cast ?? []), ...(person.combined_credits?.crew ?? [])].map((credit: any) => `${credit.media_type}:${credit.id}`)).size
  // "London, England, UK" → "London, UK": the first and last parts say enough on a card.
  const place = person.place_of_birth?.split(',').map((part: string) => part.trim()).filter(Boolean)
  const born = place?.length ? (place.length > 2 ? `${place[0]}, ${place[place.length - 1]}` : place.join(', ')) : null

  return renderPersonCard({
    name: person.name,
    role: ROLES[person.known_for_department] ?? person.known_for_department ?? null,
    facts: [person.birthday && `Born ${person.birthday.slice(0, 4)}`, born, credits > 1 ? `${credits} titles` : null].filter(Boolean),
    photo: tmdbImage(person.profile_path, 'h632'),
    backdrop: tmdbImage(knownFor.find((credit: any) => credit.backdrop_path)?.backdrop_path, 'w1280'),
    strip: knownFor.slice(0, 5).map((credit: any) => tmdbImage(credit.poster_path, 'w185')!),
    glow: await posterGlow(knownFor[0]?.poster_path),
    cta: 'See their films',
  })
}
