// The ways to pick a film, in one list: the menu's "Pick a film" group, the home page's shelf, the
// search palette and the "More ways to pick" strip at the bottom of each of these pages all read
// from here, so a new one shows up everywhere at once.
import { Drama, Gift, HeartHandshake, Music, Puzzle, ShipWheel, type LucideIcon } from 'lucide-react'
import type { TKey } from '@/src/lib/i18n'

export type PlayTool = {
  href: string
  icon: LucideIcon
  label: TKey
  /** One line: what it is for. */
  text: TKey
  /** Words people may type in search to find it (any language), space-separated. */
  keywords: TKey
  /** Shows a "New" badge until then (YYYY-MM-DD). */
  newUntil?: string
}

export const PLAY_TOOLS: PlayTool[] = [
  { href: '/decide', icon: ShipWheel, label: 'decide.title', text: 'play.decide.text', keywords: 'play.decide.keywords', newUntil: '2027-01-10' },
  { href: '/swipe', icon: HeartHandshake, label: 'swipe.title', text: 'play.swipe.text', keywords: 'play.swipe.keywords' },
  { href: '/blind-date', icon: Gift, label: 'blindDate.chip', text: 'play.blindDate.text', keywords: 'play.blindDate.keywords', newUntil: '2027-01-10' },
  { href: '/guess', icon: Puzzle, label: 'guess.title', text: 'play.guess.text', keywords: 'play.guess.keywords', newUntil: '2027-01-10' },
  { href: '/guess/music', icon: Music, label: 'guessMusic.title', text: 'play.guessMusic.text', keywords: 'play.guessMusic.keywords', newUntil: '2027-02-01' },
  { href: '/guess/actor', icon: Drama, label: 'guessActor.title', text: 'play.guessActor.text', keywords: 'play.guessActor.keywords', newUntil: '2027-02-15' },
]

export const isNewTool = (tool: Pick<PlayTool, 'newUntil'>, now = Date.now()) => !!tool.newUntil && now < Date.parse(`${tool.newUntil}T00:00:00Z`)

/** Search: does what was typed name this tool (its name, or one of its words)? */
export function toolMatches(query: string, words: string): boolean {
  const fold = (value: string) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase().trim()
  const q = fold(query)
  if (q.length < 3) return false
  return fold(words).split(/\s+/).some((word) => word.startsWith(q) || (q.length >= 4 && q.includes(word) && word.length >= 4))
}
