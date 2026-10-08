"use client"
// The framed card at the top of an invited page (?invite=TOKEN): who invites you, one sentence,
// Accept and Not now. The token stays in the address until the invitation is answered (or turns
// out to be unavailable), so signing in, picking a profile or creating a page on the way keeps it.
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import { CircleSlash, MailCheck, ShieldCheck } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import ResendVerificationButton from '@/src/components/ResendVerificationButton'
import ProfileSetupCard from '@/src/components/social/ProfileSetupCard'
import { UserAvatar } from '@/src/components/social/Avatar'
import { socialErrorText } from '@/src/components/social/use-social-self'
import { withCallback } from '@/src/components/auth/links'
import { Button } from '@/src/components/ui/button'
import { haptic, spring, tween } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import type { AvatarPerson } from '@/src/lib/social/types'

type Step = 'ask' | 'accepting' | 'needs_handle' | 'unverified' | 'kids' | 'error' | 'done'

/** Takes ?invite= out of the address without a navigation. */
function stripInvite() {
  try {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('invite')) return
    url.searchParams.delete('invite')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
  } catch {
    // Old browsers: the token simply stays in the address.
  }
}

export default function InviteBanner({ token, inviter, sentence, acceptLabel, accept, signedIn, unavailable, consent, onAcceptedHref }: {
  token: string
  inviter: AvatarPerson | null
  sentence: string
  acceptLabel: string
  accept: { endpoint: string; method?: 'POST' | 'PUT'; body?: Record<string, unknown> }
  signedIn: boolean
  unavailable?: string | null
  consent?: string
  onAcceptedHref?: string
}): JSX.Element {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  // Kept in state: the address loses it once the invitation is answered.
  const [heldToken] = useState(token)
  const [step, setStep] = useState<Step>('ask')
  const [message, setMessage] = useState<string | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (unavailable) stripInvite()
  }, [unavailable])

  const send = useCallback(async () => {
    setStep('accepting')
    setMessage(null)
    try {
      const response = await fetch(accept.endpoint, {
        method: accept.method ?? 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(accept.body ?? {}), token: heldToken }),
      })
      const body = await response.json().catch(() => ({}))
      if (response.ok) {
        haptic(12)
        stripInvite()
        setStep('done')
        if (onAcceptedHref) router.push(onAcceptedHref)
        else router.refresh()
        return
      }
      if (response.status === 409 && body.code === 'needs_handle') return setStep('needs_handle')
      if (body.code === 'unverified') return setStep('unverified')
      if (body.code === 'kids') return setStep('kids')
      if (response.status === 410 || response.status === 404) stripInvite()
      setMessage(body.code ? socialErrorText(t, body) : t('social.invite.failed'))
      setStep('error')
    } catch {
      setMessage(t('social.invite.failed'))
      setStep('error')
    }
  }, [accept.endpoint, accept.method, accept.body, heldToken, onAcceptedHref, router, t])

  const dismiss = () => {
    stripInvite()
    setHidden(true)
  }

  const here = `${pathname}?invite=${encodeURIComponent(heldToken)}`

  return (
    <AnimatePresence initial={false}>
      {!hidden && step !== 'done' && (
        <m.section
          aria-label={t('social.invite.label')}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0, transition: spring.ui }}
          exit={{ opacity: 0, y: -8, transition: tween.fast }}
          className="page-x"
        >
          <div className="relative overflow-hidden rounded-[22px] bg-white/[0.05] p-5 ring-1 ring-white/[0.09] sm:p-6">
            {/* The room light, gathered behind the person inviting you. */}
            <div aria-hidden className="pointer-events-none absolute -start-16 -top-20 h-56 w-56 rounded-full opacity-40 blur-3xl" style={{ background: inviter?.color ?? 'rgb(255 255 255 / 0.25)' }} />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-4">
                {inviter
                  ? <UserAvatar person={inviter} size={56} className="ring-2 ring-white/10" />
                  : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/[0.08]"><CircleSlash aria-hidden className="h-6 w-6 text-white/60" /></span>}
                <div className="min-w-0">
                  <p className="text-balance font-display text-[clamp(20px,2.2vw,26px)] font-bold leading-tight">{sentence}</p>
                  {unavailable
                    ? <p className="mt-1 text-[14px] text-white/65">{unavailable}</p>
                    : consent && step !== 'needs_handle' && <p className="mt-1 max-w-[60ch] text-[13.5px] leading-relaxed text-white/60">{consent}</p>}
                </div>
              </div>

              {!unavailable && step !== 'needs_handle' && (
                <div className="flex shrink-0 gap-2.5">
                  {signedIn ? (
                    <Button size="lg" onClick={send} disabled={step === 'accepting' || step === 'unverified' || step === 'kids'} className="flex-1 sm:flex-none">
                      {acceptLabel}
                    </Button>
                  ) : (
                    <Button asChild size="lg" className="flex-1 sm:flex-none">
                      <Link href={withCallback('/login', here)}>{t('social.invite.signIn')}</Link>
                    </Button>
                  )}
                  <Button size="lg" variant="ghost" onClick={dismiss}>{t('social.invite.notNow')}</Button>
                </div>
              )}
              {unavailable && (
                <Button size="lg" variant="ghost" onClick={dismiss} className="self-start sm:self-center">{t('common.close')}</Button>
              )}
            </div>

            {step === 'needs_handle' && (
              <div className="relative mt-5">
                <p className="mb-3 text-[14px] text-white/70">{t('social.invite.setupFirst')}</p>
                <ProfileSetupCard variant="inline" onCreated={() => { send() }} />
              </div>
            )}
            {step === 'unverified' && (
              <p className="relative mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-white/70">
                <MailCheck aria-hidden className="h-4 w-4 shrink-0" />
                {t('social.invite.verify')}
                <ResendVerificationButton compact />
              </p>
            )}
            {step === 'kids' && (
              <p className="relative mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-white/70">
                <ShieldCheck aria-hidden className="h-4 w-4 shrink-0" />
                {t('social.invite.kids')}
                <Link href={`/profiles?next=${encodeURIComponent(here)}`} className="font-semibold text-white underline-offset-4 hover:underline">{t('social.invite.switchProfile')}</Link>
              </p>
            )}
            {step === 'error' && message && (
              <p role="alert" className={cn('relative mt-4 text-[14px] text-red-400')}>{message}</p>
            )}
          </div>
        </m.section>
      )}
    </AnimatePresence>
  )
}
