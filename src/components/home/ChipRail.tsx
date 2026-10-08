import Link from 'next/link'
import {
  Baby, Camera, Dices, Drama, Eye, Flag, Ghost, Gift, GraduationCap, Heart, HeartHandshake, Landmark, Laugh, Mic2, MoonStar, Mountain,
  Music, Newspaper, Palette, PartyPopper, Popcorn, Rocket, Shield, Siren, Skull, Snowflake, Sparkles, Sun, Swords, Timer, Trophy, Tv,
  Users, Video, Wand2, Zap,
  type LucideIcon,
} from 'lucide-react'
import { genreList } from '@/src/lib/tmdb-locale'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { isGrownUpGenre } from '@/src/lib/kids'
import { getKidsMode } from '@/src/lib/profiles'
import { activeMoments, type MomentId } from '@/src/lib/moments'
import { cn } from '@/src/lib/utils'
import type { TKey } from '@/src/lib/i18n'

// The moment of the day, in Tunis: what people feel like watching changes with it.
type Slot = 'morning' | 'afternoon' | 'evening' | 'late'
type Context = { slot: Slot, weekend: boolean }

function tunisContext(now = new Date()): Context {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Tunis', weekday: 'short', hour: 'numeric', hourCycle: 'h23' })
    .formatToParts(now).map((part) => [part.type, part.value]))
  const hour = Number(parts.hour)
  const slot: Slot = hour >= 23 || hour < 5 ? 'late' : hour >= 18 ? 'evening' : hour >= 12 ? 'afternoon' : 'morning'
  // Saturday and Sunday, and Friday from the evening (Saturday's small hours count as Friday night).
  const day = parts.weekday
  const weekend = day === 'Sat' || day === 'Sun' || (day === 'Fri' && (slot === 'evening' || slot === 'late'))
  return { slot, weekend }
}

type Mood = {
  href: string
  icon: LucideIcon
  label: TKey
  /** How well it fits the moment; 0 hides it. */
  fit: (context: Context) => number
  plain?: boolean
  movieOnly?: boolean
  /** Not for Kids profiles. */
  grownUp?: boolean
}

// One-tap "what do I feel like" shortcuts into pre-filtered views, ordered by the time of day.
const MOODS: Mood[] = [
  { href: '/discover?runtime=90&sort=top', icon: Timer, label: 'mood.short', movieOnly: true, fit: ({ slot, weekend }) => (slot === 'late' ? 6 : slot === 'evening' && !weekend ? 5 : 2) },
  { href: '/discover?family=1&sort=top', icon: Users, label: 'mood.family', fit: ({ slot, weekend }) => (weekend && slot !== 'late' ? 6 : slot === 'afternoon' ? 4 : slot === 'late' ? 0 : 2) },
  { href: '/discover?runtime=epic&sort=top', icon: Popcorn, label: 'mood.epic', movieOnly: true, fit: ({ slot, weekend }) => (weekend && slot !== 'late' ? 5 : slot === 'late' ? 0 : 1) },
  { href: '/discover?sort=newest', icon: Sparkles, label: 'mood.new', fit: ({ slot }) => (slot === 'morning' || slot === 'afternoon' ? 5 : 3) },
  { href: '/discover?type=tv&runtime=90&sort=top', icon: Tv, label: 'mood.bingeable', fit: ({ slot, weekend }) => (slot === 'late' ? 5 : !weekend ? 4 : 2) },
  { href: '/genres/35', icon: Laugh, label: 'mood.laugh', fit: ({ slot, weekend }) => (slot === 'late' || (slot === 'evening' && !weekend) ? 4 : 2) },
  { href: '/swipe', icon: HeartHandshake, label: 'mood.swipe', fit: ({ slot, weekend }) => (slot === 'evening' && weekend ? 5 : slot === 'evening' ? 3 : 1) },
  { href: '/genres/10749', icon: Heart, label: 'mood.dateNight', movieOnly: true, grownUp: true, fit: ({ slot, weekend }) => (slot === 'evening' && weekend ? 4 : slot === 'evening' ? 1 : 0) },
  { href: '/genres/27', icon: Skull, label: 'mood.scary', movieOnly: true, grownUp: true, fit: ({ slot, weekend }) => (slot === 'late' ? (weekend ? 5 : 3) : slot === 'evening' ? 1 : 0) },
  // A route handler: plain <a> so every click is a fresh random pick.
  { href: '/surprise', icon: Dices, label: 'nav.surprise', plain: true, fit: () => 2 },
]

const MOMENT_ICONS: Record<MomentId, LucideIcon> = {
  'ramadan': MoonStar, 'eid-al-fitr': MoonStar, 'eid-al-adha': MoonStar,
  'independence-day': Flag, 'republic-day': Flag, 'womens-day': Flag,
  'new-year': PartyPopper, 'christmas': Gift, 'halloween': Ghost, 'valentines': Heart,
  'awards': Trophy, 'winter': Snowflake, 'summer': Sun, 'back-to-school': GraduationCap,
}

const GENRE_ICONS: Record<number, LucideIcon> = {
  28: Swords, 12: Mountain, 16: Palette, 35: Laugh, 80: Siren, 99: Camera, 18: Drama, 10751: Users,
  14: Wand2, 36: Landmark, 27: Ghost, 10402: Music, 9648: Eye, 10749: Heart, 878: Rocket, 10770: Tv,
  53: Zap, 10752: Shield, 37: Sun, 10759: Swords, 10762: Baby, 10763: Newspaper, 10764: Video,
  10765: Rocket, 10766: Heart, 10767: Mic2, 10768: Landmark,
}

const chip = 'pressable inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[13.5px] font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-red-500'

/**
 * Under the billboard: what's on (Halloween, Eid...) first, lit in its colour; then moods ordered
 * for the time of day (short films late at night, a long one or the family on weekend evenings);
 * then every genre. One scrolling rail, so there's a way in for any mood without a wall of buttons.
 */
export default async function ChipRail({ type = 'movie', className }: { type?: 'movie' | 'tv', className?: string }) {
  const t = getT()
  const allGenres = await genreList(type, getLocale())
  // Kids profiles don't get Horror, Crime, War…: those lists would be empty for them anyway.
  const kids = await getKidsMode()
  const genres = allGenres.filter((genre) => !kids || !isGrownUpGenre(genre.id))
  const context = tunisContext()
  const moods = MOODS
    .filter((mood) => (type === 'tv' ? !mood.movieOnly : true) && !(kids && mood.grownUp))
    .map((mood) => ({ mood, fit: mood.fit(context) }))
    .filter((entry) => entry.fit > 0)
    .sort((a, b) => b.fit - a.fit)
    .map((entry) => entry.mood)
  const moments = activeMoments(kids).slice(0, 2)
  const day = context.slot === 'morning' || context.slot === 'afternoon'
  const moodHref = (mood: Mood) => (type === 'tv' && mood.href.startsWith('/genres/') ? `${mood.href}?type=tv` : mood.href)

  return (
    <nav aria-label={t(day ? 'mood.titleDay' : 'mood.title')} className={cn('rail-x no-scrollbar flex items-center gap-2 overflow-x-auto overflow-y-hidden px-[var(--gutter)] py-1', className)}>
      {moments.map((moment) => {
        const Icon = MOMENT_ICONS[moment.id]
        return (
          <Link
            key={moment.id}
            href={moment.href}
            className={cn(chip, 'text-white')}
            style={{ backgroundColor: `rgb(${moment.accent} / 0.18)`, boxShadow: `inset 0 0 0 1px rgb(${moment.accent} / 0.4)` }}
          >
            <Icon aria-hidden className="h-4 w-4" style={{ color: `rgb(${moment.accent})` }} strokeWidth={2} />
            {t(`moment.${moment.id}.title` as TKey)}
          </Link>
        )
      })}
      {moods.map((mood) => {
        const Icon = mood.icon
        const content = <><Icon aria-hidden className="h-4 w-4 text-white/80" strokeWidth={2} />{t(mood.label)}</>
        const className = cn(chip, 'glass text-white hover:bg-white/[0.14]')
        return mood.plain
          ? <a key={mood.href} href={mood.href} className={className}>{content}</a>
          : <Link key={mood.href} href={moodHref(mood)} className={className}>{content}</Link>
      })}
      {genres.length > 0 && <span aria-hidden className="mx-2 h-5 w-px shrink-0 bg-white/15" />}
      {genres.map((genre) => {
        const Icon = GENRE_ICONS[genre.id]
        return (
          <Link
            key={genre.id}
            href={`/genres/${genre.id}${type === 'tv' ? '?type=tv' : ''}`}
            className={cn(chip, 'border border-white/10 text-white/70 hover:border-white/25 hover:bg-white/[0.06] hover:text-white')}
          >
            {Icon && <Icon aria-hidden className="h-4 w-4 opacity-70" strokeWidth={1.8} />}
            {genre.name}
          </Link>
        )
      })}
    </nav>
  )
}
