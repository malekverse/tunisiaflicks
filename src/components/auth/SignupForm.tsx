"use client"
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import GoogleSignInButton from '@/src/components/GoogleSignInButton'
import { translateApiMessage } from '@/src/lib/i18n/translate'
import type { TKey } from '@/src/lib/i18n'
import AuthHeader from './AuthHeader'
import { EMAIL_RE, EmailInput, Field, FormNotice, PasswordInput, SubmitButton, focusFirst, invalidClass } from './fields'
import { Input } from '@/src/components/ui/input'
import { SIGNUP_EMAIL_KEY, withCallback } from './links'
import PasswordRule from './PasswordRule'

const MIN_PASSWORD = 8

type Problem = { key: TKey } | { text: string }

export default function SignupForm({ callbackUrl, googleEnabled }: { callbackUrl?: string, googleEnabled: boolean }) {
  const router = useRouter()
  const t = useT()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ name?: TKey, email?: TKey, password?: TKey }>({})
  const [problem, setProblem] = useState<Problem | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const { status } = useSession()

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(callbackUrl ?? '/') // Already logged in
    }
  }, [status, router, callbackUrl])

  if (status === 'authenticated') {
    return (
      <div className="grid min-h-[320px] place-items-center" role="status" aria-label={t('common.loading')}>
        <Loader2 aria-hidden className="h-7 w-7 animate-spin text-white/60" />
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return
    const found: typeof errors = {}
    if (!name.trim()) found.name = 'form.err.name'
    if (!EMAIL_RE.test(email.trim())) found.email = 'form.err.email'
    if (password.length < MIN_PASSWORD) found.password = 'auth.passwordTooShort'
    setErrors(found)
    if (Object.keys(found).length) {
      focusFirst(Object.keys(found))
      return
    }

    setProblem(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })

      if (response.ok) {
        // The login form fills the address in (kept out of the URL on purpose).
        try { sessionStorage.setItem(SIGNUP_EMAIL_KEY, email.trim()) } catch { /* private mode */ }
        router.push(withCallback('/login', callbackUrl, { created: '1' }))
        return
      }
      const data = await response.json().catch(() => ({}))
      const message = translateApiMessage(t, data.message)
      setProblem(message ? { text: message } : { key: 'auth.signUpError' })
    } catch (error) {
      console.error('Signup error:', error)
      setProblem({ key: 'common.unexpectedError' })
    }
    setIsLoading(false)
  }

  const clear = (field: keyof typeof errors) => setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current))

  return (
    <>
      <AuthHeader title={t('auth.signUpTitle')} subtitle={t('auth.signUpSub')} />

      <GoogleSignInButton available={googleEnabled} callbackUrl={callbackUrl ?? '/'} divider="after" />

      <form onSubmit={handleSubmit} noValidate className="flex flex-col">
        <div className="space-y-4">
          <Field id="name" label={t('auth.name')} error={errors.name && t(errors.name)}>
            {(a11y) => (
              <Input
                {...a11y}
                name="name"
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="next"
                maxLength={100}
                value={name}
                onChange={(e) => { setName(e.target.value); clear('name') }}
                className={invalidClass}
                required
              />
            )}
          </Field>
          <Field id="email" label={t('auth.email')} error={errors.email && t(errors.email)}>
            {(a11y) => (
              <EmailInput
                {...a11y}
                name="email"
                enterKeyHint="next"
                value={email}
                onChange={(e) => { setEmail(e.target.value); clear('email') }}
                required
              />
            )}
          </Field>
          <Field
            id="password"
            label={t('auth.password')}
            error={errors.password && t(errors.password)}
            hint={<PasswordRule met={password.length >= MIN_PASSWORD} label={t('auth.passwordHint')} />}
          >
            {(a11y) => (
              <PasswordInput
                {...a11y}
                name="password"
                autoComplete="new-password"
                enterKeyHint="go"
                minLength={MIN_PASSWORD}
                value={password}
                onChange={(e) => { setPassword(e.target.value); clear('password') }}
                required
              />
            )}
          </Field>
        </div>

        <FormNotice message={problem && ('key' in problem ? t(problem.key) : problem.text)} className="pt-5" />

        <SubmitButton loading={isLoading} loadingText={t('auth.signingUp')} className="mt-6 w-full">
          {t('nav.createAccount')}
        </SubmitButton>
      </form>

      <p className="mt-7 text-center text-[14px] text-white/55">
        {t('auth.haveAccount')}{' '}
        <Link href={withCallback('/login', callbackUrl)} className="font-medium text-white underline-offset-4 outline-none hover:underline focus-visible:underline">
          {t('nav.signIn')}
        </Link>
      </p>
    </>
  )
}
