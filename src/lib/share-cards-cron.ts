// The `share-cards` cron job (/api/cron/share-cards): draws ahead the share cards of the titles
// people are most likely to share (this week's trending and popular films and series), so the
// first link shared to one already has its card kept (lib/share-image-store) instead of the brand
// card standing in while it's drawn.
//
// It asks the site for each missing card, a few at a time (each ask draws and keeps it, in the
// background past the answer budget), and stops before its time budget; `more` when cards are left.
import { tmdbFetchSafe } from '@/src/lib/tmdb'
import { keptKeys } from '@/src/lib/share-image-store'
import { SITE_URL } from '@/src/lib/seo'

const LISTS = ['trending/movie/day', 'trending/tv/day', 'trending/movie/week', 'trending/tv/week', 'movie/popular', 'tv/popular']
const AT_ONCE = 3
/** Time left for the last ask (it may wait for a drawing). */
const LAST_ASK_MS = 6000

/** 'movie/603'-style keys of the titles in these TMDB answers, in order, without repeats. */
export function titleKeys(answers: { path: string, json: { results?: any[] } | null }[]): string[] {
  return Array.from(new Set(answers.flatMap(({ path, json }) => (json?.results ?? []).flatMap((item: any) => {
    const kind = item?.media_type ?? (/(^|\/)tv(\/|$)/.test(path) ? 'tv' : 'movie')
    return (kind === 'movie' || kind === 'tv') && Number.isInteger(item?.id) ? [`${kind}/${item.id}`] : []
  }))))
}

export async function runShareCardsCron({ deadline }: { deadline: number }) {
  const answers = await Promise.all(LISTS.map((path) => tmdbFetchSafe<{ results?: any[] }>(path, {}, 3600, { shared: true }).then((json) => ({ path, json }))))
  const keys = titleKeys(answers)
  const kept = await keptKeys(keys)
  const queue = keys.filter((key) => !kept.has(key))

  let asked = 0
  let failed = 0
  await Promise.all(Array.from({ length: AT_ONCE }, async () => {
    while (queue.length && deadline - Date.now() > LAST_ASK_MS) {
      const key = queue.shift()!
      try {
        const response = await fetch(`${SITE_URL}/${key}/opengraph-image`, {
          headers: { 'User-Agent': 'TunisiaFlicks share-card warmer' },
          cache: 'no-store',
          signal: AbortSignal.timeout(LAST_ASK_MS - 500),
        })
        await response.arrayBuffer()
        if (response.ok) asked++
        else failed++
      } catch {
        failed++
      }
    }
  }))
  return { status: queue.length ? 'more' as const : 'done' as const, more: queue.length > 0 && asked > 0, titles: keys.length, alreadyKept: kept.size, asked, failed, left: queue.length }
}
