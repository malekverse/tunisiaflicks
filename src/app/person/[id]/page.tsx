import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ExpandableText from '@/src/components/ExpandableText'
import MediaGrid from '@/src/components/MediaGrid'
import { PosterSlider } from '@/src/components/Sliders'
import { TmdbError, tmdbFetch, tmdbFetchSafe, withTranslatedFields } from '@/src/lib/tmdb'
import { createTranslator, type Locale, type TKey } from '@/src/lib/i18n'
import { getLocale } from '@/src/lib/i18n/server'
import { filterKidSafe } from '@/src/lib/kids'
import { getKidsMode } from '@/src/lib/profiles'

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

const formatDate = (value: string, locale: Locale) =>
  new Date(value).toLocaleDateString(locale === 'ar' ? 'ar-TN-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!isValidId(params.id)) return {}
  const person = await tmdbFetchSafe(`person/${params.id}`)
  if (!person) return {}
  return {
    title: `${person.name} | TunisiaFlicks`,
    description: person.biography ? person.biography.slice(0, 200) : `Movies and TV shows with ${person.name}.`,
    // The share image comes from ./opengraph-image.tsx (branded card); setting `images` here would override it.
    openGraph: {
      title: person.name,
    },
  }
}

export default async function PersonPage({ params }: Props) {
  const locale = getLocale()
  const t = createTranslator(locale)
  // Arabic UI: TMDB's Arabic biography when there is one (most people only have an English one).
  const [english, translated, kids] = await Promise.all([
    getPerson(params.id),
    locale === 'ar' && isValidId(params.id) ? tmdbFetchSafe(`person/${params.id}`, { language: 'ar' }) : null,
    getKidsMode(),
  ])
  const person = withTranslatedFields(english, translated, ['biography'])
  // Kids profiles: only their best-known titles that are rated for kids.
  const credits = kids
    ? await filterKidSafe(buildCredits(person).sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0)), undefined, 60)
    : buildCredits(person)
  const department = (name: string) => {
    const key = `dept.${name}` as TKey
    return t(key) === key ? name : t(key)
  }

  // "Known for": what people actually watched (vote count), not just recent noise.
  const knownFor = [...credits].sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0)).slice(0, 20)
  const filmography = [...credits].sort((a, b) => dateOf(b).localeCompare(dateOf(a)))

  const facts = [
    person.known_for_department && { label: t('person.knownFor'), value: department(person.known_for_department) },
    person.birthday && {
      label: t('person.born'),
      value: `${formatDate(person.birthday, locale)}${person.deathday ? '' : ` ${t('person.age', { age: age(person.birthday) })}`}`,
    },
    person.deathday && { label: t('person.died'), value: `${formatDate(person.deathday, locale)} ${t('person.aged', { age: age(person.birthday, person.deathday) })}` },
    person.place_of_birth && { label: t('person.placeOfBirth'), value: person.place_of_birth },
    credits.length > 0 && { label: t('person.credits'), value: t('person.titles', { count: credits.length }) },
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
              <h2 className="text-lg font-semibold mb-2">{t('person.biography')}</h2>
              <ExpandableText text={person.biography} />
            </div>
          )}
        </div>
      </section>

      {knownFor.length > 0 && <PosterSlider title={t('person.knownForRow')} items={knownFor} kind="mixed" />}

      {filmography.length > 0 && (
        <section aria-label={t('person.filmography')}>
          <h2 className="text-2xl sm:text-3xl font-semibold mb-4">{t('person.filmography')}</h2>
          <MediaGrid items={filmography} showTypeBadge />
        </section>
      )}
    </div>
  )
}
