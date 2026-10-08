// Third-party embed / download providers, keyed by TMDB id.
//
// This is the single place sources come from: every movie and TV page reads from here. Each
// provider builds its own URL for a movie or a TV episode (providers disagree on how the
// season/episode is passed — some use a path, some a query string).
//
// These are external services the app does not control; any of them can change or go down, which
// is why the player lets the viewer switch between several, and why the list can change without
// touching the code (Vercel → Settings → Environment Variables, then redeploy):
//
// - STREAM_PROVIDERS: the whole list, as JSON, best first. `{id}`, `{season}` and `{episode}`
//   are filled in:
//   [{"name":"VidSrc","movie":"https://vidsrc.to/embed/movie/{id}","tv":"https://vidsrc.to/embed/tv/{id}/{season}/{episode}"}]
// - STREAM_PROVIDERS_OFF: names to switch off, comma-separated (e.g. "2Embed,MultiEmbed").
//
// The order also fixes itself: sources viewers report as broken move to the end of the player's
// list (lib/stream-health).

export type MediaType = 'movie' | 'tv'

export type StreamProvider = { name: string; url: string }

type Build = (id: string, season: number, episode: number) => string

type ProviderConfig = {
  name: string
  movie: (id: string) => string
  tv: Build
}

// Ordered best-first; the first one is selected by default.
//
// The set was probed for reachability + a real player payload (2026). Dead/unreachable providers
// (embed.su, AutoEmbed) and one that returned an in-player 500 (VidFast) were removed. These are
// client-rendered, region-gated players, so availability varies by the viewer's network — hence
// several sources to switch between. If one stops working, drop it here; the UI updates everywhere.
const BUILT_IN: ProviderConfig[] = [
  {
    name: 'VidSrc',
    movie: (id) => `https://vidsrc.to/embed/movie/${id}`,
    tv: (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}`,
  },
  {
    name: 'VidLink',
    movie: (id) => `https://vidlink.pro/movie/${id}`,
    tv: (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}`,
  },
  {
    name: 'Vidzee',
    movie: (id) => `https://player.vidzee.wtf/embed/movie/${id}`,
    tv: (id, s, e) => `https://player.vidzee.wtf/embed/tv/${id}/${s}/${e}`,
  },
  {
    name: 'VidSrc.su',
    movie: (id) => `https://vidsrc.su/embed/movie/${id}`,
    tv: (id, s, e) => `https://vidsrc.su/embed/tv/${id}/${s}/${e}`,
  },
  {
    name: 'VidSrc.rip',
    movie: (id) => `https://vidsrc.rip/embed/movie/${id}`,
    tv: (id, s, e) => `https://vidsrc.rip/embed/tv/${id}/${s}/${e}`,
  },
  {
    name: '2Embed',
    movie: (id) => `https://www.2embed.cc/embed/${id}`,
    tv: (id, s, e) => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`,
  },
  {
    name: 'MultiEmbed',
    movie: (id) => `https://multiembed.mov/?video_id=${id}&tmdb=1`,
    tv: (id, s, e) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}`,
  },
]

type Template = { name?: unknown, movie?: unknown, tv?: unknown }

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(id|season|episode)\}/g, (_, key: string) => encodeURIComponent(String(values[key])))

/** STREAM_PROVIDERS, if it's set and valid; otherwise null (and the built-in list is used). */
function fromEnv(): ProviderConfig[] | null {
  const raw = process.env.STREAM_PROVIDERS?.trim()
  if (!raw) return null
  try {
    const list = (JSON.parse(raw) as Template[]).flatMap((item): ProviderConfig[] => {
      const { name, movie, tv } = item ?? {}
      const valid = typeof name === 'string' && name.trim() && typeof movie === 'string' && typeof tv === 'string'
        && movie.startsWith('https://') && tv.startsWith('https://') && movie.includes('{id}') && tv.includes('{id}')
      if (!valid) {
        console.error('STREAM_PROVIDERS: skipped an entry without a name and https movie/tv templates containing {id}:', item)
        return []
      }
      return [{ name: name.trim(), movie: (id) => fill(movie, { id }), tv: (id, season, episode) => fill(tv, { id, season, episode }) }]
    })
    return list.length ? list : null
  } catch (error) {
    console.error('STREAM_PROVIDERS is not valid JSON; using the built-in sources:', error)
    return null
  }
}

const OFF = new Set((process.env.STREAM_PROVIDERS_OFF ?? '').split(',').map((name) => name.trim().toLowerCase()).filter(Boolean))
const PROVIDERS: ProviderConfig[] = (fromEnv() ?? BUILT_IN).filter((provider) => !OFF.has(provider.name.toLowerCase()))

/**
 * Stream sources for a title. For a movie, `season`/`episode` are ignored; for a TV episode they
 * default to 1 so every URL is well-formed even before the viewer has picked an episode (the
 * player stays disabled until they do).
 */
export function getStreamProviders(type: MediaType, id: string, season = 1, episode = 1): StreamProvider[] {
  return PROVIDERS.map((provider) => ({
    name: provider.name,
    url: type === 'movie' ? provider.movie(id) : provider.tv(id, season, episode),
  }))
}

/** Names of all providers (for validating health reports). */
export const PROVIDER_NAMES: readonly string[] = PROVIDERS.map((provider) => provider.name)
