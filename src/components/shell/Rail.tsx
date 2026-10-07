"use client"
import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { m } from 'framer-motion'
import { Settings } from 'lucide-react'
import { cn } from '@/src/lib/utils'
import { spring } from '@/src/lib/motion'
import { useI18n } from '@/src/components/I18nProvider'
import { BROWSE, EXTRAS, LIBRARY, isActive, type NavItem } from './nav'

const OPEN_DELAY = 90
const CLOSE_DELAY = 180

/**
 * Desktop navigation: a slim column of icons along the start edge. Hovering it (or tabbing into
 * it) unfolds a glass panel with the labels, *over* the page, so nothing underneath reflows.
 * The panel is always 256px wide and clipped down to the icon column while closed: unfolding is a
 * clip-path transition, which also keeps the hidden part from catching the mouse.
 */
export default function Rail() {
    const pathname = usePathname()
    const { t, dir } = useI18n()
    const [open, setOpen] = useState(false)
    const timer = useRef<ReturnType<typeof setTimeout>>()

    const schedule = (next: boolean) => {
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setOpen(next), next ? OPEN_DELAY : CLOSE_DELAY)
    }
    useEffect(() => () => clearTimeout(timer.current), [])
    // A click on a link folds the panel away right away.
    useEffect(() => setOpen(false), [pathname])

    const collapsedClip = dir === 'rtl' ? 'inset(0 0 0 calc(100% - var(--rail)))' : 'inset(0 calc(100% - var(--rail)) 0 0)'

    const item = (entry: NavItem, index: number) => {
        const active = !entry.plain && isActive(pathname, entry.href)
        const Icon = entry.icon
        const content = (
            <>
                {active && (
                    <m.span
                        layoutId="rail-active"
                        transition={spring.ui}
                        aria-hidden
                        className="absolute -start-2 top-[10px] h-6 w-[3px] rounded-e-full bg-red-500 shadow-[0_0_14px_2px_rgb(255_36_20/0.7)]"
                    />
                )}
                <span className="grid w-[calc(var(--rail)-16px)] shrink-0 place-items-center">
                    <Icon aria-hidden className={cn('h-[22px] w-[22px] transition-colors duration-200', active ? 'text-white' : 'text-white/55 group-hover:text-white')} strokeWidth={active ? 2.2 : 1.8} />
                </span>
                <span
                    className={cn(
                        'truncate pe-4 text-[15px] transition-[opacity,transform] duration-200 ease-out',
                        active ? 'font-semibold text-white' : 'text-white/70 group-hover:text-white',
                        open ? 'translate-x-0 opacity-100' : 'opacity-0 ltr:-translate-x-1 rtl:translate-x-1',
                    )}
                    style={{ transitionDelay: open ? `${60 + index * 18}ms` : '0ms' }}
                >
                    {t(entry.label)}
                </span>
            </>
        )
        const className = 'group relative mx-2 flex h-11 items-center rounded-xl outline-none transition-colors duration-150 hover:bg-white/[0.06] focus-visible:bg-white/[0.08] focus-visible:outline-none'
        return entry.plain ? (
            <a key={entry.href} href={entry.href} className={className} aria-label={t(entry.label)}>{content}</a>
        ) : (
            <Link key={entry.href} href={entry.href} className={className} aria-label={t(entry.label)} aria-current={active ? 'page' : undefined}>{content}</Link>
        )
    }

    let index = 0
    const group = (items: NavItem[]) => items.map((entry) => item(entry, index++))

    return (
        <aside
            aria-label={t('nav.primary')}
            onMouseEnter={() => schedule(true)}
            onMouseLeave={() => schedule(false)}
            onFocus={() => { clearTimeout(timer.current); setOpen(true) }}
            onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) schedule(false) }}
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
                    {group(BROWSE)}
                    <div aria-hidden className="mx-5 my-3 h-px bg-white/[0.08]" />
                    {group(LIBRARY)}
                    <div aria-hidden className="mx-5 my-3 h-px bg-white/[0.08]" />
                    {group(EXTRAS)}
                </nav>

                <div className="pt-3">
                    {item({ href: '/profile', label: 'nav.settings', icon: Settings }, index++)}
                </div>
            </div>
        </aside>
    )
}
