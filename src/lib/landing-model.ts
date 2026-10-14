// The landing page's data (built by lib/landing on the server, drawn by components/landing).
// Types and tiny helpers only, so client components can import it.
import type { TKey } from '@/src/lib/i18n'
import { tmdbImageUrl } from '@/src/lib/tmdb-image'

/** A picture: a TMDB poster path, or a full URL (Tunisian titles, anime covers, TV thumbnails). */
export type Pic = { title: string, tmdb?: string, src?: string }

export type ReelId = 'movies' | 'series' | 'anime' | 'turkish' | 'korean' | 'arab' | 'ramadan' | 'tunisian'

export type Countdown = { phase: 'before', days: number, year: number } | { phase: 'during', day: number, year: number }

export type LandingData = {
  /** The hero's poster wall: today's trending films and series. */
  wall: Pic[]
  /** The catalogue's words, in order, with their pictures (a word without enough is left out). */
  reels: { id: ReelId, pics: Pic[] }[]
  tunisia: {
    series: Pic[]
    tv: Pic[]
    /** A Tunisian channel is live right now. */
    live: boolean
    cinema: Pic[]
    ramadan: Pic[]
    countdown: Countdown
    /** The Arab cinema map's tiles: grid place, name, how lit (0 to 1). */
    countries: { code: string, x: number, y: number, name: string, glow: number }[]
  }
  halal: { row: (Pic & { hidden: boolean })[], viewerOn: boolean }
  swipe: Pic[]
  ask: { query: TKey, pics: Pic[] }[]
  night: Pic[]
  wrapped: Pic[]
  /** A series to show in Continue Watching. */
  resume: { title: string, backdrop: string } | null
}

/** The picture's address at about `width` CSS pixels. */
export function picUrl(pic: Pic, width: number): string {
  return pic.tmdb ? tmdbImageUrl(pic.tmdb, 'poster', width) : pic.src ?? ''
}

/** Each word's page, and its light ('r g b'). */
export const REELS: Record<ReelId, { href: string, light: string }> = {
  movies: { href: '/', light: '255 36 20' },
  series: { href: '/tv', light: '168 85 247' },
  anime: { href: '/anime', light: '236 72 153' },
  turkish: { href: '/dramas/turkish', light: '40 196 184' },
  korean: { href: '/dramas/korean', light: '104 124 255' },
  arab: { href: '/arab-cinema', light: '200 162 122' },
  ramadan: { href: '/ramadan', light: '245 190 80' },
  tunisian: { href: '/tunisian', light: '30 110 255' },
}
