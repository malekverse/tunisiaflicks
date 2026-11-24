"use client"
import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Award, BadgeCheck, Bell, Blend, CalendarClock, CalendarDays, CalendarHeart, Cast, ChevronRight, CirclePlay, Clapperboard,
  Coffee, Compass, Dices, Drama, Eye, FileDown, Film, Gem, Gift, Hourglass, Languages, Library, ListOrdered, ListPlus,
  LockKeyhole, Mail, Map as MapIcon, MapPinned, Monitor, MonitorPlay, Moon, MoonStar, PartyPopper, Popcorn, Projector,
  RadioTower, Search, Send, ShieldCheck, Smartphone, Smile, Sparkles, Swords, Target, Trophy, Tv, TvMinimal, UserPlus,
  Users, UsersRound, X, type LucideIcon,
} from 'lucide-react'
import { m, type Variants } from 'framer-motion'
import { useI18n } from '@/src/components/I18nProvider'
import TunisiaMark from '@/src/components/tunisian/TunisiaMark'
import { PLAY_TOOLS, isNewTool } from '@/src/components/play/tools'
import { isNewItem, programmeFor, programmeMatches, type ProgrammeAt, type ProgrammeGroupId } from '@/src/lib/programme'
import type { TKey } from '@/src/lib/i18n'
import { cn } from '@/src/lib/utils'
import { useScrollChrome } from '@/src/hooks/use-scroll-chrome'
import { useCalm } from './parts'
import { useStageLook } from './Stage'

type Icon = LucideIcon | ((props: { className?: string }) => JSX.Element)

type Card = { key: string, name: TKey, text: TKey, icon: Icon, href?: string, plain?: boolean, at?: ProgrammeAt, isNew: boolean }
type Group = { id: ProgrammeGroupId, light: string, cards: Card[] }

const TunisiaIcon = ({ className }: { className?: string }) => <TunisiaMark className={className} />

const ICONS: Record<string, Icon> = {
  search: Search, discover: Compass, clips: Clapperboard, upcoming: CalendarClock, topRated: Trophy,
  franchise: ListOrdered, offers: BadgeCheck, extras: Film, seen: Eye,
  tunisian: TunisiaIcon, tunisianTv: RadioTower, tunisianCinema: Projector, ramadan: MoonStar, filmed: MapPinned,
  dramas: Drama, anime: Swords, arabMap: MapIcon, moments: CalendarHeart,
  surprise: Dices,
  friends: UsersRound, taste: Blend, sharedLists: ListPlus, movieNight: Popcorn, party: PartyPopper,
  library: Library, continue: CirclePlay, shows: MonitorPlay, alerts: Bell, calendar: CalendarDays, digest: Mail,
  challenges: Target, badges: Award, wrapped: Sparkles,
  profiles: Users, kids: Smile, screenTime: Hourglass, halal: ShieldCheck, sleep: Moon,
  phone: Smartphone, androidTv: Tv, tvMode: TvMinimal, sendToTv: Send, desktop: Monitor, chromecast: Cast,
  plus: Gem, familyPlus: UsersRound, gift: Gift, invite: UserPlus, support: Coffee,
  languages: Languages, data: FileDown, security: LockKeyhole,
}

const groupKey = (id: ProgrammeGroupId) => `programme.group.${id}` as TKey
const chipKey = (id: ProgrammeGroupId) => `programme.chip.${id}` as TKey

/** The groups this viewer sees, as cards: the play tools first in theirs. */
function useGroups(kids: boolean): Group[] {
  return useMemo(() => {
    const now = Date.now()
    return programmeFor(kids).map((group) => ({
      id: group.id,
      light: group.light,
      cards: [
        ...(group.play
          ? PLAY_TOOLS.map((tool): Card => ({ key: tool.href, name: tool.label, text: tool.text, icon: tool.icon, href: tool.href, isNew: isNewTool(tool, now) }))
          : []),
        ...group.items.map((item): Card => ({
          key: item.id,
          name: `programme.${item.id}` as TKey,
          text: `programme.${item.id}.text` as TKey,
          icon: ICONS[item.id] ?? Sparkles,
          href: item.href,
          plain: item.plain,
          at: item.at,
          isNew: isNewItem(item, now),
        })),
      ],
    }))
  }, [kids])
}

/**
 * The whole programme: everything the site does, grouped like a festival's listings, every card a
 * way in. Type to find one (names, lines and group names, in the page's language), or pick a
 * group. The room takes each group's colour as it passes.
 */
export default function Programme({ kids }: { kids: boolean }) {
  const { t } = useI18n()
  const groups = useGroups(kids)
  const [chosen, setChosen] = useState<ProgrammeGroupId | null>(null)
  const [query, setQuery] = useState('')
  const list = useRef<HTMLDivElement>(null)
  const { retracted } = useScrollChrome()

  const shown = groups
    .filter((group) => query.trim() || !chosen || group.id === chosen)
    .map((group) => ({
      ...group,
      cards: group.cards.filter((card) => programmeMatches(query, `${t(card.name)} ${t(card.text)} ${t(groupKey(group.id))}`)),
    }))
    .filter((group) => group.cards.length > 0)
  const count = shown.reduce((sum, group) => sum + group.cards.length, 0)

  // A group chosen far down the list: back to the top of the (now shorter) list.
  const bringListUp = () => {
    const element = list.current
    if (element && element.getBoundingClientRect().top < 0) element.scrollIntoView({ block: 'start' })
  }
  const choose = (id: ProgrammeGroupId | null) => {
    setChosen(id)
    setQuery('')
    requestAnimationFrame(bringListUp)
  }

  return (
    <section id="programme" aria-labelledby="landing-programme-title" className="page-x relative py-[clamp(96px,16svh,180px)]">
      <div className="max-w-[60ch]">
        <h2 id="landing-programme-title" className="text-balance font-display text-[clamp(40px,6vw,96px)] font-extrabold leading-[0.9] text-white">
          {t('programme.heading')}
        </h2>
        <p className="mt-5 max-w-[48ch] text-pretty text-[16px] leading-relaxed text-white/70 sm:text-[18px]">{t('programme.text')}</p>
      </div>

      {/* Search and groups, held under the top bar while the list scrolls by; on phones the top
          bar tucks away while scrolling down, and this slides up with it (like SectionNav). */}
      <div
        className={cn(
          'sticky top-[calc(var(--topbar)+env(safe-area-inset-top,0px))] z-10 -me-[var(--gutter)] -ms-[var(--gutter)] mt-10 border-b border-white/[0.06] bg-black/75 px-[var(--gutter)] py-3 backdrop-blur-xl transition-transform duration-300 ease-out',
          retracted && 'max-lg:-translate-y-[var(--topbar)]',
        )}
      >
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
          <label className="relative flex h-11 w-full shrink-0 items-center sm:w-[290px]">
            <Search aria-hidden className="pointer-events-none absolute start-4 h-4 w-4 text-white/50" />
            <input
              type="search"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setChosen(null) }}
              onKeyDown={(event) => { if (event.key === 'Escape' && query) { event.preventDefault(); setQuery('') } }}
              placeholder={t('programme.find')}
              aria-label={t('programme.find')}
              enterKeyHint="search"
              className="h-full w-full appearance-none rounded-full bg-white/[0.07] pe-10 ps-10 text-[16px] text-white outline-none ring-1 ring-inset ring-white/10 transition-shadow placeholder:text-white/45 focus:ring-white/35 [&::-webkit-search-cancel-button]:appearance-none"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label={t('programme.clear')} className="absolute end-1.5 grid h-8 w-8 place-items-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white">
                <X aria-hidden className="h-4 w-4" />
              </button>
            )}
          </label>
          <div role="group" aria-label={t('programme.groups')} className="no-scrollbar -mx-1 flex min-w-0 gap-1.5 overflow-x-auto px-1 py-0.5">
            <Chip on={!chosen && !query} onClick={() => choose(null)}>{t('programme.all')}</Chip>
            {groups.map((group) => (
              <Chip key={group.id} on={chosen === group.id} light={group.light} onClick={() => choose(group.id)}>
                {t(chipKey(group.id))}
              </Chip>
            ))}
          </div>
        </div>
        <p className="sr-only" aria-live="polite">{query ? t('programme.results', { count }) : ''}</p>
      </div>

      <div ref={list} className="scroll-mt-[calc(var(--topbar)+140px)] sm:scroll-mt-[calc(var(--topbar)+90px)]">
        {shown.length ? (
          <div className="mt-10 space-y-14 sm:space-y-16">
            {shown.map((group) => <GroupBlock key={group.id} group={group} />)}
          </div>
        ) : (
          <div className="mx-auto mt-16 max-w-[44ch] text-center">
            <p className="font-display text-[26px] font-bold text-white">{t('programme.none')}</p>
            <p className="mt-2 text-[15px] text-white/60">{t('programme.noneText')}</p>
            <Link href="/contact" className="mt-5 inline-flex h-10 items-center gap-1 rounded-full bg-white/[0.1] pe-3.5 ps-4 text-[14px] font-medium text-white transition-colors hover:bg-white/[0.18] active:scale-[0.97]">
              {t('programme.suggest')}
              <ChevronRight aria-hidden className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}

function Chip({ on, light, onClick, children }: { on: boolean, light?: string, onClick: () => void, children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'pressable inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13.5px] font-medium transition-colors',
        on ? 'bg-white text-black' : 'bg-white/[0.07] text-white/75 hover:bg-white/[0.12] hover:text-white',
      )}
    >
      {light && <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: `rgb(${light})` }} />}
      {children}
    </button>
  )
}

const LIST: Variants = { hidden: {}, shown: { transition: { staggerChildren: 0.035 } } }
const ITEM: Variants = {
  hidden: { opacity: 0, y: 18, filter: 'blur(6px)' },
  shown: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.55, ease: [0.23, 1, 0.32, 1] } },
}

function GroupBlock({ group }: { group: Group }) {
  const { t } = useI18n()
  const reduced = useCalm()
  const ref = useRef<HTMLElement>(null)
  useStageLook(ref, { base: '#000000', light: group.light })
  return (
    <section ref={ref} aria-labelledby={`programme-${group.id}`}>
      <div className="flex items-center gap-3">
        <span aria-hidden className="h-2.5 w-2.5 rounded-full shadow-[0_0_16px_currentColor]" style={{ backgroundColor: `rgb(${group.light})`, color: `rgb(${group.light})` }} />
        <h3 id={`programme-${group.id}`} className="font-display text-[24px] font-bold leading-tight text-white sm:text-[30px]">{t(groupKey(group.id))}</h3>
        <span aria-hidden className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[12px] font-semibold tabular-nums text-white/55">{group.cards.length}</span>
      </div>
      <m.ul
        className="mt-5 grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 2xl:grid-cols-4"
        variants={LIST}
        initial={reduced ? false : 'hidden'}
        whileInView="shown"
        viewport={{ once: true, amount: 0.1 }}
      >
        {group.cards.map((card) => (
          <m.li key={card.key} variants={reduced ? undefined : ITEM} className="min-w-0">
            <ProgrammeCard card={card} light={group.light} />
          </m.li>
        ))}
      </m.ul>
    </section>
  )
}

const CARD = 'group flex h-full items-start gap-3.5 rounded-[18px] bg-white/[0.035] p-4 ring-1 ring-inset ring-white/[0.07]'
const LINKED = 'outline-none transition-[background-color,box-shadow] duration-200 hover:bg-white/[0.07] hover:ring-white/[0.14] focus-visible:ring-2 focus-visible:ring-white/70 active:scale-[0.99]'

function ProgrammeCard({ card, light }: { card: Card, light: string }) {
  const { t } = useI18n()
  const Icon = card.icon
  const body = (
    <>
      <span
        aria-hidden
        className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] transition-transform duration-300 ease-out group-hover:scale-[1.06]"
        style={{ backgroundColor: `rgb(${light} / 0.14)`, color: `rgb(${light})` }}
      >
        <Icon className="h-[19px] w-[19px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[15.5px] font-semibold leading-snug text-white">{t(card.name)}</span>
          {card.isNew && <span className="rounded-full bg-red-600 px-1.5 text-[10.5px] font-bold leading-[1.6] text-white">{t('programme.new')}</span>}
        </span>
        <span className="mt-1 block text-pretty text-[13.5px] leading-snug text-white/60">{t(card.text)}</span>
        {card.at && <span className="mt-2 block text-[12px] font-medium text-white/40">{t(`programme.at.${card.at}` as TKey)}</span>}
      </span>
      {card.href && (
        <ChevronRight aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-white/25 transition-[transform,color] duration-200 group-hover:translate-x-0.5 group-hover:text-white/70 rtl:rotate-180 rtl:group-hover:-translate-x-0.5" />
      )}
    </>
  )
  if (!card.href) return <div className={CARD}>{body}</div>
  // Surprise me is a route handler (a fresh pick each time): a plain link, never prefetched.
  if (card.plain) return <a href={card.href} className={cn(CARD, LINKED)}>{body}</a>
  return <Link href={card.href} className={cn(CARD, LINKED)}>{body}</Link>
}
