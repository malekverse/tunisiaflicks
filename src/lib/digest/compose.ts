// One profile's digest, put together from the week's shared snapshot (the same for everyone who
// reads the e-mail in that language), the profile's own sections and the other features'
// sections. Pure: it decides the order, removes repeats, picks the hero and the subject, and says
// whether there is enough to send (at least four titles).
import type { Translate } from '@/src/lib/i18n/translate'
import type { DigestSection, DigestTile } from '@/src/lib/digest/providers'
import { isolate, type DigestHero, type EmailSection } from '@/src/lib/digest/template'

/** Fewer titles than this and the week is skipped for that profile. */
export const MIN_TILES = 4
const PER_SECTION = 3
const SUBJECT_MAX = 60

/** What the week holds for everyone reading in one language (stored on the edition). */
export type SharedSnapshot = {
  newThisWeek: DigestTile[]
  tunisian: DigestTile[]
  moment: { id: string; title: string; href: string; accent: string; tiles: DigestTile[] } | null
  sequels: { title: string; tiles: DigestTile[] } | null
  pick: { tile: DigestTile; why: string; backdrop: string | null; overview: string; color: string | null } | null
}

export const EMPTY_SNAPSHOT: SharedSnapshot = { newThisWeek: [], tunisian: [], moment: null, sequels: null, pick: null }

/** A followed title with news this week. */
export type FollowNews = DigestTile & { kind: 'movie' | 'tv' }

/** One profile's own material. */
export type PersonalParts = {
  follows: FollowNews[]
  /** The first followed title, dressed as the hero (backdrop, overview, colour), when there is one. */
  followHero: DigestHero | null
  continueWatching: DigestTile[]
  picks: DigestTile[]
  stillOnList: DigestTile[]
}

export const EMPTY_PERSONAL: PersonalParts = { follows: [], followHero: null, continueWatching: [], picks: [], stillOnList: [] }

export type ComposedDigest = {
  hero: DigestHero | null
  sections: EmailSection[]
  subject: string
  preheader: string
  /** How many titles it shows (the hero counts as one). */
  tiles: number
}

const tilesOf = (section: DigestSection) => (section.type === 'rows' ? section.rows : section.type === 'posters' ? section.tiles : [])

/** The subject, cut to about 60 characters by shortening the title in it, never the sentence. */
function fit(t: Translate, key: Parameters<Translate>[0], vars: Record<string, string | number>, titleVar: string) {
  const full = t(key, { ...vars, [titleVar]: isolate(String(vars[titleVar])) })
  const over = full.length - SUBJECT_MAX
  if (over <= 0) return full
  const title = String(vars[titleVar])
  const room = Math.max(12, title.length - over - 1)
  return t(key, { ...vars, [titleVar]: isolate(`${title.slice(0, room).trimEnd()}…`) })
}

export function composeDigest({ t, name, shared, personal, extra = [] }: {
  t: Translate
  /** The profile's name. */
  name: string
  shared: SharedSnapshot
  personal: PersonalParts
  /** The other features' sections (DIGEST_PROVIDERS), already built. */
  extra?: DigestSection[]
}): ComposedDigest {
  const pick = shared.pick
  const hero: DigestHero | null = personal.followHero ?? (pick ? {
    title: pick.tile.title,
    href: pick.tile.href,
    backdrop: pick.backdrop,
    poster: pick.tile.poster,
    kicker: t('digest.section.pick'),
    text: pick.why || pick.overview,
    cta: t('digest.email.watch'),
    color: pick.color,
  } : null)

  const candidates: EmailSection[] = [
    { type: 'rows', id: 'follows', title: t('digest.section.follows'), rows: personal.follows },
    { type: 'rows', id: 'continue', title: t('digest.section.continue'), rows: personal.continueWatching, href: '/history' },
    { type: 'posters', id: 'picks', title: t('digest.section.picksFor', { name: isolate(name) }), tiles: personal.picks },
    { type: 'posters', id: 'new', title: t('digest.section.new'), tiles: shared.newThisWeek },
    { type: 'posters', id: 'tunisian', title: t('digest.section.tunisian'), tiles: shared.tunisian, href: '/tunisian' },
    ...(shared.moment ? [{ type: 'posters' as const, id: 'moment', title: shared.moment.title, tiles: shared.moment.tiles, href: shared.moment.href, accent: shared.moment.accent }] : []),
    ...(shared.sequels ? [{ type: 'posters' as const, id: 'sequels', title: t('digest.section.sequels', { title: isolate(shared.sequels.title) }), tiles: shared.sequels.tiles }] : []),
    ...extra,
    { type: 'posters', id: 'still-on-list', title: t('digest.section.stillOnList'), tiles: personal.stillOnList, href: '/saved' },
  ]

  // Each title once, in the first place it appears (the hero first).
  const seen = new Set<string>(hero ? [hero.href] : [])
  const unseen = (tiles: DigestTile[]) => tiles.filter((tile) => tile?.href && tile.title && !seen.has(tile.href)).slice(0, PER_SECTION)
  const sections: EmailSection[] = []
  for (const section of candidates) {
    if (section.type === 'note') {
      if (section.text) sections.push(section)
      continue
    }
    const kept = unseen(tilesOf(section))
    if (kept.length === 0) continue
    kept.forEach((tile) => seen.add(tile.href))
    sections.push(section.type === 'rows' ? { ...section, rows: kept } : { ...section, tiles: kept })
  }

  const tiles = (hero ? 1 : 0) + sections.reduce((sum, section) => sum + tilesOf(section).length, 0)

  // Subject: the most personal news first.
  let subject: string
  const follows = personal.follows
  if (follows.length > 1) subject = fit(t, 'digest.subject.follows', { title: follows[0].title, count: follows.length - 1 }, 'title')
  else if (follows.length === 1) subject = fit(t, follows[0].kind === 'tv' ? 'digest.subject.episode' : 'digest.subject.follow', { title: follows[0].title }, 'title')
  else if (personal.continueWatching.length) subject = fit(t, 'digest.subject.continue', { title: personal.continueWatching[0].title }, 'title')
  else if (shared.moment) subject = fit(t, 'digest.subject.moment', { moment: shared.moment.title }, 'moment')
  else if (pick) subject = fit(t, 'digest.subject.pick', { title: pick.tile.title }, 'title')
  else subject = t('digest.subject.default')

  return { hero, sections, subject, preheader: t(follows.length ? 'digest.preheader.follows' : 'digest.preheader.default'), tiles }
}
