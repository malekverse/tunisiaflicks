"use client"

// One lookup per title per page load, shared by every card, preview and hero asking for it.
const keyCache = new Map<string, Promise<string | null>>()

/** The YouTube key of a title's trailer (null when it has none), via /api/trailer. */
export function fetchTrailerKey(type: 'movie' | 'tv', id: string) {
  const cacheKey = `${type}-${id}`
  let pending = keyCache.get(cacheKey)
  if (!pending) {
    pending = fetch(`/api/trailer?type=${type}&id=${id}`)
      .then((response) => (response.ok ? response.json() : { key: null }))
      .then((data) => data.key ?? null)
      .catch(() => null)
    keyCache.set(cacheKey, pending)
  }
  return pending
}
