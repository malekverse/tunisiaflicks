"use client"
import { useEffect, useState } from 'react'
import { m } from 'framer-motion'
import { cn } from '@/src/lib/utils'
import { spring } from '@/src/lib/motion'

export type TocItem = { id: string, label: string }

/**
 * Desktop: the article's headings as a sticky list beside it. The section being read is marked
 * (a small red bar slides to it), and a click glides there (smooth scrolling lives in the CSS).
 */
export default function LegalToc({ items, title }: { items: TocItem[], title: string }) {
  const [active, setActive] = useState(items[0]?.id)

  useEffect(() => {
    const headings = items.map((item) => document.getElementById(item.id)).filter((node): node is HTMLElement => !!node)
    if (headings.length === 0) return
    // The current section is the last heading that has passed the upper third of the screen.
    const update = () => {
      const line = window.innerHeight * 0.33
      let current = headings[0].id
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top <= line) current = heading.id
      }
      // At the very bottom, the last section wins even if its heading never reached the line.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = headings[headings.length - 1].id
      setActive(current)
    }
    let frame = 0
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; update() }) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [items])

  return (
    <nav aria-label={title} className="sticky top-[calc(var(--topbar)+32px)]">
      <p className="mb-3 text-[13px] font-medium text-white/50">{title}</p>
      <ul className="relative border-s border-white/[0.08]">
        {items.map((item) => {
          const current = item.id === active
          return (
            <li key={item.id} className="relative">
              {current && (
                <m.span
                  layoutId="legal-toc-active"
                  transition={spring.ui}
                  aria-hidden
                  className="absolute -start-px top-1.5 bottom-1.5 w-[2px] rounded-full bg-red-500 shadow-[0_0_10px_rgb(255_36_20/0.6)]"
                />
              )}
              <a
                href={`#${item.id}`}
                aria-current={current ? 'location' : undefined}
                className={cn(
                  'block rounded-e-lg py-1.5 ps-4 pe-2 text-[14px] leading-snug outline-none transition-colors duration-200 focus-visible:bg-white/[0.06]',
                  current ? 'text-white' : 'text-white/50 hover:text-white/85',
                )}
              >
                {item.label}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
