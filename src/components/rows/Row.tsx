"use client"
import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/src/lib/utils'
import { useI18n } from '@/src/components/I18nProvider'

/**
 * A section title, aligned with the page column, with an optional "See all" link and an optional
 * `end` slot (a small action, a filter, a count) on the inline end, before "See all".
 */
export function SectionHeader({ title, href, subtitle, end, className, as: Heading = 'h2' }: {
    title: React.ReactNode
    href?: string
    subtitle?: React.ReactNode
    end?: React.ReactNode
    className?: string
    as?: 'h1' | 'h2'
}) {
    const { t } = useI18n()
    const seeAll = href && (
        <Link href={href} className="group/see -my-2 inline-flex shrink-0 items-center gap-0.5 rounded-full py-2 ps-3 text-[13px] font-medium text-white/55 transition-colors hover:text-white">
            {t('common.seeAll')}
            <ChevronRight aria-hidden className="h-4 w-4 transition-transform duration-200 ease-out group-hover/see:translate-x-0.5 rtl:rotate-180 rtl:group-hover/see:-translate-x-0.5" />
        </Link>
    )
    return (
        <div className={cn('page-x mb-3 flex items-end justify-between gap-4 sm:mb-4', className)}>
            <div className="min-w-0">
                <Heading className="font-display text-[21px] font-bold leading-tight text-white sm:text-[26px]">{title}</Heading>
                {subtitle && <p className="mt-0.5 text-[13px] text-white/50">{subtitle}</p>}
            </div>
            {end ? (
                <div className="flex shrink-0 items-center gap-1">
                    {end}
                    {seeAll}
                </div>
            ) : seeAll}
        </div>
    )
}

/**
 * A horizontal row that scrolls edge to edge (from the rail to the screen edge), with native
 * momentum and snapping on touch, and page-by-page arrows on desktop that appear on hover and
 * only where there's more to see.
 */
export function Row({ children, className, itemClassName, gap = 'gap-3 sm:gap-4', label }: {
    children: React.ReactNode
    className?: string
    /** Width (and anything else) of each item. */
    itemClassName?: string
    gap?: string
    label?: string
}) {
    const { t, dir } = useI18n()
    const scroller = useRef<HTMLDivElement>(null)
    const [edges, setEdges] = useState({ prev: false, next: false })

    const measure = useCallback(() => {
        const node = scroller.current
        if (!node) return
        const position = Math.abs(node.scrollLeft)
        const max = node.scrollWidth - node.clientWidth
        setEdges((current) => {
            const next = { prev: position > 4, next: position < max - 4 }
            return current.prev === next.prev && current.next === next.next ? current : next
        })
    }, [])

    useEffect(() => {
        const node = scroller.current
        if (!node) return
        measure()
        let frame = 0
        const onScroll = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; measure() }) }
        node.addEventListener('scroll', onScroll, { passive: true })
        const observer = new ResizeObserver(measure)
        observer.observe(node)
        return () => {
            node.removeEventListener('scroll', onScroll)
            observer.disconnect()
            cancelAnimationFrame(frame)
        }
    }, [measure])

    /** One "page" towards the end (+1) or the start (-1), in reading direction. */
    const page = (direction: 1 | -1) => {
        const node = scroller.current
        if (!node) return
        const amount = Math.max(node.clientWidth * 0.82, 240)
        node.scrollBy({ left: amount * direction * (dir === 'rtl' ? -1 : 1), behavior: 'smooth' })
    }

    const arrow = (direction: 1 | -1) => {
        const enabled = direction === 1 ? edges.next : edges.prev
        const atStart = direction === -1
        const Icon = (atStart ? dir !== 'rtl' : dir === 'rtl') ? ChevronLeft : ChevronRight
        return (
            <button
                type="button"
                tabIndex={-1}
                aria-label={atStart ? t('row.previous') : t('row.next')}
                onClick={() => page(direction)}
                className={cn(
                    'absolute inset-y-0 z-10 hidden w-[max(var(--gutter),48px)] items-center justify-center text-white opacity-0 outline-none transition-opacity duration-200 ease-out lg:flex',
                    atStart
                        ? 'start-[var(--rail)] bg-gradient-to-r from-black/90 via-black/50 to-transparent rtl:bg-gradient-to-l'
                        : 'end-0 bg-gradient-to-l from-black/90 via-black/50 to-transparent rtl:bg-gradient-to-r',
                    enabled ? 'group-hover/row:opacity-100' : 'pointer-events-none',
                )}
            >
                <Icon aria-hidden className="h-9 w-9 drop-shadow-[0_2px_8px_rgb(0_0_0/0.8)] transition-transform duration-200 hover:scale-110" strokeWidth={2.2} />
            </button>
        )
    }

    return (
        <div className={cn('group/row relative', className)}>
            <div
                ref={scroller}
                role={label ? 'list' : undefined}
                aria-label={label}
                // The vertical padding leaves room for cards lifting on hover (the row clips both axes).
                className={cn('rail-x no-scrollbar -my-3 flex snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain px-[var(--gutter)] py-3 [scroll-padding-inline:var(--gutter)] lg:snap-proximity', gap)}
            >
                {React.Children.map(children, (child) => child && (
                    <div role={label ? 'listitem' : undefined} className={cn('shrink-0 snap-start', itemClassName)}>{child}</div>
                ))}
            </div>
            {arrow(-1)}
            {arrow(1)}
        </div>
    )
}

/** Standard widths, so every row of the same kind lines up. */
export const ROW_WIDTH = {
    poster: 'w-[34vw] max-w-[150px] sm:w-[156px] sm:max-w-none lg:w-[168px] 2xl:w-[196px]',
    landscape: 'w-[74vw] max-w-[320px] sm:w-[300px] sm:max-w-none lg:w-[320px] 2xl:w-[360px]',
}
