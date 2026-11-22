// Every destination of the app, in one place: the desktop rail, the mobile tab bar and the mobile
// menu sheet all read from here, so they can never disagree. Tracks add their own item to the
// group the IA gives them; Kids filtering and "which item is lit" are decided here too.
import {
  Drama,
  Bookmark, CalendarClock, CalendarHeart, Clapperboard, Compass, Dices, Flag, Heart, HeartHandshake, History, House,
  Gamepad2, Globe2, Library, ListVideo, Map as MapIcon, MonitorPlay, MoonStar, Popcorn, Search, Swords, Trophy, Tv, UserRound, UsersRound, type LucideIcon,
} from 'lucide-react'
import TunisiaMark from '@/src/components/tunisian/TunisiaMark'
import { PLAY_TOOLS, isNewTool } from '@/src/components/play/tools'
import type { TKey } from '@/src/lib/i18n'
import type { SeasonalIconKey, SeasonalNav } from '@/src/lib/seasons'

type Icon = LucideIcon | ((props: { className?: string, strokeWidth?: number }) => JSX.Element)

// The crescent and star stands for "Tunisian" (an inline SVG: no icon pack to load).
const TunisiaIcon = ({ className }: { className?: string }) => <TunisiaMark className={className} />

export type NavItem = {
  href: string
  label: TKey
  icon: Icon
  /** A route handler (fresh random pick each time): use a plain <a>, not a prefetched <Link>. */
  plain?: boolean
  /** More paths that light this item up (Library is lit on /favorites, /history and /lists too). */
  match?: string[]
  /** A small pill after the label (e.g. "Beta"). */
  badge?: TKey
  /** One line under the label where there is room for it (the rail's group panels). */
  hint?: TKey
  /** Hidden on Kids profiles. */
  grownUp?: boolean
  /** Where a Kids profile goes instead (Tunisian: the cinema, which has kid-safe titles). */
  kidsHref?: string
  /** What a Kids profile gets in this slot instead (Movie night becomes Swipe). */
  kidsAlt?: Omit<NavItem, 'kidsAlt'>
}

export const BROWSE: NavItem[] = [
  { href: '/', label: 'nav.home', icon: House },
  { href: '/tv', label: 'nav.tvShows', icon: Tv },
  { href: '/discover', label: 'nav.discover', icon: Compass },
  { href: '/clips', label: 'nav.clips', icon: Clapperboard },
  { href: '/upcoming', label: 'nav.comingSoon', icon: CalendarClock },
  { href: '/top-rated', label: 'nav.topRated', icon: Trophy },
  { href: '/surprise', label: 'nav.surprise', icon: Dices, plain: true },
]

/** The world's cinema and TV: Tunisian, then each hub, then the seasonal slot (see Rail). */
export const WORLD: NavItem[] = [
  { href: '/tunisian', label: 'nav.tunisian', icon: TunisiaIcon, badge: 'nav.beta', kidsHref: '/tunisian/cinema' },
  { href: '/dramas', label: 'dramas.nav', icon: Drama, grownUp: true },
  // Kids get a filtered catalogue (no grownUp; see lib/anime/model).
  { href: '/anime', label: 'anime.nav', icon: Swords },
  // Kids get a dimmed, filtered map (no grownUp).
  { href: '/arab-cinema', label: 'arabMap.nav', icon: MapIcon },
]

/** Saved first: the Library landing page is the first tab (LibraryTabs and the menu sheet follow this order). */
export const LIBRARY: NavItem[] = [
  { href: '/saved', label: 'nav.bookmarked', icon: Bookmark },
  { href: '/favorites', label: 'nav.favorites', icon: Heart },
  { href: '/history', label: 'nav.recent', icon: History },
  { href: '/lists', label: 'nav.myLists', icon: ListVideo },
]

/** Ways to pick a film: Decide together, Swipe, Blind date, Guess the film ("New" for a while). */
export const PLAY: NavItem[] = PLAY_TOOLS.map((tool) => ({
  href: tool.href,
  label: tool.label,
  icon: tool.icon,
  hint: tool.text,
  ...(isNewTool(tool) ? { badge: 'play.new' as TKey } : {}),
}))

/** What's yours: Friends, Movie night (Kids: Swipe), My shows, Library. Your year lives on /me. */
export const YOURS: NavItem[] = [
  { href: '/friends', label: 'social.nav', icon: UsersRound, grownUp: true },
  {
    href: '/movie-night', label: 'movieNight.nav', icon: Popcorn, grownUp: true,
    kidsAlt: { href: '/swipe', label: 'swipe.title', icon: HeartHandshake },
  },
  // Where you are in every series you watch, and what's next.
  { href: '/shows', label: 'shows.nav', icon: MonitorPlay },
  { href: '/saved', label: 'nav.library', icon: Library, match: ['/favorites', '/history', '/lists'] },
]

// ---------------------------------------------------------------------------------------------
// The desktop rail: a few places always in view, the rest in four groups. A group is one icon;
// hovering (or clicking) it opens a panel beside the rail with its places (see Rail).

const find = (items: NavItem[], href: string, hint?: TKey): NavItem => ({ ...items.find((item) => item.href === href)!, ...(hint ? { hint } : {}) })

/** Always in view: Home, Tunisian (the site's own), Discover, Clips. */
export const RAIL_TOP: NavItem[] = [find(BROWSE, '/'), find(WORLD, '/tunisian'), find(BROWSE, '/discover'), find(BROWSE, '/clips')]

export type NavGroup = { id: 'watch' | 'world' | 'play' | 'yours', label: TKey, icon: LucideIcon, items: NavItem[] }

export const RAIL_GROUPS: NavGroup[] = [
  {
    id: 'watch',
    label: 'nav.group.watch',
    icon: Tv,
    items: [find(BROWSE, '/tv', 'nav.hint.tv'), find(BROWSE, '/upcoming', 'nav.hint.upcoming'), find(BROWSE, '/top-rated', 'nav.hint.topRated')],
  },
  {
    id: 'world',
    label: 'nav.group.world',
    icon: Globe2,
    items: [find(WORLD, '/dramas', 'nav.hint.dramas'), find(WORLD, '/anime', 'nav.hint.anime'), find(WORLD, '/arab-cinema', 'nav.hint.arabCinema')],
  },
  {
    id: 'play',
    label: 'nav.group.play',
    icon: Gamepad2,
    items: [...PLAY, find(BROWSE, '/surprise', 'play.surprise.text')],
  },
  {
    id: 'yours',
    label: 'nav.group.yours',
    icon: UserRound,
    items: [find(YOURS, '/shows', 'nav.hint.shows'), find(YOURS, '/saved', 'nav.hint.library'), find(YOURS, '/friends', 'nav.hint.friends'), find(YOURS, '/movie-night', 'nav.hint.movieNight')],
  },
]

/** The mobile tab bar: the four places people go most, plus "You" (the menu sheet). */
export const TABS: NavItem[] = [
  { href: '/', label: 'nav.home', icon: House },
  { href: '/discover', label: 'nav.discover', icon: Compass },
  { href: '/clips', label: 'nav.clips', icon: Clapperboard },
  { href: '/search', label: 'nav.search', icon: Search },
]

/** The seasonal slot's icons (the server hands over a key: components can't cross to the client). */
export const SEASONAL_ICONS: Record<SeasonalIconKey, LucideIcon> = {
  moon: MoonStar,
  flag: Flag,
  year: CalendarHeart,
}

/** The seasonal slot as a nav item. */
export const seasonalItem = (seasonal: SeasonalNav): NavItem => ({ href: seasonal.href, label: seasonal.label, icon: SEASONAL_ICONS[seasonal.icon] })

/** Is `href` the current section? Home only matches itself. */
export const isActive = (pathname: string, href: string) =>
  href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)

/** Is the item lit: its own href, or one of its `match` paths. */
export const isItemActive = (pathname: string, item: NavItem) =>
  !item.plain && (isActive(pathname, item.href) || (item.match ?? []).some((path) => isActive(pathname, path)))

/** The one item to light among `items`: when several match, the longest path wins. */
export function activeHref(pathname: string, items: NavItem[]): string | null {
  let best: { href: string, length: number } | null = null
  for (const item of items) {
    if (item.plain) continue
    for (const path of [item.href, ...(item.match ?? [])]) {
      if (isActive(pathname, path) && (!best || path.length > best.length)) best = { href: item.href, length: path.length }
    }
  }
  return best?.href ?? null
}

/** The items a profile sees: for Kids, alternatives replace items, grown-up items go, and Kids hrefs apply. */
export function visibleItems(items: NavItem[], kids: boolean): NavItem[] {
  if (!kids) return items
  return items.flatMap((item) => {
    if (item.kidsAlt) return [item.kidsAlt as NavItem]
    if (item.grownUp) return []
    return [item.kidsHref ? { ...item, href: item.kidsHref } : item]
  })
}
