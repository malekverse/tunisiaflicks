"use client"
import React, { useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import { Button } from '@/src/components/ui/button'
import { LoadingButton } from '@/src/components/auth/fields'
import { translateApiMessage } from '@/src/lib/i18n'
import { cn } from '@/src/lib/utils'

/**
 * "Send me a new link" (signed in) or a prompt to log in first. `compact` is the inline link used
 * inside the verify-email reminder; the default is a full-width button for the verify page.
 */
export default function ResendVerificationButton({ compact = false }: { compact?: boolean }) {
  const t = useT()
  const { status } = useSession()
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  // Until we know who's here, hold the button's place rather than flash the wrong one.
  if (status === 'loading' && !compact) return <div aria-hidden className="h-12" />

  if (status === 'unauthenticated') {
    return compact
      ? <Link href="/login" className="font-semibold underline underline-offset-2 hover:text-white">{t('verify.loginToResend')}</Link>
      : <Button asChild size="lg" className="w-full"><Link href="/login">{t('verify.loginToResend')}</Link></Button>
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

  if (compact) {
    return (
      <span className="inline-flex items-center gap-2">
        <button
          type="button"
          onClick={resend}
          disabled={state === 'sending' || state === 'sent'}
          className="font-semibold underline underline-offset-2 hover:text-white disabled:no-underline disabled:opacity-70"
        >
          {state === 'sending' ? t('form.sending') : t('verify.resend')}
        </button>
        {message && <span role="status" className={cn('text-sm', state === 'error' && 'text-red-400')}>{message}</span>}
      </span>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <LoadingButton
        type="button"
        onClick={resend}
        loading={state === 'sending'}
        loadingText={t('form.sending')}
        disabled={state === 'sent'}
        className="w-full"
      >
        {state === 'sent' && <Check aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.4} />}
        {t('verify.resend')}
      </LoadingButton>
      {message && (
        <p role="status" className={cn('text-center text-[14px]', state === 'error' ? 'text-red-400' : 'text-white/70')}>{message}</p>
      )}
    </div>
  )
}
