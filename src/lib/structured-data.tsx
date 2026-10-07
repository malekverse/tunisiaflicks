// schema.org JSON-LD for title and person pages, so search engines can show rich results
// (poster, rating, release year, director, cast) for TunisiaFlicks pages.
import { SITE_HOST } from '@/src/lib/og'

const SITE = `https://${SITE_HOST}`
const img = (path?: string | null, size = 'w780') => (path ? `https://image.tmdb.org/t/p/${size}${path}` : undefined)
const iso8601Duration = (minutes?: number) => (minutes ? `PT${Math.floor(minutes / 60)}H${minutes % 60}M` : undefined)

const people = (list: any[] | undefined, limit: number) =>
  (list ?? []).slice(0, limit).map((person) => ({ '@type': 'Person', name: person.name, url: `${SITE}/person/${person.id}` }))

const rating = (item: any) =>
  item.vote_count > 0
    ? { '@type': 'AggregateRating', ratingValue: Math.round(item.vote_average * 10) / 10, bestRating: 10, worstRating: 0, ratingCount: item.vote_count }
    : undefined

export function movieJsonLd(movie: any) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Movie',
    name: movie.title,
    url: `${SITE}/movie/${movie.id}`,
    image: img(movie.poster_path, 'w500'),
    description: movie.overview || undefined,
    datePublished: movie.release_date || undefined,
    duration: iso8601Duration(movie.runtime),
    genre: (movie.genres ?? []).map((genre: any) => genre.name),
    inLanguage: movie.original_language,
    director: people((movie.credits?.crew ?? []).filter((member: any) => member.job === 'Director'), 3),
    actor: people(movie.credits?.cast, 8),
    aggregateRating: rating(movie),
  }
}

export function tvJsonLd(show: any) {
  return {
    '@context': 'https://schema.org',
    '@type': 'TVSeries',
    name: show.name,
    url: `${SITE}/tv/${show.id}`,
    image: img(show.poster_path, 'w500'),
    description: show.overview || undefined,
    startDate: show.first_air_date || undefined,
    endDate: show.status === 'Ended' ? show.last_air_date || undefined : undefined,
    numberOfSeasons: show.number_of_seasons,
    numberOfEpisodes: show.number_of_episodes,
    genre: (show.genres ?? []).map((genre: any) => genre.name),
    inLanguage: show.original_language,
    creator: people(show.created_by, 3),
    actor: people(show.credits?.cast, 8),
    aggregateRating: rating(show),
  }
}

export function personJsonLd(person: any) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: person.name,
    url: `${SITE}/person/${person.id}`,
    image: img(person.profile_path, 'w500'),
    description: person.biography ? person.biography.slice(0, 300) : undefined,
    birthDate: person.birthday || undefined,
    deathDate: person.deathday || undefined,
    birthPlace: person.place_of_birth || undefined,
    jobTitle: person.known_for_department || undefined,
  }
}

/** Renders JSON-LD safely (escapes `<` so data can never close the script tag). */
export function JsonLd({ data }: { data: object }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
}
