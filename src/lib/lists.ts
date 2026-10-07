import { tmdbFetchSafe } from '@/src/lib/tmdb'

// TMDB only serves the first 500 pages of any list.
const MAX_PAGES = 500

export const parsePage = (value: string | string[] | undefined) => {
  const page = Number(Array.isArray(value) ? value[0] : value)
  return Number.isInteger(page) && page >= 1 ? Math.min(page, MAX_PAGES) : 1
}

export async function getList(path: string, page: number, params: Record<string, string | number | boolean | undefined> = {}) {
  const data = await tmdbFetchSafe<{ results: any[], total_pages: number }>(path, { ...params, page })
  return {
    results: data?.results ?? [],
    totalPages: Math.min(data?.total_pages ?? 1, MAX_PAGES),
    failed: data === null,
  }
}
