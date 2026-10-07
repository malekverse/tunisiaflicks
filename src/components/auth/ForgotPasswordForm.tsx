"use client"
import { useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, m } from 'framer-motion'
import { useT } from '@/src/components/I18nProvider'
import { Button } from '@/src/components/ui/button'
import { translateApiMessage, type TKey } from '@/src/lib/i18n'
import { EASE_OUT } from '@/src/lib/motion'
import AuthHeader from './AuthHeader'
import { EMAIL_RE, EmailInput, Field, FormNotice, SubmitButton, SuccessCheck } from './fields'

type Problem = { key: TKey } | { text: string }

const swap = {
  initial: { opacity: 0, y: 8, filter: 'blur(4px)' },
  animate: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.32, ease: EASE_OUT } },
  exit: { opacity: 0, y: -6, filter: 'blur(4px)', transition: { duration: 0.16, ease: EASE_OUT } },
}

export default function ForgotPasswordForm() {
  const t = useT()
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<TKey | null>(null)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [sent, setSent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError('form.err.email')
      document.getElementById('email')?.focus()
      return
    }
    setProblem(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (response.ok) {
        setSent(true)
        // Clear the email field after successful submission
        setEmail('')
      } else {
        const message = translateApiMessage(t, data.message)
        setProblem(message ? { text: message } : { key: 'auth.genericError' })
      }
    } catch (error) {
      console.error('Forgot password error:', error)
      setProblem({ key: 'common.unexpectedError' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {sent ? (
        <m.div key="sent" {...swap} role="status">
          <SuccessCheck className="mb-6" />
          <AuthHeader title={t('auth.checkInbox')} subtitle={t('auth.resetLinkSent')} />
          <div className="flex flex-col gap-3">
            <Button asChild size="lg" variant="secondary" className="w-full">
              <Link href="/login">{t('auth.backToLogin')}</Link>
            </Button>
            <Button type="button" size="lg" variant="ghost" className="w-full" onClick={() => setSent(false)}>
              {t('auth.tryAnotherEmail')}
            </Button>
          </div>
        </m.div>
      ) : (
        <m.div key="form" {...swap}>
          {/* Same question as the link that brought them here. */}
          <AuthHeader title={t('auth.forgotLink')} subtitle={t('auth.forgotDesc')} />
          <form onSubmit={handleSubmit} noValidate className="flex flex-col">
            <Field id="email" label={t('auth.email')} error={emailError && t(emailError)}>
              {(a11y) => (
                <EmailInput
                  {...a11y}
                  name="email"
                  enterKeyHint="send"
                  autoFocus
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(null) }}
                  required
                />
              )}
            </Field>

            <FormNotice message={problem && ('key' in problem ? t(problem.key) : problem.text)} className="pt-5" />

            <SubmitButton loading={isLoading} loadingText={t('auth.sending')} className="mt-6 w-full">
              {t('auth.sendLink')}
            </SubmitButton>
          </form>

          <p className="mt-7 text-center text-[14px] text-white/55">
            {t('auth.rememberPassword')}{' '}
            <Link href="/login" className="font-medium text-white underline-offset-4 outline-none hover:underline focus-visible:underline">
              {t('nav.signIn')}
            </Link>
          </p>
        </m.div>
      )}
    </AnimatePresence>
  )
}
