"use client"
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import { ChevronRight, Settings } from 'lucide-react'
import { cn } from '@/src/lib/utils'
import { EASE_OUT, spring } from '@/src/lib/motion'
import { useSession } from 'next-auth/react'
import { useI18n } from '@/src/components/I18nProvider'
import { useProfiles } from '@/src/hooks/use-profiles'
import { BROWSE, PLAY_GROUP, WORLD, YOURS, activeHref, seasonalItem, visibleItems, type NavGroup, type NavItem } from './nav'
import type { SeasonalNav } from '@/src/lib/seasons'

const SETTINGS: NavItem = { href: '/profile', label: 'nav.settings', icon: Settings }

export type RailProps = {
    /** A Kids profile is in use (from the server, so grown-up items never flash). */
    kids?: boolean
    /** The seasonal nav item, if any (getSeasonalNav in src/lib/seasons.ts). */
    seasonal?: SeasonalNav | null
}

const OPEN_DELAY = 90
const CLOSE_DELAY = 180
/** A group's panel opens a moment after the pointer settles on it, so sweeping past doesn't flash it. */
const GROUP_OPEN_DELAY = 70
const GROUP_CLOSE_DELAY = 160

/**
 * Desktop navigation: a slim column of icons along the start edge. Hovering it (or tabbing into
 * it) unfolds a glass panel with the labels, *over* the page, so nothing underneath reflows.
 * The panel is always 256px wide and clipped down to the icon column while closed: unfolding is a
 * clip-path transition, which also keeps the hidden part from catching the mouse.
 *
 * Pick & play (the ways to pick a film, and Surprise me) is one row: hovering or clicking it
 * opens a second panel beside the rail with its places and a line about each; →/Enter opens it
 * from the keyboard, Esc closes it. It's lit on one of its pages, and a red dot says when one of
 * its places is new.
 */
export default function Rail({ kids: kidsProp, seasonal }: RailProps = {}) {
    const pathname = usePathname()
    const { t, dir } = useI18n()
    const { status } = useSession()
    const { active: activeProfile } = useProfiles()
    // The layout knows from the server; without it, the profile in use decides.
    const kids = kidsProp ?? activeProfile?.kids ?? false
    const [open, setOpen] = useState(false)
    const [group, setGroup] = useState<{ id: NavGroup['id'], top: number } | null>(null)

    const playGroup = { ...PLAY_GROUP, items: visibleItems(PLAY_GROUP.items, kids) }
    const inPlay = (item: NavItem) => playGroup.items.some((place) => place.href === item.href)
    const browse = visibleItems(BROWSE, kids).filter((item) => !inPlay(item))
    const world = [
        ...visibleItems(WORLD, kids),
        // The calendar's slot ("Your year" only for people with a year to show).
        ...(seasonal && (!seasonal.signedInOnly || status === 'authenticated') ? [seasonalItem(seasonal)] : []),
    ]
    // Each place once (a Kids profile's Movie night is Swipe, already under Pick & play).
    const yours = visibleItems(YOURS, kids).filter((item) => !inPlay(item))
    const groups = playGroup.items.length ? [playGroup] : []
    const lit = activeHref(pathname, [...browse, ...world, ...playGroup.items, ...yours, SETTINGS])

    const timer = useRef<ReturnType<typeof setTimeout>>()
    const groupTimer = useRef<ReturnType<typeof setTimeout>>()
    const flyout = useRef<HTMLDivElement>(null)
    const aside = useRef<HTMLElement>(null)
    const rows = useRef<Partial<Record<NavGroup['id'], HTMLButtonElement | null>>>({})

    const schedule = (next: boolean) => {
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setOpen(next), next ? OPEN_DELAY : CLOSE_DELAY)
    }
    const keep = () => {
        clearTimeout(timer.current)
        clearTimeout(groupTimer.current)
    }
    const showGroup = (id: NavGroup['id'], delay = GROUP_OPEN_DELAY) => {
        clearTimeout(groupTimer.current)
        const place = () => {
            const row = rows.current[id]
            if (!row) return
            const box = row.getBoundingClientRect()
            setGroup({ id, top: box.top })
        }
        if (delay) groupTimer.current = setTimeout(place, delay)
        else place()
    }
    const hideGroup = (delay = GROUP_CLOSE_DELAY) => {
        clearTimeout(groupTimer.current)
        if (delay) groupTimer.current = setTimeout(() => setGroup(null), delay)
        else setGroup(null)
    }
    useEffect(() => () => {
        clearTimeout(timer.current)
        clearTimeout(groupTimer.current)
    }, [])
    // A click on a link folds everything away right away.
    useEffect(() => {
        setOpen(false)
        setGroup(null)
    }, [pathname])
    // The group's panel only lives beside an open rail.
    useEffect(() => { if (!open) setGroup(null) }, [open])
    // Beside its row, but always whole on screen: measured once it's drawn.
    useLayoutEffect(() => {
        const panel = flyout.current
        if (!panel || !group) return
        const wanted = group.top - 52
        const room = window.innerHeight - panel.offsetHeight - 12
        panel.style.top = `${Math.max(12, Math.min(wanted, room))}px`
    }, [group])

    const collapsedClip = dir === 'rtl' ? 'inset(0 0 0 calc(100% - var(--rail)))' : 'inset(0 calc(100% - var(--rail)) 0 0)'
    const rowClass = 'group relative mx-2 flex h-11 items-center rounded-xl outline-none transition-colors duration-150 hover:bg-white/[0.06] focus-visible:bg-white/[0.08] focus-visible:outline-none'

    /** The lit bar on the start edge. */
    const bar = <m.span layoutId="rail-active" transition={spring.ui} aria-hidden className="absolute -start-2 top-[10px] h-6 w-[3px] rounded-e-full bg-red-500 shadow-[0_0_14px_2px_rgb(255_36_20/0.7)]" />

    const label = (text: string, index: number, active: boolean) => (
        <span
            className={cn(
                'truncate pe-4 text-[15px] transition-[opacity,transform] duration-200 ease-out',
                active ? 'font-semibold text-white' : 'text-white/70 group-hover:text-white',
                open ? 'translate-x-0 opacity-100' : 'opacity-0 ltr:-translate-x-1 rtl:translate-x-1',
            )}
            style={{ transitionDelay: open ? `${60 + index * 18}ms` : '0ms' }}
        >
            {text}
        </span>
    )

    const icon = (Icon: NavItem['icon'], active: boolean, dot = false) => (
        <span className="relative grid w-[calc(var(--rail)-16px)] shrink-0 place-items-center">
            <Icon aria-hidden className={cn('h-[22px] w-[22px] transition-colors duration-200', active ? 'text-white' : 'text-white/55 group-hover:text-white')} strokeWidth={active ? 2.2 : 1.8} />
            {dot && <span aria-hidden className="absolute end-[calc(50%-15px)] top-[-2px] h-2 w-2 rounded-full bg-red-500 ring-2 ring-black" />}
        </span>
    )

    const item = (entry: NavItem, index: number) => {
        const active = !entry.plain && entry.href === lit
        const content = (
            <>
                {active && bar}
                {icon(entry.icon, active)}
                {label(t(entry.label), index, active)}
                {entry.badge && (
                    <span
                        aria-hidden
                        className={cn(
                            'ms-2 shrink-0 rounded-full bg-red-500/15 px-1.5 py-[3px] text-[9px] font-bold uppercase leading-none tracking-wide text-red-300 ring-1 ring-inset ring-red-500/25 transition-opacity duration-200',
                            open ? 'opacity-100' : 'opacity-0',
                        )}
                        style={{ transitionDelay: open ? `${80 + index * 18}ms` : '0ms' }}
                    >
                        {t(entry.badge)}
                    </span>
                )}
            </>
        )
        // Moving onto a plain place closes a group's panel (after a beat, for a diagonal path to it).
        const onMouseEnter = () => hideGroup()
        return entry.plain ? (
            <a key={entry.href} href={entry.href} className={rowClass} aria-label={t(entry.label)} onMouseEnter={onMouseEnter}>{content}</a>
        ) : (
            <Link key={entry.href} href={entry.href} className={rowClass} aria-label={t(entry.label)} aria-current={active ? 'page' : undefined} onMouseEnter={onMouseEnter}>{content}</Link>
        )
    }

    const groupRow = (entry: NavGroup, index: number) => {
        const active = entry.items.some((place) => place.href === lit)
        const expanded = group?.id === entry.id
        const fresh = entry.items.some((place) => place.badge === 'play.new')
        return (
            <button
                key={entry.id}
                ref={(node) => { rows.current[entry.id] = node }}
                type="button"
                aria-haspopup="true"
                aria-expanded={expanded}
                aria-controls={`rail-group-${entry.id}`}
                onMouseEnter={() => showGroup(entry.id)}
                onClick={() => (expanded ? hideGroup(0) : showGroup(entry.id, 0))}
                onKeyDown={(event) => {
                    const forward = dir === 'rtl' ? 'ArrowLeft' : 'ArrowRight'
                    if (event.key === forward || event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        showGroup(entry.id, 0)
                        // Into the panel, on its first place.
                        requestAnimationFrame(() => flyout.current?.querySelector<HTMLElement>('a')?.focus())
                    } else if (event.key === 'Escape') hideGroup(0)
                }}
                className={cn(rowClass, 'w-[calc(100%-16px)] text-start', expanded && 'bg-white/[0.07]')}
            >
                {active && bar}
                {icon(entry.icon, active || expanded, fresh)}
                {label(t(entry.label), index, active)}
                <ChevronRight
                    aria-hidden
                    className={cn('ms-auto me-3 h-4 w-4 shrink-0 text-white/45 transition-[opacity,transform] duration-200 rtl:rotate-180', open ? 'opacity-100' : 'opacity-0', expanded && 'translate-x-0.5 text-white rtl:-translate-x-0.5')}
                />
            </button>
        )
    }

    let index = 0
    const current = group ? groups.find((entry) => entry.id === group.id) ?? null : null
    const insideNav = (node: Node | null) => !!node && (!!aside.current?.contains(node) || !!flyout.current?.contains(node))

    return (
        <>
            <aside
                ref={aside}
                aria-label={t('nav.primary')}
                onMouseEnter={() => { clearTimeout(timer.current); schedule(true) }}
                onMouseLeave={() => { schedule(false); hideGroup() }}
                onFocus={() => { clearTimeout(timer.current); setOpen(true) }}
                onBlur={(event) => { if (!insideNav(event.relatedTarget as Node)) schedule(false) }}
                className="fixed inset-y-0 start-0 z-50 hidden w-64 lg:block"
                style={{
                    clipPath: open ? 'inset(0 0 0 0)' : collapsedClip,
                    transition: `clip-path ${open ? 320 : 220}ms cubic-bezier(0.23, 1, 0.32, 1)`,
                }}
            >
                {/* Closed: a soft scrim so the icons stay legible over a billboard. Open: a glass panel. */}
                <div
                    aria-hidden
                    className={cn(
                        'absolute inset-0 transition-opacity duration-300',
                        open ? 'glass-strong opacity-100 shadow-[24px_0_60px_-20px_rgb(0_0_0/0.9)] rtl:shadow-[-24px_0_60px_-20px_rgb(0_0_0/0.9)]' : 'opacity-0',
                    )}
                />
                <div aria-hidden className={cn('absolute inset-y-0 start-0 w-[var(--rail)] bg-gradient-to-r from-black/70 to-transparent transition-opacity duration-300 rtl:bg-gradient-to-l', open && 'opacity-0')} />

                <div className="relative flex h-full flex-col py-5">
                    <Link href="/" aria-label={t('nav.homeAria')} className="mb-6 flex h-10 items-center outline-none">
                        <span className="grid w-[var(--rail)] shrink-0 place-items-center">
                            <Image src="/A.svg" alt="" width={34} height={30} priority className="h-[30px] w-auto drop-shadow-[0_0_14px_rgb(255_16_0/0.45)]" />
                        </span>
                        <Image
                            src="/TunisiaFlicks.svg"
                            alt="TunisiaFlicks"
                            width={140}
                            height={19}
                            className={cn('h-[17px] w-auto transition-[opacity,transform] duration-300 ease-out', open ? 'opacity-100' : 'opacity-0 ltr:-translate-x-1 rtl:translate-x-1')}
                        />
                    </Link>

                    <nav className="no-scrollbar flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-0">
                        {browse.map((entry) => item(entry, index++))}
                        <div aria-hidden className="mx-5 my-3 h-px bg-white/[0.08]" />
                        {world.map((entry) => item(entry, index++))}
                        <div aria-hidden className="mx-5 my-3 h-px bg-white/[0.08]" />
                        {groups.map((entry) => groupRow(entry, index++))}
                        <div aria-hidden className="mx-5 my-3 h-px bg-white/[0.08]" />
                        {yours.map((entry) => item(entry, index++))}
                    </nav>

                    <div className="pt-3">
                        {item(SETTINGS, index++)}
                    </div>
                </div>
            </aside>

            {/* The open group's places, beside the rail (outside it: the rail clips what overflows it). */}
            <AnimatePresence>
                {open && current && group && (
                    <m.div
                        key={current.id}
                        ref={flyout}
                        id={`rail-group-${current.id}`}
                        role="group"
                        aria-label={t(current.label)}
                        initial={{ opacity: 0, x: dir === 'rtl' ? 8 : -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, transition: { duration: 0.12 } }}
                        transition={{ duration: 0.2, ease: EASE_OUT }}
                        onMouseEnter={keep}
                        onMouseLeave={() => { schedule(false); hideGroup() }}
                        onBlur={(event) => { if (!insideNav(event.relatedTarget as Node)) { schedule(false); hideGroup(0) } }}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape' || event.key === (dir === 'rtl' ? 'ArrowRight' : 'ArrowLeft')) {
                                event.preventDefault()
                                rows.current[current.id]?.focus()
                                hideGroup(0)
                            }
                            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                                event.preventDefault()
                                const links = Array.from(flyout.current?.querySelectorAll<HTMLElement>('a') ?? [])
                                const at = links.indexOf(document.activeElement as HTMLElement)
                                links[(at + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length]?.focus()
                            }
                        }}
                        className="glass-strong fixed z-50 hidden w-[320px] rounded-[22px] p-2 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.95)] lg:block"
                        style={{ insetInlineStart: 'calc(16rem + 6px)', top: Math.max(12, group.top - 52) }}
                    >
                        <p className="px-3 pb-1.5 pt-2 font-display text-[17px] font-bold text-white">{t(current.label)}</p>
                        <ul>
                            {current.items.map((place) => {
                                const Icon = place.icon
                                const active = !place.plain && place.href === lit
                                const body = (
                                    <>
                                        <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors', active ? 'bg-red-600 text-white' : 'bg-white/[0.07] text-white/85 group-hover/place:bg-white/[0.12]')}>
                                            <Icon aria-hidden className="h-[18px] w-[18px]" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-center gap-2">
                                                <span className={cn('truncate text-[14.5px]', active ? 'font-semibold text-white' : 'font-medium text-white/90')}>{t(place.label)}</span>
                                                {place.badge && <span className="shrink-0 rounded-full bg-red-500/15 px-1.5 py-[3px] text-[9px] font-bold uppercase leading-none tracking-wide text-red-300 ring-1 ring-inset ring-red-500/25">{t(place.badge)}</span>}
                                            </span>
                                            {place.hint && <span className="mt-0.5 line-clamp-2 block text-[12.5px] leading-snug text-white/55">{t(place.hint)}</span>}
                                        </span>
                                    </>
                                )
                                const className = 'group/place flex min-h-[52px] items-center gap-3 rounded-[14px] px-2.5 py-2 outline-none transition-colors hover:bg-white/[0.06] focus-visible:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500'
                                return (
                                    <li key={place.href}>
                                        {place.plain
                                            ? <a href={place.href} className={className}>{body}</a>
                                            : <Link href={place.href} className={className} aria-current={active ? 'page' : undefined}>{body}</Link>}
                                    </li>
                                )
                            })}
                        </ul>
                    </m.div>
                )}
            </AnimatePresence>
        </>
    )
}
