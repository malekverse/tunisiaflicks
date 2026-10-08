"use client"
import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { m } from 'framer-motion'
import { useT } from '@/src/components/I18nProvider'
import { LIBRARY, isActive } from '@/src/components/shell/nav'
import { spring } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'

/**
 * History / Favorites / Saved / My lists as one segmented control. The white pill slides to the
 * tapped section right away (before the next page has loaded), so the four pages feel like one
 * place. On phones the control scrolls sideways, edge to edge.
 */
export function LibraryTabs({ className }: { className?: string }) {
  const t = useT()
  const pathname = usePathname()
  const current = LIBRARY.find((item) => isActive(pathname, item.href))?.href
  const [selected, setSelected] = useState(current)
  const activeRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => setSelected(current), [current])

  // Phones: keep the current section in view inside the scrolling strip (no page scroll).
  useEffect(() => {
    let cancelled = false
    const center = () => {
      const tab = activeRef.current
      const strip = tab?.closest<HTMLElement>('[data-strip]')
      if (cancelled || !tab || !strip || strip.scrollWidth <= strip.clientWidth) return
      const tabBox = tab.getBoundingClientRect()
      const stripBox = strip.getBoundingClientRect()
      strip.scrollLeft += tabBox.left + tabBox.width / 2 - (stripBox.left + stripBox.width / 2)
    }
    center()
    // The labels only get their final width once the web fonts are in.
    document.fonts?.ready.then(center)
    return () => { cancelled = true }
  }, [])

  return (
    <nav aria-label={t('nav.library')} className={className}>
      <div data-strip className="no-scrollbar -mx-[var(--gutter)] overflow-x-auto overflow-y-hidden overscroll-x-contain px-[var(--gutter)]">
        <ul className="inline-flex gap-0.5 rounded-full bg-white/[0.07] p-1 ring-1 ring-inset ring-white/[0.05]">
          {LIBRARY.map((item) => {
            const Icon = item.icon
            const active = selected === item.href
            return (
              <li key={item.href}>
                <Link
                  ref={item.href === current ? activeRef : undefined}
                  href={item.href}
                  aria-current={item.href === current ? 'page' : undefined}
                  onClick={() => setSelected(item.href)}
                  className={cn(
                    'relative flex h-10 select-none items-center gap-2 whitespace-nowrap rounded-full px-4 text-[14px] font-medium outline-none transition-colors duration-200 [-webkit-touch-callout:none] focus-visible:ring-2 focus-visible:ring-red-500 sm:h-9',
                    active ? 'text-black' : 'text-white/70 hover:text-white',
                  )}
                >
                  {active && <m.span layoutId="library-tab-pill" transition={spring.snappy} className="absolute inset-0 rounded-full bg-white shadow-[0_4px_14px_-6px_rgb(255_255_255/0.5)]" />}
                  <Icon aria-hidden className="relative h-4 w-4" strokeWidth={2} />
                  <span className="relative">{t(item.label)}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}

/**
 * The top of every library page: the section switcher, then the page's big title, a one-line
 * subtitle, and optional actions on the end side. `toolbar` (filters) sits under it.
 */
export default function LibraryHeader({ title, subtitle, actions, toolbar }: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  toolbar?: React.ReactNode
}) {
  return (
    <header className="page-x">
      <LibraryTabs />
      <div className="mt-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 sm:mt-9">
        <div className="min-w-0">
          <h1 className="font-display text-[clamp(34px,5vw,64px)] font-extrabold leading-[0.95] text-white">{title}</h1>
          {/* Always one line tall, so the page doesn't jump when the count arrives. */}
          <p className="mt-2.5 min-h-[1.5em] text-[15px] text-white/55">{subtitle}</p>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {toolbar && <div className="mt-5">{toolbar}</div>}
    </header>
  )
}
