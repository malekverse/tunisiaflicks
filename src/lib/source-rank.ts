// Which stream source to try first, for this title. Pure rules (tests/source-rank.unit.test.mts),
// used by the player (hooks/use-stream-source): what worked for this viewer on this very title
// first, then what other viewers say plays this title, then what plays well in general.
//
// Sources work or fail title by title (one has a film, another doesn't; one is blocked for a show),
// which is why the crowd's word on the title outranks a source's overall health.

export type Status = 'good' | 'down' | 'unknown'
export type Counts = { ok: number, broken: number }

/** A title's word on a source: fewer reports are enough than for a source in general. */
export function titleStatus({ ok, broken }: Counts): Status {
  const total = ok + broken
  if (broken >= 3 && broken / total >= 0.7) return 'down'
  if (ok >= 2 && ok / total >= 0.6) return 'good'
  return 'unknown'
}

export type RankInput = {
  /** In the curated order (best first). */
  names: string[]
  /** Overall health of each source (lib/stream-health classify). */
  overall: Record<string, Status | undefined>
  /** What viewers reported for this title. */
  title: Record<string, Counts | undefined>
  /** The source that last worked for this viewer on this title. */
  mineHere: string | null
  /** The source that last worked for this viewer on anything. */
  mine: string | null
  /** Sources without pop-up ads (played sandboxed), and the desktop app's own player. */
  preferred: Set<string>
  /** Always first when present (the desktop app's local player). */
  pinned?: string | null
}

const score = (counts: Counts | undefined) => (counts ? (counts.ok + 1) / (counts.ok + counts.broken + 2) : 0.5)

/** The sources in the order to show them, and the one to start on. */
export function rankSources(input: RankInput): { order: string[], start: string | null, reason: 'mineHere' | 'title' | 'mine' | 'default' | null } {
  const { names, overall, title, mineHere, mine, preferred, pinned } = input
  const statusHere = (name: string) => titleStatus(title[name] ?? { ok: 0, broken: 0 })
  const tier = (name: string) => {
    if (name === pinned) return 0
    if (name === mineHere && statusHere(name) !== 'down') return 1
    if (statusHere(name) === 'good') return 2
    if (statusHere(name) === 'down' || overall[name] === 'down') return 5
    return preferred.has(name) ? 3 : 4
  }
  const curated = new Map(names.map((name, index) => [name, index]))
  const order = [...names].sort((a, b) =>
    tier(a) - tier(b)
    // Among the titles' good ones: the best record first.
    || (tier(a) === 2 ? score(title[b]) - score(title[a]) : 0)
    || curated.get(a)! - curated.get(b)!)

  if (!order.length) return { order, start: null, reason: null }
  const first = order[0]
  if (first === pinned) return { order, start: first, reason: 'default' }
  if (mineHere && order.includes(mineHere) && statusHere(mineHere) !== 'down') return { order, start: mineHere, reason: 'mineHere' }
  if (statusHere(first) === 'good') return { order, start: first, reason: 'title' }
  // Nothing known about this title: the viewer's usual source, unless it fails here.
  if (mine && order.includes(mine) && statusHere(mine) !== 'down' && overall[mine] !== 'down') return { order, start: mine, reason: 'mine' }
  return { order, start: first, reason: 'default' }
}

/** "movie:550" or "tv:1399" (a show as a whole: sources have a show or don't). */
export const TITLE_KEY_RE = /^(movie|tv):\d{1,9}$/
export const isTitleKey = (value: unknown): value is string => typeof value === 'string' && TITLE_KEY_RE.test(value)
