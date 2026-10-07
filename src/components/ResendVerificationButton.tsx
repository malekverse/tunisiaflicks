"use client"
import React, { useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useT } from '@/src/components/I18nProvider'
import { translateApiMessage } from '@/src/lib/i18n'

/** "Send me a new link" (signed in) or a prompt to log in first. */
export default function ResendVerificationButton({ compact = false }: { compact?: boolean }) {
  const t = useT()
  const { status } = useSession()
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  if (status === 'unauthenticated') {
    return <Link href="/login" className="text-sm text-red-500 hover:underline">{t('verify.loginToResend')}</Link>
  }

  const resend = async () => {
    setState('sending')
    setMessage(null)
    try {
      const response = await fetch('/api/auth/verify-email/resend', { method: 'POST' })
      const data = await response.json().catch(() => ({}))
      if (response.ok) {
        setState('sent')
        setMessage(data.alreadyVerified ? t('verify.alreadyDesc') : t('verify.resent'))
      } else {
        setState('error')
        setMessage(translateApiMessage(t, data.message) ?? t('verify.resendFailed'))
      }
    } catch {
      setState('error')
      setMessage(t('verify.resendFailed'))
    }
  }

  return (
    <span className={compact ? 'inline-flex items-center gap-2' : 'flex flex-col items-center gap-2'}>
      <button
        type="button"
        onClick={resend}
        disabled={state === 'sending' || state === 'sent'}
        className={compact
          ? 'font-semibold underline underline-offset-2 hover:text-white disabled:no-underline disabled:opacity-70'
          : 'rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-400 disabled:opacity-60'}
      >
        {state === 'sending' ? t('form.sending') : t('verify.resend')}
      </button>
      {message && <span role="status" className={`text-sm ${state === 'error' ? 'text-red-400' : ''}`}>{message}</span>}
    </span>
  )
}
