'use server'

import { getMovieDownloads, getTvDownloads, type DownloadOption } from '@/src/lib/downloads'

export type DownloadQuery =
  | { type: 'movie'; imdbId: string }
  /** `names`: the show's names (English, localized, original), to drop releases EZTV filed under
   *  the wrong show. */
  | { type: 'tv'; imdbId: string; season: number; episode: number; names?: string[] }

// A few short strings at most: they come from the client.
const MAX_NAMES = 4
const MAX_NAME_LENGTH = 200

const cleanNames = (names: unknown): string[] =>
  Array.isArray(names)
    ? names
      .filter((name): name is string => typeof name === 'string')
      .map((name) => name.trim().slice(0, MAX_NAME_LENGTH))
      .filter(Boolean)
      .slice(0, MAX_NAMES)
    : []

/** Resolve download sources for a title. Returns [] (never throws) when nothing is available. */
export async function getDownloads(query: DownloadQuery): Promise<DownloadOption[]> {
  if (!query.imdbId) return []
  if (query.type === 'movie') return getMovieDownloads(query.imdbId)
  return getTvDownloads(query.imdbId, query.season, query.episode, cleanNames(query.names))
}
