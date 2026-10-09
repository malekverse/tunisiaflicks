"use client"
import { useEffect, useRef, useState } from 'react'
import { m } from 'framer-motion'
import {
  BellRing, Clapperboard, Database, HandHeart, Languages, Library, Lock, ShieldCheck, Smartphone, UserRound, Users, type LucideIcon,
} from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import { spring } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import type { TKey } from '@/src/lib/i18n'

/**
 * The settings page's sections, in page order. The ids are anchors other pages link to.
 * `grownUp` sections are not on the page for a Kids profile, so they're not in the nav either.
 */
export const SETTINGS_SECTIONS: { id: string, label: TKey, icon: LucideIcon, grownUp?: boolean }[] = [
  { id: 'account', label: 'settings.account', icon: UserRound },
  { id: 'profiles', label: 'profiles.title', icon: Users },
  { id: 'privacy', label: 'social.privacy.title', icon: Lock, grownUp: true },
  { id: 'display', label: 'languages.settings.title', icon: Languages },
  { id: 'playback', label: 'settings.playback', icon: Clapperboard },
  { id: 'notifications', label: 'settings.notifications', icon: Smartphone },
  { id: 'following', label: 'alerts.following', icon: BellRing },
  { id: 'library', label: 'nav.library', icon: Library },
  { id: 'supporter', label: 'badges.supporter.title', icon: HandHeart, grownUp: true },
  { id: 'security', label: 'settings.security', icon: ShieldCheck },
  { id: 'data', label: 'settings.data', icon: Database },
]

// An entry whose section isn't on the page (not built yet, or with nothing to show) is hidden by CSS
// alone, so the list never changes after it has painted.
const HIDE_MISSING = SETTINGS_SECTIONS
  .map((section) => `body:not(:has(#${section.id})) [data-settings-link=${section.id}]{display:none}`)
  .join('')

/**
 * Desktop: a sticky list of the sections on the start side, the one being read highlighted.
 * Phones and tablets: the same links as a strip that scrolls sideways above the sections.
 * `kids` (from getKidsMode() on the server) leaves out the grown-up sections.
 */
export default function SettingsNav({ kids = false, className }: { kids?: boolean, className?: string }) {
  const t = useT()
  const visible = SETTINGS_SECTIONS.filter((section) => !(kids && section.grownUp))
  const [active, setActive] = useState(visible[0].id)
  const lockUntil = useRef(0)

  // Which section is being read: the last one whose top has passed the upper third of the screen.
  // The sections are looked up on every pass: some only appear once their data has loaded.
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      if (Date.now() < lockUntil.current) return
      const sections = SETTINGS_SECTIONS
        .map((section) => document.getElementById(section.id))
        .filter((node): node is HTMLElement => !!node)
      if (!sections.length) return
      const line = window.innerHeight * 0.33
      let current = sections[0].id
      for (const section of sections) {
        if (section.getBoundingClientRect().top - line <= 0) current = section.id
      }
      // At the very bottom, the last section is the one being read even if it's short.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = sections[sections.length - 1].id
      setActive(current)
    }
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(frame)
    }
  }, [])

  // Arriving on /profile#following: sections above it fill in after load (profiles, alerts...),
  // which pushes the target down, and some sections (#privacy) only appear once loaded. Settle on
  // it again, unless the reader has started scrolling.
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (!SETTINGS_SECTIONS.some((section) => section.id === id)) return
    if (document.getElementById(id)) setActive(id)
    let interacted = false
    const stop = () => { interacted = true }
    const events = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const
    events.forEach((event) => window.addEventListener(event, stop, { passive: true, once: true }))
    const settle = () => { if (!interacted) document.getElementById(id)?.scrollIntoView({ block: 'start' }) }
    const timers = [250, 800, 1600].map((ms) => setTimeout(settle, ms))
    return () => {
      timers.forEach(clearTimeout)
      events.forEach((event) => window.removeEventListener(event, stop))
    }
  }, [])

  return (
    <nav aria-label={t('nav.settings')} className={cn('lg:sticky lg:top-[calc(var(--topbar)+24px)]', className)}>
      <style dangerouslySetInnerHTML={{ __html: HIDE_MISSING }} />
      <ul className="no-scrollbar -mx-[var(--gutter)] flex gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain px-[var(--gutter)] lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0">
        {visible.map((section) => {
          const Icon = section.icon
          const current = active === section.id
          return (
            <li key={section.id} data-settings-link={section.id} className="shrink-0">
              <a
                href={`#${section.id}`}
                aria-current={current ? 'location' : undefined}
                onClick={() => {
                  setActive(section.id)
                  // Don't let the scroll spy flicker through the sections we fly past.
                  lockUntil.current = Date.now() + 900
                }}
                className={cn(
                  'relative flex h-10 select-none items-center gap-2.5 whitespace-nowrap rounded-full px-4 text-[14px] font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-red-500 lg:h-11 lg:gap-3',
                  current ? 'text-black lg:text-white' : 'text-white/60 hover:text-white',
                  !current && 'max-lg:bg-white/[0.05]',
                )}
              >
                {current && <m.span layoutId="settings-nav-pill" transition={spring.snappy} className="absolute inset-0 rounded-full bg-white lg:bg-white/[0.09]" />}
                <Icon aria-hidden className={cn('relative h-[18px] w-[18px]', current ? 'lg:text-white' : 'opacity-80')} strokeWidth={1.9} />
                <span className="relative">{t(section.label)}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
