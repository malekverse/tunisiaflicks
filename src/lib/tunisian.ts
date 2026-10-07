import { JSDOM } from 'jsdom'

// The Tunisian catalogue comes from the source site's public Blogger JSON feed. Unlike scraping
// its HTML, the feed has a stable, documented shape, so a redesign of the site's pages won't break it.
const SOURCE = new URL('https://www.tunigazelle-news.xyz')
const FEED_URL = `${SOURCE.origin}/feeds/posts/default?alt=json&max-results=200`
const REVALIDATE = 1800

export type TunisianKind = 'movie' | 'series'

export type TunisianTitle = {
  /** Route segment of the post, e.g. `2026/09/last-chance` (the blog path without `.html`). */
  slug: string
  title: string
  kind: TunisianKind
  poster: string | null
  /** The post on the source site. */
  url: string
  published: string
}

export type TunisianEpisode = { label: string, url: string }
export type TunisianSeason = { season: number, episodes: TunisianEpisode[] }

export type TunisianDetail = TunisianTitle & {
  description: string
  badges: string[]
  backdrop: string | null
  seasons: TunisianSeason[]
}

type FeedEntry = {
  title: { $t: string }
  published: { $t: string }
  link: { rel: string, href: string }[]
  category?: { term: string }[]
  content?: { $t: string }
  media$thumbnail?: { url: string }
}

// Only ever link to / parse pages of the source site.
export function toSourceUrl(href: string | null | undefined): string | null {
  // Must look like a real link (absolute, or a path on the site): the source's unfinished
  // episodes carry text placeholders in `href`, which `new URL` would happily resolve as a path.
  if (!href || !/^(https?:\/\/|\/)/.test(href)) return null
  try {
    const url = new URL(href, SOURCE)
    return url.host === SOURCE.host && /^https?:$/.test(url.protocol) ? url.toString() : null
  } catch {
    return null
  }
}

// Blogger image URLs carry their size in the path (`/s72-c/`, `/s1600/`): ask for a card-sized one.
const resizePoster = (url: string | null | undefined, size = 400) =>
  url ? url.replace(/\/s\d+(-c)?\//, `/s${size}/`) : null

const slugOf = (url: string) => {
  const match = new URL(url).pathname.match(/^\/(\d{4})\/(\d{2})\/([^/]+)\.html$/)
  return match ? `${match[1]}/${match[2]}/${match[3]}` : null
}

function toTitle(entry: FeedEntry): TunisianTitle | null {
  const categories = (entry.category ?? []).map((category) => category.term)
  const kind: TunisianKind | null = categories.includes('series') ? 'series' : categories.includes('movie') ? 'movie' : null
  const url = toSourceUrl(entry.link.find((link) => link.rel === 'alternate')?.href)
  const slug = url ? slugOf(url) : null
  if (!kind || !url || !slug) return null // matches, pages and anything else that isn't a title

  return {
    slug,
    title: entry.title.$t.trim(),
    kind,
    poster: resizePoster(entry.media$thumbnail?.url),
    url,
    published: entry.published.$t,
  }
}

async function fetchEntries(): Promise<FeedEntry[] | null> {
  try {
    const res = await fetch(FEED_URL, { next: { revalidate: REVALIDATE } })
    if (!res.ok) throw new Error(`Source feed responded with ${res.status}`)
    const json = await res.json()
    return json?.feed?.entry ?? []
  } catch (error) {
    console.error('Error loading the Tunisian feed:', error)
    return null
  }
}

/** All series and movies, newest first. `null` when the source can't be reached. */
export async function getTunisianTitles(): Promise<TunisianTitle[] | null> {
  const entries = await fetchEntries()
  if (!entries) return null
  return entries.map(toTitle).filter((title): title is TunisianTitle => title !== null)
}

/** One title with its description and, for series, its seasons and episodes. */
export async function getTunisianDetail(slug: string): Promise<TunisianDetail | null | undefined> {
  const entries = await fetchEntries()
  if (!entries) return undefined // source unavailable (as opposed to "no such title")

  const entry = entries.find((item) => {
    const title = toTitle(item)
    return title?.slug === slug
  })
  const base = entry && toTitle(entry)
  if (!entry || !base) return null

  const document = new JSDOM(`<body>${entry.content?.$t ?? ''}</body>`).window.document

  const backdropStyle = document.querySelector('.detail-hero-backdrop')?.getAttribute('style') ?? ''
  const seasons: TunisianSeason[] = []
  document.querySelectorAll('.season-grid').forEach((grid, index) => {
    const episodes: TunisianEpisode[] = []
    grid.querySelectorAll('a.episode-item').forEach((anchor) => {
      const url = toSourceUrl(anchor.getAttribute('href'))
      // The source site leaves "put the link here" placeholders for episodes that aren't out yet.
      if (url) episodes.push({ label: anchor.textContent?.trim() || `Episode ${episodes.length + 1}`, url })
    })
    if (episodes.length > 0) {
      seasons.push({ season: Number(grid.getAttribute('data-season')) || index + 1, episodes })
    }
  })

  const badges: string[] = []
  document.querySelectorAll('.detail-badge').forEach((badge) => {
    const text = badge.textContent?.trim()
    if (text) badges.push(text)
  })

  return {
    ...base,
    poster: resizePoster(document.querySelector('.detail-poster img')?.getAttribute('src') ?? base.poster, 600),
    description: document.querySelector('.detail-description')?.textContent?.trim() ?? '',
    badges,
    backdrop: resizePoster(backdropStyle.match(/url\(['"]?([^'")]+)/)?.[1], 1280),
    seasons,
  }
}
