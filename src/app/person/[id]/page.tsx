import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ExpandableText from '@/src/components/ExpandableText'
import MediaGrid from '@/src/components/MediaGrid'
import { PosterSlider } from '@/src/components/Sliders'
import { TmdbError, tmdbFetch, tmdbFetchSafe } from '@/src/lib/tmdb'

type Props = { params: { id: string } }

const isValidId = (id: string) => /^\d+$/.test(id)

// Talk shows, news and "Self" appearances flood an actor's credits without being their work.
const TALK_OR_NEWS = new Set([10767, 10763])
const isSelfAppearance = (credit: any) =>
  /^(self|himself|herself|themselves)\b/i.test(credit.character ?? '') || (credit.genre_ids ?? []).some((g: number) => TALK_OR_NEWS.has(g))

async function getPerson(id: string) {
  if (!isValidId(id)) notFound()
  try {
    return await tmdbFetch(`person/${id}`, { append_to_response: 'combined_credits' })
  } catch (error) {
    if (error instanceof TmdbError && error.status === 404) notFound()
    throw error
  }
}

/** Movies + shows the person worked on (acting first, then crew), one entry per title. */
function buildCredits(person: any) {
  const seen = new Set<string>()
  const credits: any[] = []
  for (const credit of [...(person.combined_credits?.cast ?? []), ...(person.combined_credits?.crew ?? [])]) {
    if (credit.media_type !== 'movie' && credit.media_type !== 'tv') continue
    if (!credit.poster_path || isSelfAppearance(credit)) continue
    const key = `${credit.media_type}-${credit.id}`
    if (seen.has(key)) continue
    seen.add(key)
    credits.push(credit)
  }
  return credits
}

const dateOf = (credit: any) => credit.release_date || credit.first_air_date || ''

function age(birthday: string, deathday?: string | null) {
  const end = deathday ? new Date(deathday) : new Date()
  const birth = new Date(birthday)
  let years = end.getFullYear() - birth.getFullYear()
  if (end < new Date(end.getFullYear(), birth.getMonth(), birth.getDate())) years--
  return years
}

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!isValidId(params.id)) return {}
  const person = await tmdbFetchSafe(`person/${params.id}`)
  if (!person) return {}
  return {
    title: `${person.name} | TunisiaFlicks`,
    description: person.biography ? person.biography.slice(0, 200) : `Movies and TV shows with ${person.name}.`,
    openGraph: {
      title: person.name,
      images: person.profile_path ? [`https://image.tmdb.org/t/p/w500${person.profile_path}`] : undefined,
    },
  }
}

export default async function PersonPage({ params }: Props) {
  const person = await getPerson(params.id)
  const credits = buildCredits(person)

  // "Known for": what people actually watched (vote count), not just recent noise.
  const knownFor = [...credits].sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0)).slice(0, 20)
  const filmography = [...credits].sort((a, b) => dateOf(b).localeCompare(dateOf(a)))

  const facts = [
    person.known_for_department && { label: 'Known for', value: person.known_for_department },
    person.birthday && {
      label: 'Born',
      value: `${formatDate(person.birthday)}${person.deathday ? '' : ` (age ${age(person.birthday)})`}`,
    },
    person.deathday && { label: 'Died', value: `${formatDate(person.deathday)} (aged ${age(person.birthday, person.deathday)})` },
    person.place_of_birth && { label: 'Place of birth', value: person.place_of_birth },
    credits.length > 0 && { label: 'Credits', value: `${credits.length} titles` },
  ].filter(Boolean) as { label: string, value: string }[]

  return (
    <div className="w-full max-w-[1800px] px-4 sm:px-14 space-y-10 pb-8">
      <section className="flex flex-col md:flex-row gap-6 md:gap-10 items-center md:items-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={person.profile_path ? `https://image.tmdb.org/t/p/w500${person.profile_path}` : '/actor.png'}
          alt={person.name}
          className="w-48 md:w-64 aspect-[2/3] object-cover rounded-xl shadow-2xl shadow-black/40 shrink-0 bg-zinc-800"
        />
        <div className="min-w-0 flex-1 w-full">
          <h1 className="text-3xl md:text-4xl font-bold text-center md:text-start">{person.name}</h1>
          {facts.length > 0 && (
            <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 max-w-2xl">
              {facts.map((fact) => (
                <div key={fact.label}>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">{fact.label}</dt>
                  <dd className="font-medium">{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {person.biography && (
            <div className="mt-6 max-w-3xl">
              <h2 className="text-lg font-semibold mb-2">Biography</h2>
              <ExpandableText text={person.biography} />
            </div>
          )}
        </div>
      </section>

      {knownFor.length > 0 && <PosterSlider title="Known For" items={knownFor} kind="mixed" />}

      {filmography.length > 0 && (
        <section aria-label="Filmography">
          <h2 className="text-2xl sm:text-3xl font-semibold mb-4">Filmography</h2>
          <MediaGrid items={filmography} showTypeBadge />
        </section>
      )}
    </div>
  )
}
