"use client"
// A one-line hello for a first-time visitor on the home page: "New here? See what TunisiaFlicks can
// do", a link to the landing page (/about). Once per browser: it never comes back after it has
// shown, and never shows to anyone who has been here before (a visit in an earlier browser session,
// counted by AppOffer, or a signed-in account). The home page leaves it out for Kids profiles, in
// TV mode, and when there's no billboard (it would sit on the chips).
//
// It floats just under the top bar and scrolls away with the page, so it can't cover the
// billboard's Play button or the tab bar, and it takes no room: nothing on the server, then it
// slides in once the billboard has made its entrance (a plain fade for reduced motion).
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { AnimatePresence, m } from 'framer-motion'
import { ChevronRight, X } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import { tween } from '@/src/lib/motion'

const SEEN_KEY = 'tf-welcome-seen'
// AppOffer's visit counter, and its "this browser session is counted" mark.
const VISITS_KEY = 'tf-visits'
const VISIT_COUNTED_KEY = 'tf-visit-counted'
const DELAY_MS = 700

/** True the first time on a browser with no earlier visit; from then on, false. */
function firstTime(): boolean {
  try {
    if (localStorage.getItem(SEEN_KEY)) return false
    const visits = Number(localStorage.getItem(VISITS_KEY)) || 0
    const earlier = sessionStorage.getItem(VISIT_COUNTED_KEY) === '1' ? visits - 1 : visits
    if (earlier > 0) return false
    localStorage.setItem(SEEN_KEY, '1')
    return true
  } catch {
    return false // No storage, no way to show it only once: don't show it.
  }
}

export default function WelcomeStrip(): JSX.Element {
  const t = useT()
  const { status } = useSession()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (status !== 'unauthenticated') return
    const timer = window.setTimeout(() => {
      if (firstTime()) setOpen(true)
    }, DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [status])

  return (
    <AnimatePresence>
      {open && (
        <m.div
          role="region"
          aria-label={t('welcome.strip.aria')}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0, transition: tween.slow }}
          exit={{ opacity: 0, y: -8, transition: tween.fast }}
          className="page-x pointer-events-none absolute inset-x-0 top-[calc(var(--topbar)+env(safe-area-inset-top,0px)+8px)] z-30 flex justify-center"
        >
          <div className="glass-strong pointer-events-auto flex h-11 min-w-0 max-w-full items-center rounded-full shadow-[0_18px_50px_-12px_rgb(0_0_0/0.9)]">
            <Link
              href="/about"
              className="group flex h-full min-w-0 items-center gap-1.5 rounded-full pe-1 ps-3.5 text-[13px] outline-none sm:ps-4 focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <span className="shrink-0 font-semibold text-white">{t('welcome.strip.new')}</span>
              <span className="truncate text-white/70 transition-colors group-hover:text-white">{t('welcome.strip.see')}</span>
              <ChevronRight aria-hidden className="hidden h-4 w-4 shrink-0 text-white/50 rtl:rotate-180 sm:block" />
            </Link>
            <button
              type="button"
              aria-label={t('common.close')}
              onClick={() => setOpen(false)}
              className="pressable grid h-11 w-11 shrink-0 place-items-center rounded-full text-white/50 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <X aria-hidden className="h-4 w-4" />
            </button>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  )
}
