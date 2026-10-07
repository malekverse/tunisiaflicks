"use client"
import React, { useEffect, useState } from 'react'
import { IoClose } from 'react-icons/io5'
import { useT } from '@/src/components/I18nProvider'
import { useAccount } from '@/src/hooks/use-account'
import ResendVerificationButton from '@/src/components/ResendVerificationButton'

const DISMISS_KEY = 'tf-verify-banner-dismissed'

/** Gentle reminder for signed-in users whose email isn't verified yet (dismissible per session). */
export default function VerifyEmailBanner() {
  const t = useT()
  const { account } = useAccount()
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try { setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1') } catch { setDismissed(false) }
  }, [])

  if (!account || account.emailVerified || !account.email || dismissed) return null

  return (
    <div role="region" aria-label={t('verify.title')} className="flex items-center gap-3 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200 sm:px-14">
      <p className="flex-1">
        {t('verify.banner', { email: account.email })}{' '}
        <ResendVerificationButton compact />
      </p>
      <button
        type="button"
        aria-label={t('common.close')}
        className="rounded-full p-1 hover:bg-amber-500/20"
        onClick={() => {
          setDismissed(true)
          try { sessionStorage.setItem(DISMISS_KEY, '1') } catch { /* private mode */ }
        }}
      >
        <IoClose />
      </button>
    </div>
  )
}
