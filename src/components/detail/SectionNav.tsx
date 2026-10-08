"use client"
import { useEffect, useState } from 'react'
import { m } from 'framer-motion'
import { cn } from '@/src/lib/utils'
import { spring } from '@/src/lib/motion'
import { useScrollChrome } from '@/src/hooks/use-scroll-chrome'
import { useT } from '@/src/components/I18nProvider'

export type Section = { id: string, label: string }

/**
 * The page's chapters (Watch, Episodes, More like this...), pinned under the top bar once the
 * hero has scrolled away. The underline follows the section in view; a tap glides to a section.
 */
export default function SectionNav({ sections }: { sections: Section[] }) {
    const t = useT()
    const [active, setActive] = useState(sections[0]?.id)
    const { retracted } = useScrollChrome()

    useEffect(() => {
        const elements = sections.map((section) => document.getElementById(section.id)).filter((node): node is HTMLElement => !!node)
        if (!elements.length) return
        // A section is "current" while it crosses the band just under the pinned bars.
        const observer = new IntersectionObserver((entries) => {
            const visible = entries.filter((entry) => entry.isIntersecting)
            if (visible.length) setActive(visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0].target.id)
        }, { rootMargin: '-30% 0px -60% 0px' })
        elements.forEach((node) => observer.observe(node))
        return () => observer.disconnect()
    }, [sections])

    if (sections.length < 2) return null

    return (
        <nav
            aria-label={t('detail.sections')}
            // Pinned under the top bar; on phones the top bar tucks away while scrolling down, and this
            // bar slides up with it.
            className={cn('sticky z-30 transition-transform duration-300 ease-out', retracted && 'max-lg:-translate-y-[var(--topbar)]')}
            style={{ top: 'calc(var(--topbar) + env(safe-area-inset-top, 0px))' }}
        >
            <div className="glass-strong border-x-0 border-t-0">
                <div className="page-x no-scrollbar flex gap-1 overflow-x-auto overflow-y-hidden">
                    {sections.map((section) => {
                        const current = section.id === active
                        return (
                            <a
                                key={section.id}
                                href={`#${section.id}`}
                                onClick={(event) => {
                                    event.preventDefault()
                                    setActive(section.id)
                                    document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                                }}
                                aria-current={current ? 'location' : undefined}
                                className={cn('relative shrink-0 px-3 py-3.5 text-[14px] font-medium outline-none transition-colors duration-200 focus-visible:text-white', current ? 'text-white' : 'text-white/55 hover:text-white/85')}
                            >
                                {section.label}
                                {current && <m.span layoutId="section-underline" transition={spring.ui} aria-hidden className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-red-500 shadow-[0_0_10px_rgb(255_36_20/0.8)]" />}
                            </a>
                        )
                    })}
                </div>
            </div>
        </nav>
    )
}
