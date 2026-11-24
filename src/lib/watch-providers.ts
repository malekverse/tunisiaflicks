// Where a title is legally available in the viewer's country (Netflix, Shahid, OSN+…), from TMDB's
// watch/providers (data by JustWatch, which must be credited). The country is the viewer's
// (Vercel's x-vercel-ip-country), Tunisia when it's unknown. A country TMDB knows nothing about
// shows nothing: never another country's services. Pure, so it's unit-tested.

export type WatchProvider = { id: number, name: string, logo: string | null }

export type WatchOffers = {
  country: string
  /** TMDB's page of the offers (TMDB asks that the data link back to it). */
  link: string | null
  /** In a subscription, free, or free with ads. */
  stream: WatchProvider[]
  /** To rent or buy, not already in `stream`. */
  rentBuy: WatchProvider[]
}

export const DEFAULT_COUNTRY = 'TN'
const MAX_EACH = 8

/** The viewer's country from the request's header, Tunisia when there's none. */
export function viewerCountry(header: string | null | undefined): string {
  const code = (header ?? '').trim().toUpperCase()
  return /^[A-Z]{2}$/.test(code) && code !== 'XX' ? code : DEFAULT_COUNTRY
}

function providers(list: unknown): WatchProvider[] {
  if (!Array.isArray(list)) return []
  return list
    .filter((item) => item && typeof item === 'object' && Number.isInteger(item.provider_id) && typeof item.provider_name === 'string' && item.provider_name.trim())
    .sort((a, b) => (Number(a.display_priority) || 99) - (Number(b.display_priority) || 99))
    .map((item) => ({
      id: item.provider_id as number,
      name: (item.provider_name as string).trim().slice(0, 60),
      logo: typeof item.logo_path === 'string' && /^\/[A-Za-z0-9._-]+$/.test(item.logo_path) ? item.logo_path : null,
    }))
}

/** One of a kind, in order; and "X with Ads" folded into X when X is there already. */
function dedupe(list: WatchProvider[], taken = new Set<number>()): WatchProvider[] {
  const names = new Set<string>()
  const out: WatchProvider[] = []
  for (const item of list) {
    const base = item.name.replace(/\s+(standard\s+)?with\s+ads$/i, '').replace(/\s+amazon\s+channel$/i, '').toLowerCase()
    if (taken.has(item.id) || names.has(base)) continue
    taken.add(item.id)
    names.add(base)
    out.push(item)
  }
  return out.slice(0, MAX_EACH)
}

/** The offers in `country` from TMDB's watch/providers answer, or null when there are none. */
export function offersFor(answer: unknown, country: string): WatchOffers | null {
  const results = (answer as { results?: Record<string, any> } | null)?.results
  const here = results && typeof results === 'object' ? results[country] : null
  if (!here || typeof here !== 'object') return null
  const taken = new Set<number>()
  const stream = dedupe([...providers(here.flatrate), ...providers(here.free), ...providers(here.ads)], taken)
  const rentBuy = dedupe([...providers(here.rent), ...providers(here.buy)], taken)
  if (stream.length === 0 && rentBuy.length === 0) return null
  const link = typeof here.link === 'string' && /^https:\/\/www\.themoviedb\.org\//.test(here.link) ? here.link : null
  return { country, link, stream, rentBuy }
}
