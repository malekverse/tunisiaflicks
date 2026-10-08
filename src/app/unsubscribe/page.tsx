// /unsubscribe?t=TOKEN: the page the digest's footer link opens. Server-rendered and usable without
// JavaScript: the buttons are plain forms posting the token (hidden field) to /api/unsubscribe,
// which answers with a 303 back here (&s=done|on|invalid|limited). Opening the page (a GET) never
// changes anything, so link scanners and previews can't unsubscribe anyone. No referrer leaves this
// page (next.config.js), and the address is shown masked.
import type { Metadata } from 'next'
import Link from 'next/link'
import { BellRing, Link2Off, MailCheck, MailMinus, MailX } from 'lucide-react'
import { getT } from '@/src/lib/i18n/server'
import { richT } from '@/src/lib/i18n/rich'
import AuthShell from '@/src/components/auth/AuthShell'
import AuthHeader from '@/src/components/auth/AuthHeader'
import { StateIcon } from '@/src/components/auth/fields'
import { Button } from '@/src/components/ui/button'
import { verifyUnsubscribeToken } from '@/src/lib/digest/token'
import { maskEmail, unsubscribeView } from '@/src/lib/digest/state'
import { cn } from '@/src/lib/utils'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Metadata {
  return {
    title: `${getT()('digest.unsub.meta')} | TunisiaFlicks`,
    robots: { index: false, follow: false },
    referrer: 'no-referrer',
  }
}

type State = 'confirm' | 'done' | 'off' | 'on' | 'invalid' | 'limited'

const ICONS = { confirm: MailMinus, done: MailCheck, off: MailX, on: BellRing, invalid: Link2Off, limited: Link2Off }

const linkClass = 'mx-auto rounded-md text-[14px] font-medium text-white/60 underline-offset-4 outline-none transition-colors hover:text-white hover:underline focus-visible:underline'

/** A button that posts the token to /api/unsubscribe (works without JavaScript). */
function TokenForm({ token, action, children, variant }: { token: string; action: 'off' | 'on'; children: React.ReactNode; variant?: 'secondary' }) {
  return (
    <form method="post" action="/api/unsubscribe">
      <input type="hidden" name="t" value={token} />
      <input type="hidden" name="do" value={action} />
      <Button type="submit" size="lg" variant={variant} className="w-full">{children}</Button>
    </form>
  )
}

export default async function UnsubscribePage({ searchParams }: { searchParams: { t?: string | string[]; s?: string | string[] } }) {
  const t = getT()
  const token = String(Array.isArray(searchParams.t) ? searchParams.t[0] : searchParams.t ?? '').slice(0, 200)
  const step = Array.isArray(searchParams.s) ? searchParams.s[0] : searchParams.s
  const profileId = verifyUnsubscribeToken(token)
  const view = profileId ? await unsubscribeView(profileId) : null

  let state: State
  if (!profileId || !view) state = step === 'limited' ? 'limited' : 'invalid'
  else if (!view.exists) state = 'off'
  else if (view.enabled) state = step === 'on' ? 'on' : 'confirm'
  else state = step === 'done' && view.canUndo ? 'done' : 'off'

  const profile = (view?.exists && view.profileName) || t('digest.unsub.thisProfile')
  const email = maskEmail(view?.exists ? view.email : null) ?? '•••'
  const vars = { profile, email }
  const Icon = ICONS[state]

  const copy: Record<State, { title: string; text: React.ReactNode }> = {
    confirm: { title: t('digest.unsub.confirmTitle'), text: richT(t, 'digest.unsub.confirmText', vars, { bold: ['profile'] }) },
    done: { title: t('digest.unsub.doneTitle'), text: richT(t, 'digest.unsub.doneText', vars, { bold: ['profile'] }) },
    off: { title: t('digest.unsub.offTitle'), text: richT(t, 'digest.unsub.offText', vars, { bold: ['profile'] }) },
    on: { title: t('digest.unsub.onTitle'), text: richT(t, 'digest.unsub.onText', vars, { bold: ['profile'] }) },
    invalid: { title: t('digest.unsub.invalidTitle'), text: t('digest.unsub.invalidText') },
    limited: { title: t('digest.unsub.invalidTitle'), text: t('digest.unsub.tooMany') },
  }
  const canUndo = !!(view?.exists && view.canUndo)

  return (
    <AuthShell>
      <div role={state === 'confirm' ? undefined : 'status'}>
        <StateIcon className={cn('mb-6', (state === 'done' || state === 'on') && 'bg-white/[0.1] text-white')}>
          <Icon className="h-7 w-7" strokeWidth={1.8} />
        </StateIcon>
        <AuthHeader title={copy[state].title} subtitle={copy[state].text} />

        <div className="flex flex-col gap-4">
          {state === 'confirm' && (
            <>
              <TokenForm token={token} action="off">{t('digest.unsub.confirm')}</TokenForm>
              <Link href="/" className={linkClass}>{t('digest.unsub.keep')}</Link>
            </>
          )}
          {(state === 'done' || (state === 'off' && canUndo)) && (
            <>
              <TokenForm token={token} action="on" variant="secondary">{t('digest.unsub.undo')}</TokenForm>
              <Link href="/profile#email" className={linkClass}>{t('digest.unsub.settings')}</Link>
            </>
          )}
          {((state === 'off' && !canUndo) || state === 'on' || state === 'invalid' || state === 'limited') && (
            <>
              <Button asChild size="lg" variant="secondary" className="w-full">
                <Link href="/profile#email">{t('digest.unsub.settings')}</Link>
              </Button>
              <Link href="/" className={linkClass}>{t('digest.unsub.home')}</Link>
            </>
          )}
        </div>
      </div>
    </AuthShell>
  )
}
