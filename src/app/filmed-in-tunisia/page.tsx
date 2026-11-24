import FilmedInTunisia, { type FilmedFilmCard } from '@/src/components/filmed/FilmedInTunisia'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { pageMetadata } from '@/src/lib/seo'
import { tmdbFetchSafe } from '@/src/lib/tmdb'
import { catalogueLanguage } from '@/src/lib/tmdb-locale'
import { getHalalMode, getKidsMode } from '@/src/lib/profiles'
import { filterKidSafe } from '@/src/lib/kids'
import { filmIds, PLACES } from '@/src/lib/filmed-in-tunisia'

// Filmed in Tunisia (lib/filmed-in-tunisia): the places, and their films from TMDB (a week's cache,
// shared). A Kids profile only sees the places of films it may watch, Halal mode the ones it keeps.
const WEEK = 7 * 86400

export function generateMetadata() {
  const t = getT()
  return pageMetadata({ title: t('filmed.title'), description: t('filmed.subtitle'), path: '/filmed-in-tunisia', card: 'tunisian' })
}

export default async function FilmedInTunisiaPage() {
  const locale = getLocale()
  const [kids, halal] = await Promise.all([getKidsMode().catch(() => false), getHalalMode().catch(() => false)])
  let films = (await Promise.all(filmIds().map((id) =>
    tmdbFetchSafe<any>(`movie/${id}`, { language: catalogueLanguage(locale) }, WEEK, { shared: true })))).filter((film) => film?.id)
  if (kids) films = await filterKidSafe(films, 'movie')
  if (halal) {
    const { filterHalal } = await import('@/src/lib/halal')
    films = await filterHalal(films, 'movie', { on: true })
  }
  const cards: Record<number, FilmedFilmCard> = {}
  for (const film of films) {
    cards[film.id] = {
      id: film.id,
      title: String(film.title || film.original_title),
      year: typeof film.release_date === 'string' ? film.release_date.slice(0, 4) : '',
      backdrop: film.backdrop_path ?? null,
      poster: film.poster_path ?? null,
    }
  }
  const places = PLACES
    .map((place) => ({ ...place, films: place.films.filter((film) => cards[film.tmdb]) }))
    .filter((place) => place.films.length > 0)
  return <FilmedInTunisia places={places} films={cards} />
}
