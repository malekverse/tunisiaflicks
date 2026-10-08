import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ExpandableText from '@/src/components/ExpandableText'
import TmdbImage from '@/src/components/TmdbImage'
import Filmography, { type Credit } from '@/src/components/person/Filmography'
import RoomTint from '@/src/components/shell/RoomTint'
import { PosterSlider } from '@/src/components/Sliders'
import { TmdbError, tmdbFetch, tmdbFetchSafe } from '@/src/lib/tmdb'
import { catalogueLanguage, localizeDetail, translatedRecord } from '@/src/lib/tmdb-locale'
import { createTranslator, type Locale, type TKey } from '@/src/lib/i18n'
import { formatDate } from '@/src/lib/i18n/format'
import { getLocale } from '@/src/lib/i18n/server'
import { filterKidSafe } from '@/src/lib/kids'
import { getKidsMode } from '@/src/lib/profiles'
import { pageMetadata } from '@/src/lib/seo'

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

/** The English credits with the titles (and posters) of the same credits in the viewer's language. */
function localizeCredits(credits: { cast?: any[], crew?: any[] } | undefined, local: { cast?: any[], crew?: any[] }) {
  const byKey = new Map<string, any>()
  for (const credit of [...(local.cast ?? []), ...(local.crew ?? [])]) byKey.set(`${credit.media_type}-${credit.id}`, credit)
  const overlay = (credit: any) => {
    const match = byKey.get(`${credit.media_type}-${credit.id}`)
    return match
      ? { ...credit, title: match.title || credit.title, name: match.name || credit.name, poster_path: match.poster_path || credit.poster_path }
      : credit
  }
  return { ...credits, cast: credits?.cast?.map(overlay), crew: credits?.crew?.map(overlay) }
}

const dateOf = (credit: any) => credit.release_date || credit.first_air_date || ''

function age(birthday: string, deathday?: string | null) {
  const end = deathday ? new Date(deathday) : new Date()
  const birth = new Date(birthday)
  let years = end.getFullYear() - birth.getFullYear()
  if (end < new Date(end.getFullYear(), birth.getMonth(), birth.getDate())) years--
  return years
}

const longDate = (value: string, locale: Locale) => formatDate(value, locale, { day: 'numeric', month: 'long', year: 'numeric' })

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!isValidId(params.id)) return {}
  const locale = getLocale()
  const [english, translated] = await Promise.all([tmdbFetchSafe(`person/${params.id}`), translatedRecord('person', params.id, locale)])
  if (!english) return {}
  const person = localizeDetail(english, translated, locale)
  // The share image comes from ./opengraph-image.tsx (card: false).
  return pageMetadata({
    title: person.name,
    description: person.biography || `Movies and TV shows with ${person.name}.`,
    path: `/person/${params.id}`,
    card: false,
    openGraph: { type: 'profile' },
  })
}

export default async function PersonPage({ params }: Props) {
  const locale = getLocale()
  const t = createTranslator(locale)
  // The biography in the viewer's language when TMDB has one (most people only have an English
  // one); in French, the titles of their films and shows in French too.
  const language = catalogueLanguage(locale)
  const [english, translated, localCredits, kids] = await Promise.all([
    getPerson(params.id),
    translatedRecord('person', params.id, locale),
    language && isValidId(params.id) ? tmdbFetchSafe<{ cast?: any[], crew?: any[] }>(`person/${params.id}/combined_credits`, { language }) : null,
    getKidsMode(),
  ])
  const person = localizeDetail(english, translated, locale)
  if (localCredits) person.combined_credits = localizeCredits(person.combined_credits, localCredits)
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
      value: `${longDate(person.birthday, locale)}${person.deathday ? '' : ` ${t('person.age', { age: age(person.birthday) })}`}`,
    },
    person.deathday && { label: t('person.died'), value: `${longDate(person.deathday, locale)} ${t('person.aged', { age: age(person.birthday, person.deathday) })}` },
    person.place_of_birth && { label: t('person.placeOfBirth'), value: person.place_of_birth },
    credits.length > 0 && { label: t('person.credits'), value: t('person.titles', { count: credits.length }) },
  ].filter(Boolean) as { label: string, value: string }[]

  const timeline: Credit[] = filmography.map((credit) => ({
    id: credit.id,
    media_type: credit.media_type,
    title: credit.title || credit.name,
    date: dateOf(credit),
    role: credit.character ? t('person.as', { character: credit.character }) : credit.job ?? '',
    poster_path: credit.poster_path ?? null,
    vote_average: credit.vote_average ?? 0,
  }))
  // The atmosphere: their best-known title's backdrop, dimmed far behind the portrait.
  const backdrop = knownFor.find((credit) => credit.backdrop_path)?.backdrop_path

  return (
    <div className="w-full min-w-0 space-y-14 pb-10">
      <RoomTint poster={knownFor[0]?.poster_path} />
      <section className="relative isolate">
        {backdrop && (
          <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[78vh] overflow-hidden">
            <TmdbImage kind="backdrop" path={backdrop} alt="" fill sizes="100vw" shimmer={false} className="scale-105 object-cover opacity-30 blur-[3px]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />
          </div>
        )}
        <div className="page-x flex flex-col items-center gap-8 pt-[calc(var(--topbar)+env(safe-area-inset-top,0px)+32px)] md:flex-row md:items-end md:gap-12 md:pt-[calc(var(--topbar)+80px)]">
          <div className="relative isolate w-44 shrink-0 animate-focus-in sm:w-56 md:w-64">
            <div aria-hidden className="absolute inset-4 -z-10 rounded-[2rem] bg-red-500/20 blur-3xl" />
            <div className="relative aspect-[2/3] overflow-hidden rounded-[22px] bg-white/[0.05] shadow-[0_40px_80px_-30px_rgb(0_0_0/0.9)] ring-1 ring-white/10">
              <TmdbImage
                kind="profile"
                path={person.profile_path}
                fallback="/actor.png"
                alt={person.name}
                fill
                sizes="(min-width: 768px) 256px, 224px"
                preview="w45"
                priority
                className="object-cover"
              />
            </div>
          </div>
          <div className="min-w-0 flex-1 text-center md:pb-2 md:text-start">
            {person.known_for_department && <p className="animate-focus-in text-[14px] font-medium text-white/55">{department(person.known_for_department)}</p>}
            <h1 className="mt-1 animate-focus-in text-balance font-display text-[clamp(44px,7vw,104px)] font-extrabold leading-[0.92] [animation-delay:60ms]"><bdi>{person.name}</bdi></h1>
            {facts.length > 0 && (
              <dl className="mt-6 flex animate-focus-in flex-wrap justify-center gap-x-10 gap-y-4 [animation-delay:120ms] md:justify-start">
                {facts.filter((fact) => fact.label !== t('person.knownFor')).map((fact) => (
                  <div key={fact.label}>
                    <dt className="text-[12.5px] text-white/50">{fact.label}</dt>
                    <dd className="mt-0.5 text-[15px] font-medium text-white/90">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
        {person.biography && (
          <div className="page-x mt-12">
            <div className="max-w-[72ch]">
              <h2 className="mb-3 font-display text-[21px] font-bold sm:text-[26px]">{t('person.biography')}</h2>
              <ExpandableText text={person.biography} />
            </div>
          </div>
        )}
      </section>

      {knownFor.length > 0 && <PosterSlider title={t('person.knownForRow')} items={knownFor} kind="mixed" />}

      {timeline.length > 0 && (
        <section aria-label={t('person.filmography')} className="page-x">
          <h2 className="mb-6 font-display text-[21px] font-bold sm:text-[26px]">{t('person.filmography')}</h2>
          <Filmography credits={timeline} />
        </section>
      )}
    </div>
  )
}
