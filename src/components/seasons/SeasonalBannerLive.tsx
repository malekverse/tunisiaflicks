"use client"
import { useEffect, useState } from 'react'
import { m } from 'framer-motion'
import { X } from 'lucide-react'
import SeasonCountdown from '@/src/components/seasons/SeasonCountdown'
import { tween } from '@/src/lib/motion'
import { SEASON_DISMISS_COOKIE, parseDismissed, withDismissal, type CountdownParts } from '@/src/lib/seasons'

const ONE_YEAR = 60 * 60 * 24 * 365

function readCookie(name: string): string | undefined {
  const entry = document.cookie.split('; ').find((part) => part.startsWith(`${name}=`))
  return entry ? entry.slice(name.length + 1) : undefined
}

function writeDismissed(value: string) {
  document.cookie = `${SEASON_DISMISS_COOKIE}=${value}; path=/; max-age=${ONE_YEAR}; samesite=lax`
}

/** The banner's live countdown (its eve): the server's numbers first, then the browser's clock. */
export default function SeasonalBannerLive({ at, initial, seconds, zeroTitle }: {
  /** The moment, in ms since the epoch, already on the browser's clock (a dev preview shifts it). */
  at: number
  initial: CountdownParts
  seconds: boolean
  zeroTitle: string
}) {
  return <SeasonCountdown at={at} initial={initial} seconds={seconds} zeroTitle={zeroTitle} size="sm" />
}

/**
 * Around the banner: its place in the page, and the X that hides this occurrence of it. The X is a
 * sibling of the card's link, over its top end corner. Dismissing writes the cookie the server
 * reads (so the next page comes without the banner, no flash) and a copy in localStorage, then
 * folds the banner away; nothing moves on mount.
 */
export function SeasonalBannerFrame({ entry, label, children }: {
  /** 'id:occurrence' */
  entry: string
  /** The X's accessible name. */
  label: string
  children: React.ReactNode
}) {
  const [dismissed, setDismissed] = useState(false)
  const [gone, setGone] = useState(false)

  // A cookie cleared while localStorage was kept: put the dismissals back for the next page.
  useEffect(() => {
    try {
      const saved = parseDismissed(localStorage.getItem(SEASON_DISMISS_COOKIE))
      const current = parseDismissed(readCookie(SEASON_DISMISS_COOKIE))
      const missing = saved.filter((item) => !current.includes(item))
      if (missing.length) writeDismissed(missing.reduce((value, item) => withDismissal(value, item), current.join('|')))
    } catch {
      // Storage blocked: the cookie alone decides.
    }
  }, [])

  const dismiss = () => {
    const next = withDismissal(readCookie(SEASON_DISMISS_COOKIE), entry)
    writeDismissed(next)
    try {
      localStorage.setItem(SEASON_DISMISS_COOKIE, withDismissal(localStorage.getItem(SEASON_DISMISS_COOKIE), entry))
    } catch {
      // Private mode: the cookie is enough.
    }
    setDismissed(true)
  }

  if (gone) return null
  return (
    <m.section
      aria-labelledby="season-banner-title"
      className="page-x"
      initial={false}
      animate={dismissed ? { opacity: 0, height: 0, marginTop: 0 } : { opacity: 1, height: 'auto' }}
      transition={tween.fast}
      style={dismissed ? { overflow: 'hidden' } : undefined}
      onAnimationComplete={() => {
        if (dismissed) setGone(true)
      }}
    >
      <div className="relative">
        {children}
        <button
          type="button"
          aria-label={label}
          onClick={dismiss}
          disabled={dismissed}
          className="group/x pressable absolute end-1 top-1 z-10 grid h-11 w-11 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-red-500 sm:end-1.5 sm:top-1.5"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white/[0.06] text-white/60 ring-1 ring-white/[0.08] transition-colors duration-150 group-hover/x:bg-white/[0.12] group-hover/x:text-white">
            <X aria-hidden className="h-4 w-4" strokeWidth={2.2} />
          </span>
        </button>
      </div>
    </m.section>
  )
}
