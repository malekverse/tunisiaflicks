"use client"
// "Add a friend" (/friends/list#add): an exact handle, then the person and [Add friend], or
// "Nobody has this handle". There is no search and no suggestion list: a handle or a link.
// Below it, the invite link card.
import { useId, useRef, useState } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { AtSign, Check, Clock3, SearchX } from 'lucide-react'
import { useI18n } from '@/src/components/I18nProvider'
import { Button } from '@/src/components/ui/button'
import { toast } from '@/src/hooks/use-toast'
import { haptic, tween } from '@/src/lib/motion'
import { normalizeHandle } from '@/src/lib/social/rules'
import { lookupHandle, type LookupResult } from '@/src/app/friends/list/actions'
import PersonRow from './PersonRow'
import ShareLinkRow from './ShareLinkRow'
import { socialErrorText } from './use-social-self'

type Found = Extract<LookupResult, { status: 'found' }>

export default function AddFriendCard({ handle: myHandle, name: myName, onChange }: {
  handle: string
  name: string
  /** Something changed in your friends or requests (reload the lists). */
  onChange?: () => void
}) {
  const { t } = useI18n()
  const id = useId()
  const still = useReducedMotion()
  const input = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [result, setResult] = useState<Found | { status: 'not_found'; handle: string } | null>(null)
  const [looking, setLooking] = useState(false)
  const [sending, setSending] = useState(false)

  const find = async (event: React.FormEvent) => {
    event.preventDefault()
    const handle = normalizeHandle(value) ?? ''
    if (!handle || looking) return
    setLooking(true)
    try {
      const answer = await lookupHandle(handle)
      if (answer.status === 'error') {
        toast({ variant: 'destructive', title: answer.code === 'rate_limited' ? t('api.tooManyAttempts') : socialErrorText(t, { code: answer.code }) })
        return
      }
      setResult(answer.status === 'found' ? answer : { status: 'not_found', handle })
    } catch {
      toast({ variant: 'destructive', title: t('social.add.failed') })
    } finally {
      setLooking(false)
    }
  }

  const ask = async (found: Found) => {
    if (sending) return
    setSending(true)
    try {
      const response = await fetch('/api/social/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: found.person.handle }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (body.code === 'requests_off') setResult({ ...found, requestsOff: true })
        toast({ variant: 'destructive', title: socialErrorText(t, body) })
        return
      }
      haptic(10)
      if (body.status === 'friends') {
        toast({ title: t('social.list.acceptedToast', { name: found.person.name }) })
        setResult({ ...found, relationship: 'friends' })
      } else {
        setResult({ ...found, relationship: 'outgoing' })
      }
      onChange?.()
    } catch {
      toast({ variant: 'destructive', title: t('social.share.failed') })
    } finally {
      setSending(false)
    }
  }

  const action = (found: Found) => {
    switch (found.relationship) {
      case 'self':
        return <span className="text-[13.5px] text-white/55">{t('social.errors.self')}</span>
      case 'friends':
        return <span className="inline-flex items-center gap-1.5 text-[13.5px] text-white/70"><Check aria-hidden className="h-4 w-4" />{t('social.add.friends')}</span>
      case 'outgoing':
        return <span className="inline-flex items-center gap-1.5 text-[13.5px] text-white/70"><Clock3 aria-hidden className="h-4 w-4" />{t('social.add.sent')}</span>
      case 'incoming':
        // They asked first: asking back says yes.
        return <Button className="h-11 px-5" onClick={() => void ask(found)} disabled={sending}>{t('social.inbox.accept')}</Button>
      default:
        return found.requestsOff
          ? <span className="max-w-[16ch] text-end text-[13px] leading-snug text-white/55">{t('social.errors.requests_off')}</span>
          : <Button className="h-11 px-5" onClick={() => void ask(found)} disabled={sending}>{t('social.add.addFriend')}</Button>
    }
  }

  return (
    <div className="space-y-4">
      <section id="add" aria-labelledby={`${id}-title`} className="scroll-mt-[calc(var(--topbar)+env(safe-area-inset-top,0px)+20px)] rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-white/[0.07] sm:p-6">
        <h2 id={`${id}-title`} className="font-display text-[21px] font-bold leading-tight text-white sm:text-[24px]">{t('social.picker.addFriend')}</h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-white/60">{t('social.add.text')}</p>

        <form onSubmit={find} className="mt-5 flex gap-2.5" role="search">
          <label htmlFor={`${id}-handle`} className="sr-only">{t('social.setup.handle')}</label>
          <div className="relative min-w-0 flex-1" dir="ltr">
            <AtSign aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/45" />
            <input
              ref={input}
              id={`${id}-handle`}
              value={value}
              onChange={(event) => { setValue(event.target.value.toLowerCase().replace(/\s+/g, '')); if (result) setResult(null) }}
              dir="ltr"
              maxLength={21}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              placeholder="handle"
              className="h-11 w-full rounded-xl border border-white/10 bg-white/[0.05] pl-10 pr-3 text-[16px] text-white outline-none transition-[border-color,background-color,box-shadow] duration-200 placeholder:text-white/40 hover:border-white/20 focus-visible:border-red-500/70 focus-visible:bg-white/[0.07] focus-visible:ring-4 focus-visible:ring-red-500/15"
            />
          </div>
          <Button type="submit" variant="secondary" className="h-11 shrink-0 px-5" disabled={looking || !normalizeHandle(value)}>
            {looking ? t('common.loading') : t('social.add.find')}
          </Button>
        </form>

        <div aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            {result && (
              <m.div
                key={result.status === 'found' ? result.person.handle : `none-${result.handle}`}
                initial={still ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: tween.fast }}
                transition={tween.base}
                className="mt-4 overflow-hidden rounded-2xl bg-white/[0.04] ring-1 ring-inset ring-white/[0.06]"
              >
                {result.status === 'found' ? (
                  <PersonRow person={result.person}>{action(result)}</PersonRow>
                ) : (
                  <p className="flex items-center gap-3 px-4 py-4 text-[14px] text-white/70">
                    <SearchX aria-hidden className="h-[18px] w-[18px] shrink-0 text-white/50" />
                    <span>{t('social.add.notFound')} <bdi dir="ltr" className="text-white/55">@{result.handle}</bdi></span>
                  </p>
                )}
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      <ShareLinkRow handle={myHandle} name={myName} />
    </div>
  )
}
