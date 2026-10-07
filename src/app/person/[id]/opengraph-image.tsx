import { OG_SIZE, renderFallbackCard, renderShareCard, tmdbImage } from '@/src/lib/og'
import { tmdbFetchSafe } from '@/src/lib/tmdb'

// Share card for /person/:id: photo, name, and a strip of their best-known titles.
export const revalidate = 86400
export const alt = 'Actor on TunisiaFlicks'
export const size = OG_SIZE
export const contentType = 'image/jpeg'

export default async function Image({ params }: { params: { id: string } }) {
  const person = /^\d+$/.test(params.id) ? await tmdbFetchSafe(`person/${params.id}`, { append_to_response: 'combined_credits' }) : null
  if (!person) return renderFallbackCard()

  const knownFor = [...(person.combined_credits?.cast ?? []), ...(person.combined_credits?.crew ?? [])]
    .filter((credit: any) => credit.poster_path && (credit.media_type === 'movie' || credit.media_type === 'tv'))
    .sort((a: any, b: any) => (b.vote_count ?? 0) - (a.vote_count ?? 0))
    .filter((credit: any, index: number, list: any[]) => list.findIndex((other) => other.id === credit.id) === index)

  return renderShareCard({
    eyebrow: person.known_for_department === 'Acting' ? 'Actor' : person.known_for_department || 'Person',
    title: person.name,
    meta: [person.birthday && `Born ${person.birthday.slice(0, 4)}`, person.place_of_birth].filter(Boolean).join('  •  '),
    description: person.biography ? person.biography.split('\n')[0] : null,
    backdrop: tmdbImage(knownFor[0]?.backdrop_path, 'w1280'),
    poster: tmdbImage(person.profile_path, 'w500'),
    strip: knownFor.slice(0, 5).map((credit: any) => tmdbImage(credit.poster_path, 'w185')!),
  })
}
