// The shelf's model, from a stored badges document: everything the owner may see (earned, unseen,
// up next, the streak), or only what others may (earned public badges and the streak number).
// Pure, so the rules are unit-tested.
import { RAMADAN, toHijri } from '@/src/lib/hijri'
import {
  BADGES, PRIVATE_BADGES, badgesFor, isMaxLevel, nextStep, tierOf,
  type BadgeId, type Level, type Tier,
} from './catalogue'
import type { Streak } from './time'
import { tunisToday } from './time'

/** The stored fields the shelf reads (see BadgesDoc in ./db). */
export type StoredBadges = {
  disabled?: boolean
  earned?: Partial<Record<BadgeId, { level: number; at?: Date | string; levelAt?: Date | string; seenLevel?: number; announcedLevel?: number }>>
  progress?: Partial<Record<BadgeId, number>>
  streak?: Partial<Streak>
}

export type BadgeCard = {
  id: BadgeId
  level: Level
  tier: Tier | null
  /** Only in the owner view. */
  value?: number
  /** ISO dates, owner view only. */
  at?: string
  levelAt?: string
  /** Owner view: reached a level they haven't opened yet. */
  unseen?: boolean
  /** Owner view: what the next level asks for (null at the top). */
  next?: { target: number; level: Level } | null
  /** Owner view: never shown to anyone else. */
  onlyYou?: boolean
}

export type BadgesView = {
  view: 'owner' | 'public'
  kids: boolean
  disabled: boolean
  earned: BadgeCard[]
  /** Owner view: the closest next levels (three at most). */
  upNext: BadgeCard[]
  /** Weeks in a row (null for Kids, and when there's nothing worth showing). */
  streak: { current: number; best: number; thisWeek: boolean } | null
}

/** How many 'Up next' rows the shelf shows. */
export const UP_NEXT = 3

const inRamadan = (now: Date) => toHijri(tunisToday(now)).month === RAMADAN

/** Builds the view from a stored document (pure apart from the clock). */
export function toView(doc: StoredBadges | null, o: { view: 'owner' | 'public'; kids: boolean; supporterPublic: boolean; now?: Date }): BadgesView {
  const now = o.now ?? new Date()
  const owner = o.view === 'owner'
  const allowed = new Set(badgesFor(o.kids).map((badge) => badge.id))
  if (!doc) return { view: o.view, kids: o.kids, disabled: false, earned: [], upNext: [], streak: null }
  if (doc.disabled) return { view: o.view, kids: o.kids, disabled: true, earned: [], upNext: [], streak: null }

  const earned: BadgeCard[] = []
  const candidates: (BadgeCard & { fraction: number })[] = []
  for (const badge of BADGES) {
    if (!allowed.has(badge.id)) continue
    const stored = doc.earned?.[badge.id]
    const level = (stored?.level ?? 0) as Level
    const value = doc.progress?.[badge.id] ?? 0
    if (level > 0) {
      if (!owner) {
        if (PRIVATE_BADGES.has(badge.id)) continue
        if (badge.public === 'optIn' && !o.supporterPublic) continue
        earned.push({ id: badge.id, level, tier: tierOf(level) })
        continue
      }
      earned.push({
        id: badge.id,
        level,
        tier: tierOf(level),
        value,
        at: stored?.at ? new Date(stored.at).toISOString() : undefined,
        levelAt: stored?.levelAt ? new Date(stored.levelAt).toISOString() : undefined,
        unseen: (stored?.seenLevel ?? 0) < level,
        next: nextStep(value, badge, level),
        onlyYou: badge.public === 'never',
      })
    }
    if (!owner || badge.hiddenUntilEarned || isMaxLevel(badge, level)) continue
    // Ramadan only counts while it runs (or once it has started counting).
    if (badge.id === 'ramadan' && value === 0 && !inRamadan(now)) continue
    const next = nextStep(value, badge, level)
    if (!next) continue
    candidates.push({
      id: badge.id, level, tier: tierOf(level), value, next, onlyYou: badge.public === 'never',
      fraction: Math.min(1, value / next.target),
    })
  }
  // Closest first; a tie goes to the catalogue order (stable sort).
  const upNext: BadgeCard[] = candidates
    .sort((a, b) => b.fraction - a.fraction)
    .slice(0, UP_NEXT)
    .map((card) => ({ id: card.id, level: card.level, tier: card.tier, value: card.value, next: card.next, onlyYou: card.onlyYou }))

  const streakAllowed = allowed.has('streakWeeks')
  // Others get the numbers only: whether the owner pressed play this week is the owner's to know.
  const streak = streakAllowed && doc.streak && (doc.streak.current >= 2 || doc.streak.best >= 2)
    ? { current: doc.streak.current ?? 0, best: doc.streak.best ?? 0, thisWeek: owner && doc.streak.thisWeek === true }
    : null
  return { view: o.view, kids: o.kids, disabled: false, earned, upNext: owner ? upNext : [], streak }
}

