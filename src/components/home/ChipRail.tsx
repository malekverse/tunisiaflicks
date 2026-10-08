import Link from 'next/link'
import {
  Baby, Camera, Dices, Drama, Eye, Ghost, Heart, HeartHandshake, Landmark, Laugh, Mic2, Mountain, Music,
  Newspaper, Palette, Popcorn, Rocket, Shield, Siren, Sparkles, Sun, Swords, Timer, Tv, Users, Video, Wand2, Zap,
  type LucideIcon,
} from 'lucide-react'
import { tmdbFetchSafe, tmdbLanguage } from '@/src/lib/tmdb'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { isGrownUpGenre } from '@/src/lib/kids'
import { getKidsMode } from '@/src/lib/profiles'
import { cn } from '@/src/lib/utils'
import type { TKey } from '@/src/lib/i18n'

// One-tap "what do I feel like tonight" shortcuts into pre-filtered Discover views.
const MOODS: { href: string, icon: LucideIcon, label: TKey, plain?: boolean, tvOnly?: boolean, movieOnly?: boolean }[] = [
  { href: '/discover?runtime=90&sort=top', icon: Timer, label: 'mood.short', movieOnly: true },
  { href: '/discover?family=1&sort=top', icon: Users, label: 'mood.family' },
  { href: '/discover?runtime=epic&sort=top', icon: Popcorn, label: 'mood.epic', movieOnly: true },
  { href: '/discover?sort=newest', icon: Sparkles, label: 'mood.new' },
  { href: '/discover?type=tv&runtime=90&sort=top', icon: Tv, label: 'mood.bingeable' },
  { href: '/swipe', icon: HeartHandshake, label: 'mood.swipe' },
  // A route handler: plain <a> so every click is a fresh random pick.
  { href: '/surprise', icon: Dices, label: 'nav.surprise', plain: true },
]

const GENRE_ICONS: Record<number, LucideIcon> = {
  28: Swords, 12: Mountain, 16: Palette, 35: Laugh, 80: Siren, 99: Camera, 18: Drama, 10751: Users,
  14: Wand2, 36: Landmark, 27: Ghost, 10402: Music, 9648: Eye, 10749: Heart, 878: Rocket, 10770: Tv,
  53: Zap, 10752: Shield, 37: Sun, 10759: Swords, 10762: Baby, 10763: Newspaper, 10764: Video,
  10765: Rocket, 10766: Heart, 10767: Mic2, 10768: Landmark,
}

const chip = 'pressable inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[13.5px] font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-red-500'

/**
 * Under the billboard: moods first (a little brighter), then every genre. One scrolling rail, so
 * the home page offers a way in for any mood without a wall of buttons.
 */
export default async function ChipRail({ type = 'movie', className }: { type?: 'movie' | 'tv', className?: string }) {
  const t = getT()
  const data = await tmdbFetchSafe<{ genres: { id: number, name: string }[] }>(
    `genre/${type}/list`, { language: tmdbLanguage(getLocale()) }, 86400
  )
  // Kids profiles don't get Horror, Crime, War…: those lists would be empty for them anyway.
  const kids = await getKidsMode()
  const genres = (data?.genres ?? []).filter((genre) => !kids || !isGrownUpGenre(genre.id))
  const moods = MOODS.filter((mood) => (type === 'tv' ? !mood.movieOnly : !mood.tvOnly))

  return (
    <nav aria-label={t('mood.title')} className={cn('rail-x no-scrollbar flex items-center gap-2 overflow-x-auto overflow-y-hidden px-[var(--gutter)] py-1', className)}>
      {moods.map((mood) => {
        const Icon = mood.icon
        const content = <><Icon aria-hidden className="h-4 w-4 text-white/80" strokeWidth={2} />{t(mood.label)}</>
        const className = cn(chip, 'glass text-white hover:bg-white/[0.14]')
        return mood.plain
          ? <a key={mood.href} href={mood.href} className={className}>{content}</a>
          : <Link key={mood.href} href={mood.href} className={className}>{content}</Link>
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
