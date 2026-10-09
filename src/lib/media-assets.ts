// Picking the right artwork, video and stream URLs for a TMDB title (pure helpers, safe on server
// and client).
import type { ProviderTemplate, StreamProvider } from '@/src/lib/stream-providers'

type Video = { site?: string, key?: string, type?: string, official?: boolean, iso_639_1?: string | null }

/** The trailer languages to look for first, by UI locale: Arabic in Arabic and Derja, then French, then English. */
export function trailerLanguages(locale: string): string[] {
  if (locale === 'ar' || locale === 'tn') return ['ar', 'en']
  if (locale === 'fr') return ['fr', 'en']
  return ['en']
}

const bestOf = (videos: Video[]) =>
  videos.find((video) => video.type === 'Trailer' && video.official)
  ?? videos.find((video) => video.type === 'Trailer')
  ?? videos.find((video) => video.type === 'Teaser')

/**
 * YouTube key of the official trailer (or any trailer, or a teaser). With `prefer` (languages, best
 * first, see trailerLanguages), a trailer in one of those languages wins over the rest; without it,
 * the first one TMDB lists, as before.
 */
export function pickTrailer(videos: any[] = [], prefer?: string[]): string | null {
  const youtube: Video[] = (videos ?? []).filter((video) => video?.site === 'YouTube' && video.key)
  for (const language of prefer ?? []) {
    const match = bestOf(youtube.filter((video) => video.iso_639_1 === language))
    if (match) return match.key ?? null
  }
  return bestOf(youtube)?.key ?? null
}

/** The English (or textless) title-treatment logo, with its width/height ratio. */
export function pickLogo(logos: any[] = []): { path: string, ratio: number } | null {
  const logo = logos.find((item) => item.iso_639_1 === 'en') ?? logos[0]
  return logo ? { path: logo.file_path, ratio: logo.aspect_ratio || 3 } : null
}

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(id|season|episode)\}/g, (_, key: string) => encodeURIComponent(String(values[key])))

/**
 * The player's sources for a title, from the templates the page got on the server
 * (getProviderTemplates). For a TV episode `season`/`episode` default to 1 so every URL is
 * well-formed before the viewer has picked one (the player stays disabled until they do).
 */
export function fillProviders(templates: ProviderTemplate[], type: 'movie' | 'tv', id: string, season = 1, episode = 1): StreamProvider[] {
  return templates.map((template) => ({
    name: template.name,
    url: type === 'movie' ? fill(template.movie, { id }) : fill(template.tv, { id, season, episode }),
  }))
}
