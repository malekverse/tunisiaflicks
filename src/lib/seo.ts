// Page metadata for search engines and link previews (WhatsApp, Facebook, Messenger, X, Telegram).
import type { Metadata } from 'next'
import type { ShareSection } from '@/src/lib/share-sections'

type OpenGraph = NonNullable<Metadata['openGraph']>

export const SITE_HOST = 'tunisiaflicks.vercel.app'
export const SITE_URL = `https://${SITE_HOST}`
export const SITE_NAME = 'TunisiaFlicks'
export const SITE_DESCRIPTION = "Movies, TV shows and Tunisian series in one place: what's trending today, trailers, a daily Top 10, Ramadan series and release alerts, in English and Arabic."

/** Search results and previews cut descriptions after ~160 characters: end on a whole word. */
export function clampDescription(text: string | null | undefined, max = 160): string | undefined {
  const clean = text?.replace(/\s+/g, ' ').trim()
  if (!clean) return undefined
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max * 0.6)).replace(/[\s,;:.–-]+$/, '')}…`
}

/**
 * Title, description, canonical URL and share card of a page, for every network at once.
 * Metadata merges shallowly: a page that sets `openGraph` replaces the layout's whole object, so
 * everything a preview needs is set here together.
 *
 * `card`: the section whose share card to show (default: home), or `false` when the route has its
 * own opengraph-image file (movies, shows, people, lists...).
 */
export function pageMetadata({ title, description, path, card = 'home', openGraph, noIndex }: {
  title: string
  description?: string | null
  path: string
  card?: ShareSection | false
  openGraph?: OpenGraph
  noIndex?: boolean
}): Metadata {
  const text = clampDescription(description)
  const images = card ? [{ url: `/og/${card}`, width: 1200, height: 630, alt: title }] : undefined
  return {
    title: `${title} | ${SITE_NAME}`,
    description: text,
    alternates: { canonical: path },
    openGraph: {
      siteName: SITE_NAME,
      locale: 'en_US',
      alternateLocale: ['ar_TN'],
      type: 'website',
      title,
      description: text,
      url: path,
      ...(images ? { images } : {}),
      ...openGraph,
    } as OpenGraph,
    twitter: { card: 'summary_large_image', title, description: text, ...(images ? { images } : {}) },
    ...(noIndex ? { robots: { index: false, follow: true } } : {}),
  }
}
