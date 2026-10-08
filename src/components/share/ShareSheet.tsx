"use client"
// The ShareSheet: send a title (or an invitation) to friends, plan a night, add to a list, or
// share it anywhere else. A Dialog from md up, a bottom sheet on phones. Guests get the outside
// links and a way to sign in; Kids only the outside links.
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'
import { Check, MailCheck, QrCode as QrIcon, Send } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import ShareButtons from '@/src/components/ShareButtons'
import TmdbImage from '@/src/components/TmdbImage'
import ResendVerificationButton from '@/src/components/ResendVerificationButton'
import PlanNightRow from '@/src/components/movie-night/PlanNightRow'
import AddToListSection from '@/src/components/lists/AddToListSection'
import FriendPicker from '@/src/components/social/FriendPicker'
import ProfileSetupCard from '@/src/components/social/ProfileSetupCard'
import { socialErrorText, useSocialSelf } from '@/src/components/social/use-social-self'
import { withCallback } from '@/src/components/auth/links'
import { Button } from '@/src/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/src/components/ui/dialog'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/src/components/ui/drawer'
import { toast } from '@/src/hooks/use-toast'
import { haptic, spring } from '@/src/lib/motion'
import { NOTE_MAX } from '@/src/lib/social/rules'
import { cn } from '@/src/lib/utils'
import type { ShareRequest } from '@/src/store/share-sheet'

export { ShareActionRow } from './ShareActionRow'

const QrCode = dynamic(() => import('./QrCode'), { ssr: false })

const NOTE_COUNTER_FROM = 120

/** md and up: a dialog. Read once on open (the sheet only exists in the browser). */
function useWide() {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches)
  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)')
    const onChange = () => setWide(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return wide
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2.5 text-[13px] font-medium text-white/70">{children}</p>
}

/** The Send button: its label morphs to "Sent" (with a check) when it worked. */
function SendButton({ count, state, onClick }: { count: number; state: 'idle' | 'sending' | 'sent'; onClick: () => void }) {
  const t = useT()
  // Less motion: a plain cross-fade, no blur and no lift.
  const still = useReducedMotion()
  const label = state === 'sent' ? t('social.share.sent') : state === 'sending' ? t('social.share.sending') : count > 1 ? t('social.share.sendTo', { count }) : t('social.share.send')
  return (
    <Button type="button" onClick={onClick} disabled={count === 0 || state === 'sending'} aria-live="polite" className="h-11 min-w-[7.5rem] shrink-0 overflow-hidden px-5">
      <AnimatePresence mode="popLayout" initial={false}>
        <m.span
          key={state === 'sent' ? 'sent' : 'send'}
          initial={still ? { opacity: 0 } : { opacity: 0, y: 8, filter: 'blur(4px)' }}
          animate={still ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={still ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, y: -8, filter: 'blur(4px)', transition: { duration: 0.12 } }}
          transition={spring.snappy}
          className="inline-flex items-center gap-2"
        >
          {state === 'sent' ? <Check aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.6} /> : <Send aria-hidden className="h-4 w-4 rtl:-scale-x-100" />}
          {label}
        </m.span>
      </AnimatePresence>
    </Button>
  )
}

/** Friends, an optional note, and Send. */
function PeopleRow({ request }: { request: ShareRequest }) {
  const t = useT()
  const [to, setTo] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [skipped, setSkipped] = useState<string[]>([])
  const reset = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => () => clearTimeout(reset.current), [])
  const withNote = request.kind === 'title'

  const send = async () => {
    if (to.length === 0 || state === 'sending') return
    setState('sending')
    setSkipped([])
    try {
      const response = request.kind === 'title'
        ? await fetch('/api/social/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to, media: { media_type: request.media.media_type, id: request.media.id }, ...(note.trim() ? { note: note.trim() } : {}) }),
        })
        : await fetch(request.sendTo!.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...(request.sendTo!.body ?? {}), to }),
        })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw body
      const missed: string[] = Array.isArray(body.skipped) ? body.skipped : []
      if (Array.isArray(body.sent) && body.sent.length === 0 && missed.length > 0) throw body
      haptic(12)
      setSkipped(missed)
      setState('sent')
      setTo([])
      setNote('')
      clearTimeout(reset.current)
      reset.current = setTimeout(() => setState('idle'), 2400)
    } catch (error) {
      setState('idle')
      toast({ variant: 'destructive', title: error && typeof error === 'object' && 'code' in error ? socialErrorText(t, error as { code?: string }) : t('social.share.failed') })
    }
  }

  return (
    <section aria-label={t('social.share.people')}>
      <SectionLabel>{t('social.share.people')}</SectionLabel>
      <FriendPicker selected={to} onChange={(handles) => { setTo(handles); if (state === 'sent') setState('idle') }} />
      <div className="mt-3 flex items-end gap-2.5">
        {withNote ? (
          <div className="relative min-w-0 flex-1">
            <label className="sr-only" htmlFor="share-note">{t('social.share.note')}</label>
            <textarea
              id="share-note"
              value={note}
              onChange={(event) => setNote(event.target.value.slice(0, NOTE_MAX))}
              maxLength={NOTE_MAX}
              rows={1}
              dir="auto"
              placeholder={t('social.share.notePlaceholder')}
              className="block max-h-28 min-h-[44px] w-full resize-none rounded-[22px] border border-white/10 bg-white/[0.05] px-4 py-[10px] text-[16px] leading-snug text-white outline-none transition-[border-color,background-color] duration-200 [field-sizing:content] placeholder:text-white/45 hover:border-white/20 focus-visible:border-red-500/70 focus-visible:bg-white/[0.07]"
            />
            {note.length >= NOTE_COUNTER_FROM && (
              <span aria-live="polite" className="pointer-events-none absolute -top-5 end-2 text-[12px] tabular-nums text-white/60">
                {t('social.share.noteLeft', { count: NOTE_MAX - note.length })}
              </span>
            )}
          </div>
        ) : <div className="flex-1" />}
        <SendButton count={to.length} state={state} onClick={send} />
      </div>
      {skipped.length > 0 && (
        <p className="mt-2 text-[13px] text-white/60">{t('social.share.someSkipped', { names: skipped.map((handle) => `@${handle}`).join(', ') })}</p>
      )}
    </section>
  )
}

/** What the people row becomes for this viewer: the picker, a setup card, a verify line, a sign-in line, or nothing. */
function People({ request }: { request: ShareRequest }) {
  const t = useT()
  const pathname = usePathname()
  const { status, self, reload } = useSocialSelf()
  if (status === 'loading') return <div aria-busy className="h-[132px] animate-pulse rounded-2xl bg-white/[0.03]" />
  if (status === 'guest') {
    const back = typeof window !== 'undefined' ? window.location.pathname + window.location.search : pathname
    return (
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-white/[0.04] px-4 py-3 text-[14px] text-white/70 ring-1 ring-inset ring-white/[0.06]">
        {t('social.share.signIn')}
        <Link href={withCallback('/login', back)} className="font-semibold text-white underline-offset-4 hover:underline">{t('social.share.signInAction')}</Link>
      </p>
    )
  }
  if (status !== 'ready' || !self) return null
  if (!self.verified) {
    return (
      <div className="flex items-start gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-inset ring-white/[0.06]">
        <MailCheck aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-white/70" />
        <p className="text-[14px] leading-relaxed text-white/70">
          {t('social.share.verify')}{' '}
          <ResendVerificationButton compact />
        </p>
      </div>
    )
  }
  if (!self.handle) return <ProfileSetupCard variant="inline" onCreated={() => reload()} />
  return <PeopleRow request={request} />
}

export default function ShareSheet({ request, open, onClose }: { request: ShareRequest; open: boolean; onClose: () => void }) {
  const t = useT()
  const wide = useWide()
  // Planning a night and adding to a list are for signed-in grown-ups (guests and Kids get the outside links).
  const { status } = useSocialSelf()
  const pathname = usePathname()
  const [showQr, setShowQr] = useState(false)
  const opened = useRef(pathname)
  const content = useRef<HTMLDivElement>(null)

  // Leaving the page (a row's link, a sign-in) puts the sheet away.
  useEffect(() => {
    if (pathname !== opened.current) onClose()
  }, [pathname, onClose])

  const isTitle = request.kind === 'title'
  const heading = isTitle ? t('social.share.title') : t('social.share.invite')
  const title = isTitle ? request.media.title : request.title
  const url = isTitle ? `/${request.media.media_type}/${request.media.id}` : request.url
  const peopleRow = isTitle || !!request.sendTo

  const body = (
    <div className="space-y-6">
      <div className="flex items-center gap-3.5 pe-10">
        {isTitle && (
          <span className="relative block aspect-[2/3] w-12 shrink-0 overflow-hidden rounded-[8px] bg-white/5 ring-1 ring-white/10">
            <TmdbImage kind="poster" path={request.media.poster_path} alt="" fill sizes="48px" className="object-cover" />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-[13px] text-white/55">{heading}</p>
          <p className="line-clamp-2 font-display text-[22px] font-bold leading-tight"><bdi>{title}</bdi></p>
        </div>
      </div>

      {peopleRow && <People request={request} />}

      {isTitle && status === 'ready' && (
        <div className="-mx-3 space-y-0.5 empty:hidden">
          <PlanNightRow media={request.media} onDone={onClose} />
          <AddToListSection media={request.media} onDone={onClose} />
        </div>
      )}

      <section aria-label={t('social.share.elsewhere')}>
        <SectionLabel>{t('social.share.elsewhere')}</SectionLabel>
        <ShareButtons url={url} title={title} text={isTitle ? title : request.text} />
        {!isTitle && (
          <div className="mt-4">
            <button
              type="button"
              aria-expanded={showQr}
              onClick={() => setShowQr((value) => !value)}
              className="pressable inline-flex h-11 items-center gap-2 rounded-full bg-white/[0.07] px-4 text-[14px] font-medium text-white/90 outline-none ring-1 ring-inset ring-white/[0.06] transition-colors hover:bg-white/[0.12] focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <QrIcon aria-hidden className="h-[18px] w-[18px]" />
              {showQr ? t('social.share.hideQr') : t('social.share.showQr')}
            </button>
            {showQr && <div className="mt-5"><QrCode url={url} /></div>}
          </div>
        )}
      </section>
    </div>
  )

  if (wide) {
    return (
      <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
        <DialogContent
          ref={content}
          // Focus the sheet itself: the people row is still loading when it opens, so the first
          // control would be the outside Share button, which then looks chosen. Tab goes on from here.
          onOpenAutoFocus={(event) => { event.preventDefault(); content.current?.focus() }}
          className="max-h-[calc(100dvh-48px)] max-w-[520px] overflow-y-auto overscroll-contain p-6 outline-none"
        >
          <DialogTitle className="sr-only">{heading}</DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
          {body}
        </DialogContent>
      </Dialog>
    )
  }
  return (
    <Drawer open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DrawerContent>
        <DrawerTitle className="sr-only">{heading}</DrawerTitle>
        <DrawerDescription className="sr-only">{title}</DrawerDescription>
        <div className={cn('no-scrollbar overflow-y-auto overscroll-contain px-5 pb-6 pt-4')}>{body}</div>
      </DrawerContent>
    </Drawer>
  )
}
