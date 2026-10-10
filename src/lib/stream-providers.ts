// Third-party embed / download providers, keyed by TMDB id. Server only.
//
// This is the single place sources come from: every movie and TV page reads its templates from
// here (getProviderTemplates) and hands them to the player, which fills in the title and episode
// (fillProviders in lib/media-assets). Each provider builds its own URL for a movie or a TV episode
// (providers disagree on how the season/episode is passed: some use a path, some a query string).
//
// These are external services the app does not control; any of them can change or go down, which
// is why the player lets the viewer switch between several, and why the list can change without
// touching the code (Vercel → Settings → Environment Variables, then redeploy):
//
// - STREAM_PROVIDERS: the whole list, as JSON, best first. `{id}`, `{season}` and `{episode}`
//   are filled in:
//   [{"name":"VidSrc","movie":"https://vidsrc.to/embed/movie/{id}","tv":"https://vidsrc.to/embed/tv/{id}/{season}/{episode}"}]
//   An entry can add `"sandbox": true` (see ProviderTemplate.sandbox).
// - STREAM_PROVIDERS_OFF: names to switch off, comma-separated (e.g. "2Embed,MultiEmbed").
//
// Both are read on the server only (a client bundle never sees them, which is why the pages pass
// the templates down as props instead of the player importing this file).
//
// The order also fixes itself: sources viewers report as broken move to the end of the player's
// list (lib/stream-health).
import 'server-only'

export type MediaType = 'movie' | 'tv'

export type StreamProvider = { name: string; url: string; sandbox?: boolean }

/** A provider as URL templates: `{id}` (and for TV `{season}`, `{episode}`) get filled in. */
export type ProviderTemplate = {
  name: string
  movie: string
  tv: string
  /**
   * The player still plays inside a sandboxed iframe (scripts, but no pop-up windows and no
   * redirecting the page), so its pop-up and redirect ads can't open. Most providers detect the
   * sandbox and refuse to play, so only set it on one that was tried sandboxed and played.
   */
  sandbox?: boolean
}

// Ordered best-first; the first one is selected by default.
//
// The set was probed for reachability + a real player payload (2026). Dead/unreachable providers
// (embed.su, AutoEmbed) and one that returned an in-player 500 (VidFast) were removed. These are
// client-rendered, region-gated players, so availability varies by the viewer's network — hence
// several sources to switch between. If one stops working, drop it here; the UI updates everywhere.
//
// `sandbox`: tried in a sandboxed iframe (October 2026, The Matrix and Game of Thrones S1E1), only
// Vidzee played. VidSrc, VidLink, VidSrc.su, 2Embed and MultiEmbed showed a "sandbox not allowed"
// screen, and VidSrc.rip redirected to an unrelated site with or without it.
const BUILT_IN: ProviderTemplate[] = [
  { name: 'VidSrc', movie: 'https://vidsrc.to/embed/movie/{id}', tv: 'https://vidsrc.to/embed/tv/{id}/{season}/{episode}' },
  { name: 'VidLink', movie: 'https://vidlink.pro/movie/{id}', tv: 'https://vidlink.pro/tv/{id}/{season}/{episode}' },
  { name: 'Vidzee', movie: 'https://player.vidzee.wtf/embed/movie/{id}', tv: 'https://player.vidzee.wtf/embed/tv/{id}/{season}/{episode}', sandbox: true },
  { name: 'VidSrc.su', movie: 'https://vidsrc.su/embed/movie/{id}', tv: 'https://vidsrc.su/embed/tv/{id}/{season}/{episode}' },
  { name: 'VidSrc.rip', movie: 'https://vidsrc.rip/embed/movie/{id}', tv: 'https://vidsrc.rip/embed/tv/{id}/{season}/{episode}' },
  { name: '2Embed', movie: 'https://www.2embed.cc/embed/{id}', tv: 'https://www.2embed.cc/embedtv/{id}&s={season}&e={episode}' },
  { name: 'MultiEmbed', movie: 'https://multiembed.mov/?video_id={id}&tmdb=1', tv: 'https://multiembed.mov/?video_id={id}&tmdb=1&s={season}&e={episode}' },
]

type Template = { name?: unknown, movie?: unknown, tv?: unknown, sandbox?: unknown }

/** STREAM_PROVIDERS, if it's set and valid; otherwise null (and the built-in list is used). */
function fromEnv(raw: string | undefined): ProviderTemplate[] | null {
  if (!raw?.trim()) return null
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error('not an array')
    const list = (parsed as Template[]).flatMap((item): ProviderTemplate[] => {
      const { name, movie, tv, sandbox } = item ?? {}
      const valid = typeof name === 'string' && name.trim() && typeof movie === 'string' && typeof tv === 'string'
        && movie.startsWith('https://') && tv.startsWith('https://') && movie.includes('{id}') && tv.includes('{id}')
        && (sandbox === undefined || typeof sandbox === 'boolean')
      if (!valid) {
        console.error('STREAM_PROVIDERS: skipped an entry without a name and https movie/tv templates containing {id} (and an optional boolean sandbox):', item)
        return []
      }
      return [{ name: name.trim(), movie, tv, ...(sandbox ? { sandbox: true } : {}) }]
    })
    return list.length ? list : null
  } catch (error) {
    console.error('STREAM_PROVIDERS is not valid JSON; using the built-in sources:', error)
    return null
  }
}

let memo: { key: string, list: ProviderTemplate[] } | null = null

/**
 * The stream sources as templates, best first: STREAM_PROVIDERS (or the built-in list) without
 * the names in STREAM_PROVIDERS_OFF. Read from the environment on every call (memoised while it
 * doesn't change), so a test or a redeploy with new values takes effect.
 */
export function getProviderTemplates(): ProviderTemplate[] {
  const raw = process.env.STREAM_PROVIDERS ?? ''
  const offRaw = process.env.STREAM_PROVIDERS_OFF ?? ''
  const key = `${raw}\n${offRaw}`
  if (memo?.key === key) return memo.list
  const off = new Set(offRaw.split(',').map((name) => name.trim().toLowerCase()).filter(Boolean))
  const list = (fromEnv(raw) ?? BUILT_IN).filter((provider) => !off.has(provider.name.toLowerCase()))
  memo = { key, list }
  return list
}

/** Names of all providers (for validating health reports). */
export function providerNames(): readonly string[] {
  return getProviderTemplates().map((provider) => provider.name)
}

/** Names of all providers, as configured when the server started (kept for older callers). */
export const PROVIDER_NAMES: readonly string[] = providerNames()
