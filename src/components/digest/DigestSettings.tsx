"use client"
// The "By email" group of Settings #notifications (a SettingsGroup id='email'): the weekly digest
// for this profile, the language it's written in, when the next one comes, and a preview. Mounted
// as PushSettingsCard's children in src/app/profile/page.tsx (grown-up profiles only).
import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { CalendarClock, Eye, Info, Mail, MoonStar, RotateCw } from 'lucide-react'
import { SettingsGroup } from '@/src/components/profile/SettingsSection'
import { SwitchRow } from '@/src/components/ui/switch'
import { Skeleton } from '@/src/components/ui/skeleton'
import { Button } from '@/src/components/ui/button'
import ResendVerificationButton from '@/src/components/ResendVerificationButton'
import { useI18n } from '@/src/components/I18nProvider'
import { toast } from '@/src/hooks/use-toast'
import { saveErrorMessage, useDigest, useDigestStore } from '@/src/hooks/use-digest'
import { richT } from '@/src/lib/i18n/rich'
import { LOCALES, LOCALE_META, type Locale } from '@/src/lib/i18n/locales'
import { EASE_OUT } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import SegmentedRadio from './SegmentedRadio'
import DigestPreviewSheet from './DigestPreviewSheet'

// The anchor clears the fixed top bar and leaves the group's heading in view.
const ANCHOR = 'scroll-mt-[calc(var(--topbar)+env(safe-area-inset-top,0px)+84px)]'

/** 'Friday 9 October' and '17:00' in the reader's language and time zone. */
function when(iso: string, dateLocale: string | undefined) {
  const at = new Date(iso)
  return {
    date: at.toLocaleDateString(dateLocale, { weekday: 'long', day: 'numeric', month: 'long' }),
    // 'numeric' hours: '17:00' in English and French, '5:00 م' (not '05:00 م') in Arabic.
    time: at.toLocaleTimeString(dateLocale, { hour: 'numeric', minute: '2-digit' }),
  }
}

/** A quiet row inside the group: an icon and a line or two. */
function NoteRow({ icon, tone = 'plain', children }: { icon: React.ReactNode; tone?: 'plain' | 'warn'; children: React.ReactNode }) {
  return (
    <div className={cn('flex items-start gap-3 py-3.5 text-[13.5px] leading-relaxed', tone === 'warn' ? 'text-amber-100/85' : 'text-white/70')}>
      <span aria-hidden className={cn('mt-0.5 shrink-0 [&_svg]:h-[17px] [&_svg]:w-[17px]', tone === 'warn' ? 'text-amber-300' : 'text-white/50')}>{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export default function DigestSettings(): JSX.Element | null {
  const { t, dateLocale } = useI18n()
  const { status, state, saving, save, reload } = useDigest()
  const [previewOpen, setPreviewOpen] = useState(false)
  const scrolled = useRef(false)

  // Arriving at /profile#email: the group appears after its data, so bring it into view then.
  useEffect(() => {
    if (status !== 'ready' || scrolled.current || window.location.hash !== '#email') return
    scrolled.current = true
    requestAnimationFrame(() => document.getElementById('email')?.scrollIntoView({ block: 'start' }))
  }, [status])

  const heading = (
    <>
      <p className="mb-1 flex items-center gap-2 text-[13px] font-medium text-white/60">
        <Mail aria-hidden className="h-4 w-4" strokeWidth={1.9} />{t('digest.settings.heading')}
      </p>
      <p className="mb-3 min-h-[20px] text-[13px] leading-relaxed text-white/50">
        {state?.email ? richT(t, 'digest.settings.hint', { email: state.email }) : null}
      </p>
    </>
  )

  if (status === 'signedOut') return null

  if (status === 'idle' || status === 'loading' || !state) {
    if (status === 'error') {
      return (
        <div>
          {heading}
          <SettingsGroup id="email" className={ANCHOR}>
            <NoteRow icon={<Info />}>
              <p>{t('digest.loadFailed')}</p>
              <Button variant="secondary" className="mt-3" onClick={() => void reload()}>
                <RotateCw aria-hidden className="h-4 w-4" />{t('digest.retry')}
              </Button>
            </NoteRow>
          </SettingsGroup>
        </div>
      )
    }
    return (
      <div>
        {heading}
        <SettingsGroup id="email" aria-busy className={ANCHOR}>
          {[0, 1].map((row) => (
            <div key={row} className="flex items-center justify-between gap-5 py-4">
              <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3 rounded-full" /><Skeleton className="h-3 w-2/3 rounded-full" /></div>
              {row === 0 && <Skeleton className="h-[30px] w-[50px] rounded-full" />}
            </div>
          ))}
          <span className="sr-only">{t('common.loading')}</span>
        </SettingsGroup>
      </div>
    )
  }

  const unverified = !state.emailVerified
  // Paused after two bounces: nothing goes out, so the switch reads off; turning it on resumes it.
  const paused = state.enabled && state.pausedReason === 'bounced'
  const canChange = state.available && !state.locked
  const on = state.enabled && !paused
  // Turning it on needs the digest available and a confirmed address; turning it off never does
  // (only a TV or limited session can't change it at all).
  const switchDisabled = state.locked || !!saving.enabled || (!on && (!state.available || unverified))

  const setEnabled = async (enabled: boolean) => {
    const result = await save({ enabled })
    const error = saveErrorMessage(t, result)
    if (error) {
      toast({ title: error, variant: 'destructive', duration: 4500 })
      return false
    }
    const fresh = useDigestStore.getState().state?.next
    const description = !fresh ? undefined : fresh.sending ? t('digest.next.sending') : t('digest.turnedOnDesc', { date: when(fresh.at, dateLocale).date })
    toast(enabled
      ? { title: t('digest.turnedOn'), description, duration: 3500 }
      : { title: t('digest.turnedOff'), duration: 3000 })
    return true
  }

  const setLocale = async (locale: Locale) => {
    const error = saveErrorMessage(t, await save({ locale }))
    if (error) toast({ title: error, variant: 'destructive', duration: 4500 })
  }

  const next = state.next ? when(state.next.at, dateLocale) : null

  return (
    <div>
      {heading}
      <SettingsGroup id="email" className={ANCHOR}>
        <SwitchRow
          id="digest-weekly"
          checked={on}
          disabled={switchDisabled}
          onCheckedChange={(value) => void setEnabled(value)}
          label={t('digest.weekly.label')}
          hint={t('digest.weekly.hint')}
        />

        {!state.available && (
          <NoteRow icon={<Info />}>{t('digest.unavailable')}</NoteRow>
        )}

        {state.available && state.locked && (
          <NoteRow icon={<Info />}>{t('digest.locked')}</NoteRow>
        )}

        {state.available && !state.locked && unverified && (
          <NoteRow icon={<Info />} tone="warn">
            <p>{t('digest.unverified')}</p>
            <p className="mt-1.5 text-amber-50/90"><ResendVerificationButton compact /></p>
          </NoteRow>
        )}

        {paused && state.email && (
          <NoteRow icon={<Info />} tone="warn">
            <p>{richT(t, 'digest.paused', { email: state.email })}</p>
          </NoteRow>
        )}

        {/* Only while it's on: its language, and when the next one comes. */}
        <AnimatePresence initial={false}>
          {on && (
            <m.div
              key="details"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0, transition: { duration: 0.18, ease: EASE_OUT } }}
              transition={{ duration: 0.26, ease: EASE_OUT }}
              className="divide-y divide-white/[0.07] overflow-hidden border-t border-white/[0.07]"
            >
              <div className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
                <p id="digest-language-label" className="text-[15px] font-medium text-white">{t('digest.language.label')}</p>
                <SegmentedRadio
                  label={t('digest.language.label')}
                  value={state.locale}
                  onChange={(value) => void setLocale(value)}
                  disabled={!canChange}
                  stretch="phone"
                  options={LOCALES.map((locale) => ({
                    value: locale,
                    label: LOCALE_META[locale].short,
                    ariaLabel: LOCALE_META[locale].endonym,
                    lang: LOCALE_META[locale].htmlLang,
                  }))}
                />
              </div>
              {next && (
                <NoteRow icon={<CalendarClock />}>
                  <p>{state.next?.sending ? t('digest.next.sending') : richT(t, 'digest.next', { date: next.date, time: next.time })}</p>
                  {state.next?.ramadan && (
                    <p className="mt-1 flex items-center gap-1.5 text-white/55">
                      <MoonStar aria-hidden className="h-3.5 w-3.5" />{t('digest.ramadan', { time: next.time })}
                    </p>
                  )}
                </NoteRow>
              )}
            </m.div>
          )}
        </AnimatePresence>

        {/* The whole row opens the preview (a list row, like the switches above it). The wrapper
            carries the group's inset divider; the button spans the full width for its press state. */}
        {state.available && !state.locked && (
          <div>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              aria-haspopup="dialog"
              className="-mx-4 flex w-[calc(100%+2rem)] select-none items-center gap-4 rounded-b-2xl px-4 py-3.5 text-start outline-none transition-colors duration-150 [-webkit-tap-highlight-color:transparent] [touch-action:manipulation] hover:bg-white/[0.03] focus-visible:bg-white/[0.04] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500 active:bg-white/[0.05] sm:-mx-5 sm:w-[calc(100%+2.5rem)] sm:px-5"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium text-white">{t('digest.preview.open')}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-white/55">{t('digest.preview.description')}</span>
              </span>
              <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/[0.06] text-white/70 ring-1 ring-inset ring-white/[0.06]">
                <Eye className="h-[17px] w-[17px]" strokeWidth={1.9} />
              </span>
            </button>
          </div>
        )}
      </SettingsGroup>

      {state.available && !state.locked && (
        <DigestPreviewSheet
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          locale={state.locale}
          email={state.email}
          enabled={on}
          onTurnOn={() => setEnabled(true)}
        />
      )}
    </div>
  )
}
