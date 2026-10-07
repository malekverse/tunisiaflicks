// "Recent searches", kept in this browser only (localStorage). Never sent anywhere.
const KEY = 'tf-recent-searches'
const MAX = 8

export function getRecentSearches(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((item) => typeof item === 'string').slice(0, MAX) : []
  } catch {
    return []
  }
}

function save(list: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))) } catch { /* private mode */ }
}

/** Puts `query` first (case-insensitive de-duplication). */
export function addRecentSearch(query: string): string[] {
  const clean = query.trim().slice(0, 80)
  if (!clean) return getRecentSearches()
  const list = [clean, ...getRecentSearches().filter((item) => item.toLowerCase() !== clean.toLowerCase())]
  save(list)
  return list.slice(0, MAX)
}

export function removeRecentSearch(query: string): string[] {
  const list = getRecentSearches().filter((item) => item !== query)
  save(list)
  return list
}

export function clearRecentSearches(): string[] {
  save([])
  return []
}
