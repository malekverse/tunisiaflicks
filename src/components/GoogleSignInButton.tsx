"use client"
import React, { useEffect, useState } from 'react'
import { getProviders, signIn } from 'next-auth/react'
import { Loader2 } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import { cn } from '@/src/lib/utils'

/**
 * "Continue with Google", rendered only when Google sign-in is configured on the server
 * (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET), with an "or" divider between it and the email form.
 * Pages that already know (server-side) pass `available`, so the button is there on first paint;
 * without it, the button asks next-auth for the providers and appears once they're known.
 */
export default function GoogleSignInButton({ callbackUrl = '/', available, divider = 'before', className }: {
  callbackUrl?: string
  available?: boolean
  /** Where the "or" divider goes: above the button (form first) or below it (Google first). */
  divider?: 'before' | 'after'
  className?: string
}) {
  const t = useT()
  const [found, setFound] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (available !== undefined) return
    let cancelled = false
    getProviders().then((providers) => { if (!cancelled) setFound(!!providers?.google) }).catch(() => {})
    return () => { cancelled = true }
  }, [available])

  // Coming back with the browser's Back button (page restored from the back/forward cache): the
  // redirect to Google was abandoned, so the button shouldn't keep spinning.
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => { if (event.persisted) setBusy(false) }
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [])

  if (!(available ?? found)) return null

  const rule = (
    <div className={cn('flex items-center gap-4 text-[13px] text-white/45', divider === 'before' ? 'mb-5' : 'mt-5')}>
      <span aria-hidden className="h-px flex-1 bg-white/10" />
      {t('auth.or')}
      <span aria-hidden className="h-px flex-1 bg-white/10" />
    </div>
  )

  return (
    <div className={cn(divider === 'before' ? 'mt-5' : 'mb-5', className)}>
      {divider === 'before' && rule}
      <button
        type="button"
        disabled={busy}
        aria-busy={busy || undefined}
        onClick={() => { setBusy(true); signIn('google', { callbackUrl }) }}
        className="pressable flex h-12 w-full items-center justify-center gap-3 rounded-full bg-white/[0.07] px-5 text-[15px] font-medium text-white outline-none ring-1 ring-inset ring-white/10 transition-[background-color,box-shadow] duration-150 hover:bg-white/[0.11] hover:ring-white/20 focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-default"
      >
        <span className="grid h-5 w-5 place-items-center">
          {busy ? (
            <Loader2 aria-hidden className="h-[18px] w-[18px] animate-spin text-white/80" />
          ) : (
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
            </svg>
          )}
        </span>
        {t('auth.continueWithGoogle')}
      </button>
      {divider === 'after' && rule}
    </div>
  )
}
