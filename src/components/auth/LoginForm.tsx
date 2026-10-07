"use client"
import { useEffect, useRef, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import GoogleSignInButton from '@/src/components/GoogleSignInButton'
import type { TKey } from '@/src/lib/i18n'
import AuthHeader from './AuthHeader'
import { EMAIL_RE, EmailInput, Field, FormNotice, PasswordInput, SubmitButton, focusFirst } from './fields'
import { SIGNUP_EMAIL_KEY, afterSignIn, withCallback } from './links'

// A problem is kept as a dictionary key when we have one, so it follows a language switch.
type Problem = { key: TKey } | { text: string }

// next-auth sends errors back here as ?error=<code> (e.g. a cancelled Google sign-in).
const codeProblem = (code: string): Problem => ({
  key: code === 'OAuthAccountNotLinked' ? 'auth.oauthNotLinked'
    : code === 'AccessDenied' ? 'auth.oauthDenied'
    : code === 'CredentialsSignin' ? 'auth.invalidCredentials'
    : 'auth.oauthFailed',
})

export default function LoginForm({ callbackUrl, errorCode, created = false, googleEnabled }: {
  callbackUrl?: string
  errorCode?: string
  /** Just signed up: say so, and fill in the address they used. */
  created?: boolean
  googleEnabled: boolean
}) {
  const router = useRouter()
  const t = useT()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: TKey, password?: TKey }>({})
  const [problem, setProblem] = useState<Problem | null>(() => (errorCode ? codeProblem(errorCode) : null))
  const [isLoading, setIsLoading] = useState(false)
  const signedInHere = useRef(false)

  const { status } = useSession()

  // Already signed in (another tab, or the session arrived late): nothing to do here.
  useEffect(() => {
    if (status === 'authenticated' && !signedInHere.current) {
      router.replace(callbackUrl ?? '/')
    }
  }, [status, router, callbackUrl])

  useEffect(() => {
    if (!created) return
    try {
      const saved = sessionStorage.getItem(SIGNUP_EMAIL_KEY)
      if (saved) {
        setEmail((current) => current || saved)
        sessionStorage.removeItem(SIGNUP_EMAIL_KEY)
        document.getElementById('password')?.focus()
      }
    } catch {
      // Storage blocked (private mode): they'll type it.
    }
  }, [created])

  if (status === 'authenticated' && !signedInHere.current) {
    return (
      <div className="grid min-h-[280px] place-items-center" role="status" aria-label={t('common.loading')}>
        <Loader2 aria-hidden className="h-7 w-7 animate-spin text-white/60" />
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return
    const found: typeof errors = {}
    if (!EMAIL_RE.test(email.trim())) found.email = 'form.err.email'
    if (!password) found.password = 'auth.err.password'
    setErrors(found)
    if (Object.keys(found).length) {
      focusFirst(Object.keys(found))
      return
    }

    setProblem(null)
    setIsLoading(true)

    try {
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
      })

      if (result?.error) {
        setProblem(result.error === 'TooManyAttempts' ? { key: 'auth.tooManyAttempts' }
          : result.error === 'CredentialsSignin' ? { key: 'auth.invalidCredentials' }
          : { text: result.error })
        setIsLoading(false)
      } else {
        // "Who's watching?" (it goes straight on when the account has a single profile). The
        // button keeps spinning until the next page takes over.
        signedInHere.current = true
        router.push(afterSignIn(callbackUrl))
        router.refresh()
      }
    } catch (error) {
      console.error('Login error:', error)
      setProblem({ key: 'common.unexpectedError' })
      setIsLoading(false)
    }
  }

  const clear = (field: keyof typeof errors) => setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current))

  return (
    <>
      <AuthHeader title={t('auth.loginTitle')} subtitle={t('auth.loginSub')} />

      <FormNotice tone="info" message={created && !problem ? t('auth.accountCreated') : null} className="pb-5" />

      <GoogleSignInButton available={googleEnabled} callbackUrl={callbackUrl ?? '/'} divider="after" />

      <form onSubmit={handleSubmit} noValidate className="flex flex-col">
        <div className="space-y-4">
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
            aside={(
              <Link href="/auth/forgot-password" className="-my-2 rounded-md py-2 text-[13px] text-white/55 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-red-500">
                {t('auth.forgotLink')}
              </Link>
            )}
          >
            {(a11y) => (
              <PasswordInput
                {...a11y}
                name="password"
                autoComplete="current-password"
                enterKeyHint="go"
                value={password}
                onChange={(e) => { setPassword(e.target.value); clear('password') }}
                required
              />
            )}
          </Field>
        </div>

        <FormNotice message={problem && ('key' in problem ? t(problem.key) : problem.text)} className="pt-5" />

        <SubmitButton loading={isLoading} loadingText={t('auth.loggingIn')} className="mt-6 w-full">
          {t('nav.signIn')}
        </SubmitButton>
      </form>

      <p className="mt-7 text-center text-[14px] text-white/55">
        {t('auth.noAccount')}{' '}
        <Link href={withCallback('/signup', callbackUrl)} className="font-medium text-white underline-offset-4 outline-none hover:underline focus-visible:underline">
          {t('auth.signUpLink')}
        </Link>
      </p>
    </>
  )
}
