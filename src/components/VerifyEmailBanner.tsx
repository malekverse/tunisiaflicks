"use client"
import React, { useEffect, useState } from 'react'
import { MailWarning, X } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import { useAccount } from '@/src/hooks/use-account'
import ResendVerificationButton from '@/src/components/ResendVerificationButton'

const DISMISS_KEY = 'tf-verify-banner-dismissed'

/**
 * Gentle reminder for signed-in users whose email isn't verified yet (dismissible per session).
 * A floating card in a corner, so it never pushes the page around.
 */
export default function VerifyEmailBanner() {
  const t = useT()
  const { account } = useAccount()
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try { setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1') } catch { setDismissed(false) }
  }, [])

  if (!account || account.emailVerified || !account.email || dismissed) return null

  return (
    <div
      role="region"
      aria-label={t('verify.title')}
      className="glass-strong fixed inset-x-3 bottom-[calc(var(--tabbar-space)+8px)] z-30 mx-auto flex max-w-md items-start gap-3 rounded-[20px] p-4 text-sm shadow-[0_18px_50px_-12px_rgb(0_0_0/0.9)] animate-in fade-in slide-in-from-bottom-4 duration-500 lg:inset-x-auto lg:bottom-6 lg:end-6 lg:mx-0"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-400/15 text-amber-300">
        <MailWarning aria-hidden className="h-[18px] w-[18px]" />
      </span>
      <p className="flex-1 text-white/80">
        {t('verify.banner', { email: account.email })}{' '}
        <ResendVerificationButton compact />
      </p>
      <button
        type="button"
        aria-label={t('common.close')}
        className="pressable -m-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/50 hover:bg-white/10 hover:text-white"
        onClick={() => {
          setDismissed(true)
          try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* private mode */ }
        }}
      >
        <X aria-hidden className="h-4 w-4" />
      </button>
    </div>
  )
}
