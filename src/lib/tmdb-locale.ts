// The catalogue in the viewer's language (server only: it calls TMDB).
//
// How much of TMDB follows the interface language:
// - English: everything is TMDB's English.
// - Arabic and Derja: overviews, genre and season names in Arabic where TMDB has them; titles and
//   artwork stay as they are (Tunisians mostly know a film by its English or original title).
// - French: titles, overviews, genre and season names and posters in French where TMDB has them,
//   list rows included (`catalogueLanguage`); a tagline only in French (never the English one); and
//   a French title logo when the French title differs from the English one (or none, rather than an
//   English logo over a French title).
import { tmdbFetchSafe, tmdbLanguage, withTranslatedFields } from '@/src/lib/tmdb'
import { localGenreName } from '@/src/lib/genres'
import { DEFAULT_LOCALE, type Locale } from '@/src/lib/i18n/locales'

type Kind = 'movie' | 'tv' | 'person'

/** TMDB's records are English already: nothing to lay over them. */
const isBase = (l: Locale) => l === DEFAULT_LOCALE

/** TMDB `language` for list rows and search (French titles), or undefined to keep TMDB's English. */
export function catalogueLanguage(l: Locale): string | undefined {
  return l === 'fr' ? tmdbLanguage(l) : undefined
}

/** `include_image_language` for a title page: French logos too in French. */
export function logoLanguages(l: Locale): string {
  return l === 'fr' ? 'fr,en,null' : 'en,null'
}

/**
 * The title (or person) in the viewer's language, to lay over the English record with
 * `localizeDetail`. Null in English, for an invalid id, or when TMDB can't be reached.
 */
export async function translatedRecord(kind: Kind, id: string, l: Locale, ttl = 3600): Promise<any | null> {
  if (isBase(l) || !/^\d+$/.test(String(id))) return null
  return tmdbFetchSafe(`${kind}/${id}`, { language: tmdbLanguage(l) }, ttl)
}

const titleOf = (record: any): string => record?.title || record?.name || ''

/** French genre names win over TMDB's ('Policier', 'Guerre et politique'). */
function frenchGenres(genres: any[] | undefined, l: Locale) {
  return genres?.map((genre) => ({ ...genre, name: localGenreName(genre.id, l) ?? genre.name }))
}

/**
 * The English TMDB record `en` with the translated fields of `tr` (from translatedRecord) laid over
 * it. TMDB answers '' or [] when a translation is missing, so those fields keep their English
 * value. Arabic: overview and genres. French: title, name, overview, genres, poster and biography,
 * the French tagline or none, plus the logo rule. Season names in both.
 */
export function localizeDetail<T extends Record<string, any>>(en: T, tr: any | null, l: Locale): T {
  if (!en || isBase(l)) return en
  const french = l === 'fr'
  if (!tr) return french ? ({ ...en, genres: frenchGenres(en.genres, l) ?? en.genres } as T) : en

  const fields = french
    ? ['title', 'name', 'overview', 'tagline', 'genres', 'poster_path', 'biography']
    : ['overview', 'genres', 'biography']
  const result: Record<string, any> = withTranslatedFields<Record<string, any>>(en, tr, fields)
  if (french && result.genres) result.genres = frenchGenres(result.genres, l)
  // A tagline is a line of copy, not information: TMDB's French one or none, never the English
  // line in French quotation marks.
  if (french && 'tagline' in en) result.tagline = typeof tr.tagline === 'string' ? tr.tagline.trim() : ''

  // Season names ("Saison 1", "الموسم 1"); their posters stay the English ones.
  if (Array.isArray(en.seasons) && Array.isArray(tr.seasons)) {
    const names = new Map<number, string>(tr.seasons.map((season: any) => [season.id, season.name]))
    result.seasons = en.seasons.map((season: any) => ({ ...season, name: names.get(season.id) || season.name }))
  }

  // The logo spells the title: in French, a French logo; an English one only if the French title is
  // the English one (e.g. "Fight Club"); otherwise none, and the page shows the French title in type.
  const logos: any[] | undefined = en.images?.logos
  if (french && Array.isArray(logos)) {
    const frenchLogos = logos.filter((logo) => logo.iso_639_1 === 'fr')
    const sameTitle = titleOf(result).trim().toLowerCase() === titleOf(en).trim().toLowerCase()
    result.images = { ...en.images, logos: frenchLogos.length > 0 ? frenchLogos : sameTitle ? logos : [] }
  }
  return result as T
}

/** The genre list of movies or TV in the viewer's language (cached a day). */
export async function genreList(kind: 'movie' | 'tv', l: Locale): Promise<{ id: number, name: string }[]> {
  const data = await tmdbFetchSafe<{ genres: { id: number, name: string }[] }>(`genre/${kind}/list`, { language: tmdbLanguage(l) }, 86400)
  return (data?.genres ?? []).map((genre) => ({ id: genre.id, name: localGenreName(genre.id, l) ?? genre.name }))
}
