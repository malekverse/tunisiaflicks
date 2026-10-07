'use server'

import { getMovieDownloads, getTvDownloads, type DownloadOption } from '@/src/lib/downloads'

export type DownloadQuery =
  | { type: 'movie'; imdbId: string }
  | { type: 'tv'; imdbId: string; season: number; episode: number }

/** Resolve download sources for a title. Returns [] (never throws) when nothing is available. */
export async function getDownloads(query: DownloadQuery): Promise<DownloadOption[]> {
  if (!query.imdbId) return []
  if (query.type === 'movie') return getMovieDownloads(query.imdbId)
  return getTvDownloads(query.imdbId, query.season, query.episode)
}
