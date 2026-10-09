"use client"
// The remote-friendly shell. In TV mode (cookie tf-tv=1) the root layout renders it instead of the
// Rail, TopBar, TabBar, Footer, PeekLayer, SearchPaletteHost and ShareSheetHost, on the same URLs:
// the TV bar (TV_NAV), the focus engine (arrows, OK, Back), and around them:
// - the phone-only pages (clips, swipe, friends, movie nights) say so instead of showing;
// - signed out, Sign in (and /login, /signup) opens "Sign in with your phone";
// - the first time, a card says how the remote works;
// - a live region says which page opened.
import './tv.css'
import type React from 'react'
import { useCallback, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useFocusEngine } from './use-focus-engine'
import { isTvUnavailable } from './focus-engine'
import TvNav from './TvNav'
import TvSignIn from './TvSignIn'
import TvCoach from './TvCoach'
import TvAnnouncer from './TvAnnouncer'
import TvUnavailable from './TvUnavailable'

const AUTH_PAGE = /^\/(login|signup)(\/|$)/

export default function TvShell({ children }: { children: React.ReactNode }): JSX.Element {
  const pathname = usePathname()
  const { status } = useSession()
  const [signInOpen, setSignInOpen] = useState(false)
  const [emailInstead, setEmailInstead] = useState(false)
  useFocusEngine()

  const authPage = AUTH_PAGE.test(pathname)
  // /login?via=email: the email form, as asked from the sign-in screen of another page.
  useEffect(() => {
    setEmailInstead(authPage && new URLSearchParams(window.location.search).get('via') === 'email')
  }, [authPage, pathname])

  const showSignIn = status === 'unauthenticated' && (signInOpen || (authPage && !emailInstead))

  const close = useCallback(() => {
    if (signInOpen) {
      setSignInOpen(false)
      // Back to the bar's Sign in button.
      window.setTimeout(() => document.querySelector<HTMLElement>('[data-tv-nav] button')?.focus({ preventScroll: true }), 0)
    } else if (window.history.length > 1) {
      window.history.back()
    } else {
      window.location.replace('/')
    }
  }, [signInOpen])

  const email = useCallback(() => {
    setSignInOpen(false)
    if (authPage) setEmailInstead(true)
    else window.location.assign(`/login?via=email&callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`)
  }, [authPage])

  // While the sign-in screen is up, the page under it can't be reached.
  const hidden = showSignIn ? ({ inert: '', 'aria-hidden': true } as Record<string, unknown>) : {}

  return (
    <>
      <div {...hidden}>
        <TvNav onSignIn={() => setSignInOpen(true)} />
        {isTvUnavailable(pathname) ? <TvUnavailable /> : children}
      </div>
      {showSignIn && <TvSignIn onClose={close} onEmail={email} />}
      <TvCoach paused={showSignIn} />
      <TvAnnouncer />
    </>
  )
}
