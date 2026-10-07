// Server-side TMDB helper. The API key only ever lives on the server (TMDB_API_KEY).
const BASE_URL = 'https://api.themoviedb.org/3'

export class TmdbError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'TmdbError'
  }
}

type Params = Record<string, string | number | boolean | undefined>

/**
 * GET a TMDB endpoint. Throws when the key is missing or TMDB answers with an error, so callers
 * decide whether to fail (detail pages) or degrade gracefully (home page rows).
 * Responses are cached by Next's data cache for `revalidate` seconds.
 */
export async function tmdbFetch<T = any>(path: string, params: Params = {}, revalidate = 3600): Promise<T> {
  const apiKey = process.env.TMDB_API_KEY
  if (!apiKey) {
    throw new Error('TMDB_API_KEY is not set')
  }

  const url = new URL(`${BASE_URL}/${path.replace(/^\//, '')}`)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('language', 'en-US')
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }

  const res = await fetch(url, { next: { revalidate } })
  if (!res.ok) {
    throw new TmdbError(res.status, `TMDB ${path} failed: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

/** Like `tmdbFetch`, but resolves to `null` instead of throwing (and logs the reason). */
export async function tmdbFetchSafe<T = any>(path: string, params: Params = {}, revalidate = 3600): Promise<T | null> {
  try {
    return await tmdbFetch<T>(path, params, revalidate)
  } catch (error) {
    console.error(error)
    return null
  }
}
