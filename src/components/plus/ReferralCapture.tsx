"use client"
// A friend's invite link (?ref=code on any page): remembered on this device for 30 days, with a
// small welcome for someone not signed in yet; once they have an account (a new one), it's
// claimed for the friend (POST /api/referrals/claim), who gets closer to a free month of Plus.
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { AnimatePresence, m } from 'framer-motion'
import { Gift, X } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { useT } from '@/src/components/I18nProvider'
import { toast } from '@/src/hooks/use-toast'
import { REF_KEEP_DAYS, isRefCode } from '@/src/lib/plus-rules'
import { tween } from '@/src/lib/motion'

const KEY = 'tf-ref'
const DISMISSED = 'tf-ref-welcome-dismissed'

type Kept = { code: string, at: number }

function readKept(): Kept | null {
  try {
    const kept = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!kept || !isRefCode(kept.code) || typeof kept.at !== 'number') return null
    if (Date.now() - kept.at > REF_KEEP_DAYS * 86_400_000) {
      localStorage.removeItem(KEY)
      return null
    }
    return kept
  } catch {
    return null
  }
}

export default function ReferralCapture() {
  const t = useT()
  const { status } = useSession()
  const [welcome, setWelcome] = useState(false)

  // Take ?ref= off the address (it's remembered), whatever page it came on.
  useEffect(() => {
    const url = new URL(window.location.href)
    const code = url.searchParams.get('ref')
    if (!code) return
    url.searchParams.delete('ref')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
    if (!isRefCode(code)) return
    try {
      if (!readKept()) localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() }))
    } catch { /* private mode */ }
  }, [])

  useEffect(() => {
    if (status === 'loading') return
    const kept = readKept()
    if (!kept) return
    if (status === 'unauthenticated') {
      try { setWelcome(sessionStorage.getItem(DISMISSED) !== '1') } catch { setWelcome(true) }
      return
    }
    setWelcome(false)
    let cancelled = false
    fetch('/api/referrals/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: kept.code }) })
      .then((response) => (response.ok ? response.json() : null))
      .then((answer) => {
        if (cancelled || !answer) return
        // Any final answer: the link has done its job on this device.
        try { localStorage.removeItem(KEY) } catch { /* fine */ }
        if (answer.result === 'claimed') toast({ title: t('referral.claimedTitle'), description: t('referral.claimedText'), duration: 6000 })
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [status, t])

  const dismiss = () => {
    setWelcome(false)
    try { sessionStorage.setItem(DISMISSED, '1') } catch { /* fine */ }
  }

  return (
    <AnimatePresence>
      {welcome && (
        <m.aside
          role="dialog"
          aria-labelledby="referral-welcome"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12, transition: tween.fast }}
          transition={tween.slow}
          className="glass-strong fixed inset-x-3 bottom-[calc(var(--tabbar-space)+8px)] z-[55] mx-auto max-w-md rounded-[22px] p-4 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.95)] lg:bottom-6"
        >
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-red-600 text-white"><Gift aria-hidden className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p id="referral-welcome" className="font-display text-[18px] font-bold leading-tight text-white">{t('referral.welcomeTitle')}</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-white/65">{t('referral.welcomeText')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm"><Link href="/signup" onClick={() => setWelcome(false)}>{t('referral.signUp')}</Link></Button>
                <Button asChild size="sm" variant="ghost"><Link href="/login" onClick={() => setWelcome(false)}>{t('referral.signIn')}</Link></Button>
              </div>
            </div>
            <button type="button" onClick={dismiss} aria-label={t('common.close')} className="pressable -me-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/60 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-red-500">
              <X aria-hidden className="h-4 w-4" />
            </button>
          </div>
        </m.aside>
      )}
    </AnimatePresence>
  )
}
