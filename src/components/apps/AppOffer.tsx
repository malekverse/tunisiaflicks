"use client"
// "There's an app for this": one card, for the device in hand.
// - Android phone: the APK (a link on the site, /download/android), then what to do with the file;
//   or one-tap install from Chrome when there's no release yet.
// - Android TV, in TV mode: the address to type in the Downloader app.
// - iPhone / iPad: Add to Home Screen, step by step.
// - Windows: the desktop app, with its own ad-free player (its page, /desktop), once it has a release.
// - Windows, Mac, Linux, ChromeOS: install from the browser in one click (Safari: File > Add to Dock).
//
// Never pushy: only from a second visit or a third page, a few seconds after the page settles,
// never on /app, sign-in or download pages, never inside an app, and not while the e-mail reminder
// shows. "Not now" quiets it for 3 weeks (6 months after three times); a download or an install for
// 4 months. The TV-mode offer (TvModeOffer) covers TV browsers outside TV mode, so the two never meet.
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Download, PlusSquare, Share, X } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import { Button } from '@/src/components/ui/button'
import { useAccount } from '@/src/hooks/use-account'
import { useInstallPrompt } from '@/src/hooks/use-install-prompt'
import { useTvMode } from '@/src/hooks/use-tv-mode'
import { isMacSafari, type DevicePlatform } from '@/src/lib/device-platform'
import type { TKey } from '@/src/lib/i18n'
import { useDevice } from './use-device'

/** Sizes in MB of the apps there's a release of (null: none yet). From the root layout. */
export type OfferedApps = { android: number | null, tv: number | null, desktop: number | null }

type Variant = 'android' | 'pwa' | 'tv' | 'ios' | 'desktop' | 'computer' | 'computer-safari'

const STATE_KEY = 'tf-app-offer'
const VISITS_KEY = 'tf-visits'
const SESSION_KEY = 'tf-visit-counted'
const VIEWS_KEY = 'tf-session-views'
// VerifyEmailBanner's own "dismissed for this session" key.
const VERIFY_DISMISSED_KEY = 'tf-verify-banner-dismissed'

const DAY = 24 * 60 * 60 * 1000
const SNOOZE = 21 * DAY
const SNOOZE_LONG = 180 * DAY
const AFTER_GETTING_IT = 120 * DAY
const SETTLE_MS = 6000
const QUIET_PATHS = ['/app', '/desktop', '/download', '/login', '/signup', '/auth', '/activate', '/profiles', '/unsubscribe']

type OfferState = { until: number, dismissals: number }

function readState(): OfferState {
  try {
    const value = JSON.parse(localStorage.getItem(STATE_KEY) ?? '{}')
    return { until: Number(value.until) || 0, dismissals: Number(value.dismissals) || 0 }
  } catch {
    return { until: Number.MAX_SAFE_INTEGER, dismissals: 0 }
  }
}

function writeState(state: OfferState) {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)) } catch { /* private mode */ }
}

/** Counts this visit once per browser session, and this page view; true once the visitor is engaged. */
function engaged(): boolean {
  try {
    let visits = Number(localStorage.getItem(VISITS_KEY)) || 0
    if (sessionStorage.getItem(SESSION_KEY) !== '1') {
      sessionStorage.setItem(SESSION_KEY, '1')
      localStorage.setItem(VISITS_KEY, String(++visits))
    }
    const views = (Number(sessionStorage.getItem(VIEWS_KEY)) || 0) + 1
    sessionStorage.setItem(VIEWS_KEY, String(views))
    return visits >= 2 || views >= 3
  } catch {
    return false
  }
}

function variantFor(platform: DevicePlatform, apps: OfferedApps, canInstall: boolean, tv: boolean, userAgent: string): Variant | null {
  switch (platform) {
    case 'android-tv': return tv && apps.tv !== null ? 'tv' : null
    case 'android': return apps.android !== null ? 'android' : canInstall ? 'pwa' : null
    case 'ios': return 'ios'
    case 'windows': case 'mac': case 'linux': case 'chromeos':
      if (platform === 'windows' && apps.desktop !== null) return 'desktop'
      return canInstall ? 'computer' : platform === 'mac' && isMacSafari(userAgent) ? 'computer-safari' : null
    default: return null
  }
}

const COMPUTER_TITLE: Partial<Record<DevicePlatform, TKey>> = {
  windows: 'apps.offer.computer.windows',
  mac: 'apps.offer.computer.mac',
  linux: 'apps.offer.computer.linux',
  chromeos: 'apps.offer.computer.chromeos',
}

export default function AppOffer({ apps }: { apps: OfferedApps }): JSX.Element | null {
  const t = useT()
  const pathname = usePathname()
  const device = useDevice()
  const tv = useTvMode()
  const { account } = useAccount()
  const { canInstall, installed, install } = useInstallPrompt()
  const [ready, setReady] = useState(false)
  const [closed, setClosed] = useState(false)
  const [step, setStep] = useState<'offer' | 'downloaded' | 'how'>('offer')
  const [verifyShowing, setVerifyShowing] = useState(false)
  const primaryRef = useRef<HTMLElement | null>(null)

  const quietPath = QUIET_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))

  // Engagement and snooze, page after page; then a moment for the page to settle.
  useEffect(() => {
    if (quietPath || closed) return
    if (!engaged() || readState().until > Date.now()) return
    const timer = window.setTimeout(() => setReady(true), SETTLE_MS)
    return () => window.clearTimeout(timer)
  }, [pathname, quietPath, closed])

  // The e-mail reminder goes first.
  const verifyPending = !!account && !account.emailVerified && !!account.email
  useEffect(() => {
    if (!verifyPending) return setVerifyShowing(false)
    const check = () => {
      try { setVerifyShowing(sessionStorage.getItem(VERIFY_DISMISSED_KEY) !== '1') } catch { setVerifyShowing(false) }
    }
    check()
    const timer = window.setInterval(check, 2000)
    return () => window.clearInterval(timer)
  }, [verifyPending])

  const variant = device && !device.inApp && !installed ? variantFor(device.platform, apps, canInstall, tv, device.userAgent) : null
  const open = ready && !closed && !quietPath && !verifyShowing && variant !== null

  // A remote has no pointer: the focus goes to the card's answer.
  useEffect(() => {
    if (open && variant === 'tv') primaryRef.current?.focus({ preventScroll: true })
  }, [open, variant])

  if (!open || !device) return null

  const later = () => {
    const state = readState()
    const dismissals = state.dismissals + 1
    writeState({ dismissals, until: Date.now() + (dismissals >= 3 ? SNOOZE_LONG : SNOOZE) })
    setClosed(true)
  }
  const gotIt = () => writeState({ ...readState(), until: Date.now() + AFTER_GETTING_IT })
  const installNow = async () => {
    const outcome = await install()
    if (outcome === 'accepted') {
      gotIt()
      setClosed(true)
    }
  }

  const title: TKey =
    variant === 'android' ? 'apps.offer.android.title'
      : variant === 'pwa' ? 'apps.offer.pwa.title'
        : variant === 'tv' ? 'apps.offer.tv.title'
          : variant === 'ios' ? 'apps.offer.ios.title'
            : COMPUTER_TITLE[device.platform] ?? 'apps.offer.computer.windows'
  const text: TKey =
    variant === 'android' ? (step === 'downloaded' ? 'apps.offer.android.next' : 'apps.offer.android.text')
      : variant === 'pwa' ? 'apps.offer.pwa.text'
        : variant === 'tv' ? 'apps.offer.tv.text'
          : variant === 'ios' ? 'apps.offer.ios.text'
            : variant === 'desktop' ? 'desktop.offer.text'
              : variant === 'computer-safari' ? 'apps.offer.computer.safari'
              : 'apps.offer.computer.text'

  const host = typeof window === 'undefined' ? '' : window.location.host

  return (
    <div
      role="region"
      aria-labelledby="app-offer-title"
      data-tv-layer={variant === 'tv' ? '' : undefined}
      onKeyDown={(event) => { if (event.key === 'Escape') later() }}
      className={
        variant === 'tv'
          ? 'glass-strong fixed bottom-[var(--tv-safe-y)] end-[var(--tv-safe-x)] z-[65] flex w-[min(34rem,calc(100vw-2*var(--tv-safe-x)))] items-start gap-5 rounded-[22px] p-[1.4em] shadow-[0_24px_70px_-18px_rgb(0_0_0/0.95)] animate-in fade-in slide-in-from-bottom-4 duration-300 motion-reduce:slide-in-from-bottom-0'
          : 'glass-strong fixed inset-x-3 bottom-[calc(var(--tabbar-space)+8px)] z-30 mx-auto flex max-w-md items-start gap-3.5 rounded-[20px] p-4 shadow-[0_18px_50px_-12px_rgb(0_0_0/0.9)] animate-in fade-in slide-in-from-bottom-4 duration-500 motion-reduce:slide-in-from-bottom-0 lg:inset-x-auto lg:bottom-6 lg:end-6 lg:mx-0'
      }
    >
      {/* The app's own icon: what they'll find on their home screen. */}
      <span aria-hidden className={`grid shrink-0 place-items-center rounded-[14px] bg-black ring-1 ring-white/10 shadow-[0_6px_18px_-6px_rgb(255_16_0/0.55)] ${variant === 'tv' ? 'h-16 w-16' : 'h-12 w-12'}`}>
        <Image src="/A.svg" alt="" width={36} height={31} className={variant === 'tv' ? 'h-9 w-auto' : 'h-7 w-auto'} />
      </span>

      <div className="min-w-0 flex-1">
        <p id="app-offer-title" className={`font-semibold text-white ${variant === 'tv' ? 'text-[20px]' : 'text-[15px]'}`}>{t(title)}</p>
        <p className={`mt-0.5 leading-snug text-white/65 ${variant === 'tv' ? 'text-[16px]' : 'text-[13.5px]'}`}>{t(text)}</p>

        {variant === 'tv' && (
          <div className="mt-3">
            <p className="text-[14px] text-white/55">{t('apps.offer.tv.how')}</p>
            <p dir="ltr" className="mt-1 select-all rounded-xl bg-white/[0.07] px-3 py-2 font-mono text-[18px] font-semibold tracking-tight text-white">{host}/download/tv</p>
          </div>
        )}

        {variant === 'ios' && step === 'how' && (
          <ol className="mt-3 space-y-2">
            {(['apps.ios.step2', 'apps.ios.step3'] as const).map((key, index) => (
              <li key={key} className="flex items-center gap-2.5 text-[13.5px] text-white/75">
                <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[12px] font-semibold text-white">{index + 1}</span>
                <span className="inline-flex items-center gap-1.5">
                  {t(key)}
                  {index === 0 ? <Share aria-hidden className="h-4 w-4 text-white/70" /> : <PlusSquare aria-hidden className="h-4 w-4 text-white/70" />}
                </span>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          {variant === 'android' && step === 'offer' && (
            <>
              <Button asChild size="sm" className="h-10">
                <a
                  ref={(node) => { primaryRef.current = node }}
                  href="/download/android"
                  onClick={() => { gotIt(); setStep('downloaded') }}
                >
                  <Download aria-hidden className="h-4 w-4" />
                  {t('apps.offer.android.download')}
                </a>
              </Button>
              {apps.android !== null && <span className="text-[12.5px] text-white/50">{t('apps.offer.android.size', { size: apps.android.toLocaleString() })}</span>}
            </>
          )}
          {variant === 'android' && step === 'downloaded' && (
            <Button size="sm" variant="secondary" className="h-10" onClick={() => setClosed(true)}>{t('apps.offer.close')}</Button>
          )}
          {(variant === 'pwa' || variant === 'computer') && (
            <Button ref={(node) => { primaryRef.current = node }} size="sm" className="h-10" onClick={installNow}>
              <Download aria-hidden className="h-4 w-4" />
              {t('apps.offer.install')}
            </Button>
          )}
          {variant === 'desktop' && (
            <Button asChild size="sm" className="h-10">
              <Link ref={(node) => { primaryRef.current = node }} href="/desktop" onClick={() => { gotIt(); setClosed(true) }}>
                {t('desktop.offer.cta')}
              </Link>
            </Button>
          )}
          {variant === 'ios' && step !== 'how' && (
            <Button size="sm" className="h-10" onClick={() => { gotIt(); setStep('how') }}>{t('apps.offer.ios.how')}</Button>
          )}
          {variant === 'tv' && (
            <Button asChild size="lg">
              <a ref={(node) => { primaryRef.current = node }} href="/app#tv" onClick={gotIt}>{t('apps.offer.tv.steps')}</a>
            </Button>
          )}
          {step === 'offer' && (
            <Button variant="ghost" size={variant === 'tv' ? 'lg' : 'sm'} onClick={later} className={variant === 'tv' ? 'text-white/70' : 'h-10 text-white/70'}>
              {t('apps.offer.notNow')}
            </Button>
          )}
        </div>

        {variant === 'android' && step === 'offer' && canInstall && (
          <button type="button" onClick={installNow} className="mt-2 text-[12.5px] text-white/55 underline decoration-white/25 underline-offset-4 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-red-500">
            {t('apps.offer.android.instead')}
          </button>
        )}
      </div>

      {variant !== 'tv' && (
        <button
          type="button"
          onClick={later}
          aria-label={t('apps.offer.close')}
          className="-me-1.5 -mt-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/50 outline-none transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:ring-2 focus-visible:ring-red-500"
        >
          <X aria-hidden className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
