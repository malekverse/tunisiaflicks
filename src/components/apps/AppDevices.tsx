"use client"
// /app's cards, one per kind of device, the visitor's own first and marked "This device":
// Android phones (the APK), Android TV (the APK, typed into Downloader), Windows (the desktop app,
// with its own ad-free player), iPhone and iPad (Home Screen), computers (installed from the
// browser) and Samsung / LG / other smart TVs (TV mode in their own browser, or cast to them).
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CircleCheck, Download, Monitor, MonitorDown, PlusSquare, Share, Smartphone, TabletSmartphone, Tv, TvMinimal } from 'lucide-react'
import { useI18n, useT } from '@/src/components/I18nProvider'
import { Button } from '@/src/components/ui/button'
import { isDesktopApp } from '@/src/hooks/use-desktop-app'
import { useInstallPrompt } from '@/src/hooks/use-install-prompt'
import { setTvMode } from '@/src/components/tv/TvModeSetting'
import { COMPUTERS, isMacSafari, type DevicePlatform } from '@/src/lib/device-platform'
import type { AppFile, AppReleases, DesktopRelease } from '@/src/lib/app-releases'
import type { TKey } from '@/src/lib/i18n'
import { cn } from '@/src/lib/utils'
import { useDevice } from './use-device'

type CardId = 'android' | 'tv' | 'desktop' | 'ios' | 'computer' | 'smart-tv'

const ORDER: CardId[] = ['android', 'tv', 'desktop', 'ios', 'computer', 'smart-tv']

function cardFor(platform: DevicePlatform): CardId | null {
  if (platform === 'android') return 'android'
  if (platform === 'android-tv') return 'tv'
  if (platform === 'smart-tv') return 'smart-tv'
  if (platform === 'ios') return 'ios'
  if (platform === 'windows') return 'desktop'
  return COMPUTERS.includes(platform) ? 'computer' : null
}

const megabytes = (bytes: number) => Math.max(0.1, Math.round(bytes / 104857.6) / 10)

function Steps({ keys, icons = {} }: { keys: TKey[], icons?: Record<number, React.ReactNode> }) {
  const t = useT()
  return (
    <ol className="mt-4 space-y-2.5">
      {keys.map((key, index) => (
        <li key={key} className="flex gap-3 text-[14.5px] leading-relaxed text-white/70">
          <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[13px] font-semibold text-white">{index + 1}</span>
          <span className="inline-flex flex-wrap items-center gap-1.5 pt-0.5">{t(key)}{icons[index]}</span>
        </li>
      ))}
    </ol>
  )
}

function Fingerprint({ label, value }: { label: string, value: string }) {
  return (
    <div>
      <dt className="text-[12.5px] font-medium text-white/60">{label}</dt>
      <dd dir="ltr" className="mt-1 break-all rounded-xl bg-white/[0.05] px-3 py-2 font-mono text-[12px] leading-relaxed text-white/80 [user-select:all]">{value}</dd>
    </div>
  )
}

/** The release a file comes from (an Android or a desktop release). */
type ReleaseInfo = Pick<AppReleases, 'version' | 'publishedAt' | 'releaseUrl'> & { certSha256?: string | null }

/** The version line and "Check the file" for one APK or installer. */
export function FileDetails({ file, releases, version = true }: { file: AppFile, releases: ReleaseInfo, /** The version line (off where it is already shown). */ version?: boolean }) {
  const t = useT()
  const { dateLocale } = useI18n()
  const date = releases.publishedAt ? new Date(releases.publishedAt).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' }) : ''
  return (
    <>
      {version && <p className="mt-2.5 text-[13px] text-white/50">{t('apps.page.version', { version: releases.version, size: megabytes(file.size).toLocaleString(dateLocale), date })}</p>}
      {(file.sha256 || releases.certSha256) && (
        <details className="group mt-4 rounded-2xl bg-white/[0.03] px-4 py-3 ring-1 ring-white/[0.06]">
          <summary className="cursor-pointer select-none text-[13.5px] font-medium text-white/75 outline-none marker:text-white/40 focus-visible:text-white">{t('apps.page.check')}</summary>
          <p className="mt-2 text-[13px] leading-relaxed text-white/55">
            {t('apps.page.checkText')}{' '}
            {releases.releaseUrl && <a href={releases.releaseUrl} rel="noopener" target="_blank" className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white">{t('apps.page.release')}</a>}
          </p>
          <dl className="mt-3 space-y-3">
            {file.sha256 && <Fingerprint label={t('apps.page.apkSha')} value={file.sha256} />}
            {releases.certSha256 && <Fingerprint label={t('apps.page.cert')} value={releases.certSha256} />}
          </dl>
        </details>
      )}
    </>
  )
}

function Card({ id, icon, title, text, mine, children }: { id: CardId, icon: React.ReactNode, title: TKey, text: TKey, mine: boolean, children?: React.ReactNode }) {
  const t = useT()
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(
        'scroll-mt-[calc(var(--topbar)+16px)] rounded-[22px] p-5 ring-1 sm:p-7',
        mine ? 'bg-white/[0.06] ring-red-500/40 shadow-[0_24px_70px_-30px_rgb(255_36_20/0.45)]' : 'bg-white/[0.035] ring-white/[0.07]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id={`${id}-title`} className="flex items-center gap-3 font-display text-[21px] font-bold leading-tight text-white sm:text-[25px]">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.07] text-white">{icon}</span>
          {t(title)}
        </h2>
        {mine && <span className="shrink-0 rounded-full bg-red-600/90 px-2.5 py-1 text-[12px] font-semibold text-white">{t('apps.page.thisDevice')}</span>}
      </div>
      <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed text-white/65">{t(text)}</p>
      {children}
    </section>
  )
}

export default function AppDevices({ releases, desktop, tv }: { releases: AppReleases | null, desktop: DesktopRelease | null, tv: boolean }) {
  const t = useT()
  const device = useDevice()
  const { canInstall, installed, install } = useInstallPrompt()
  const [switching, setSwitching] = useState(false)
  const [desktopApp, setDesktopApp] = useState(false)
  useEffect(() => setDesktopApp(isDesktopApp()), [])
  // The address to type on a TV: this site's own host, known in the browser only (the server and
  // the first render use the production one, so they agree).
  const [host, setHost] = useState('tunisiaflicks.vercel.app')
  useEffect(() => setHost(window.location.host), [])

  const mine = device ? cardFor(device.platform) : null
  const order = mine ? [mine, ...ORDER.filter((id) => id !== mine)] : ORDER
  const inApp = !!device?.inApp
  // Windows shows the desktop app first; the browser install stays on offer on every computer.
  const computer = !!device && COMPUTERS.includes(device.platform)
  const androidFile = releases?.apps.android
  const tvFile = releases?.apps.tv
  const safari = !!device && isMacSafari(device.userAgent)

  const done = (key: TKey) => (
    <p className="mt-5 inline-flex items-center gap-2 text-[15px] font-medium text-emerald-300">
      <CircleCheck aria-hidden className="h-5 w-5" />
      {t(key)}
    </p>
  )
  const soon = <p className="mt-5 inline-flex rounded-full bg-white/[0.06] px-3 py-1.5 text-[13px] font-medium text-white/60">{t('apps.page.soon')}</p>
  const installButton = (label: TKey) => (
    <Button size="lg" className="mt-5" onClick={() => void install()}>
      <MonitorDown aria-hidden className="h-[18px] w-[18px]" />
      {t(label)}
    </Button>
  )

  const cards: Record<CardId, JSX.Element> = {
    android: (
      <Card key="android" id="android" mine={mine === 'android'} icon={<Smartphone aria-hidden className="h-5 w-5" strokeWidth={1.9} />} title="apps.android.title" text="apps.android.text">
        {mine === 'android' && inApp ? done('apps.page.inApp') : androidFile && releases ? (
          <>
            <Button asChild size="lg" className="mt-5">
              <a href="/download/android"><Download aria-hidden className="h-[18px] w-[18px]" />{t('apps.android.download')}</a>
            </Button>
            <FileDetails file={androidFile} releases={releases} />
            <Steps keys={['apps.android.step1', 'apps.android.step2', 'apps.android.step3']} />
            {mine === 'android' && canInstall && (
              <button type="button" onClick={() => void install()} className="mt-4 text-[13.5px] text-white/60 underline decoration-white/25 underline-offset-4 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-red-500">
                {t('apps.android.alt')}
              </button>
            )}
          </>
        ) : mine === 'android' && canInstall ? installButton('apps.offer.install') : soon}
      </Card>
    ),
    tv: (
      <Card key="tv" id="tv" mine={mine === 'tv'} icon={<Tv aria-hidden className="h-5 w-5" strokeWidth={1.9} />} title="apps.tv.title" text="apps.tv.text">
        {mine === 'tv' && inApp ? done('apps.page.inApp') : tvFile && releases ? (
          <>
            {mine === 'tv' && (
              <Button asChild size="lg" className="mt-5">
                <a href="/download/tv"><Download aria-hidden className="h-[18px] w-[18px]" />{t('apps.tv.download')}</a>
              </Button>
            )}
            <FileDetails file={tvFile} releases={releases} />
            <Steps keys={['apps.tv.step1', 'apps.tv.step2', 'apps.tv.step3', 'apps.tv.step4']} />
            <div className="mt-4">
              <p className="text-[13px] font-medium text-white/60">{t('apps.tv.address')}</p>
              <p dir="ltr" className="mt-1 inline-block select-all rounded-xl bg-white/[0.07] px-3.5 py-2 font-mono text-[17px] font-semibold text-white">{host}/download/tv</p>
            </div>
          </>
        ) : soon}
      </Card>
    ),
    ios: (
      <Card key="ios" id="ios" mine={mine === 'ios'} icon={<TabletSmartphone aria-hidden className="h-5 w-5" strokeWidth={1.9} />} title="apps.ios.title" text="apps.ios.text">
        {mine === 'ios' && inApp ? done('apps.page.installed') : (
          <Steps
            keys={['apps.ios.step1', 'apps.ios.step2', 'apps.ios.step3']}
            icons={{ 1: <Share aria-hidden className="h-4 w-4 text-white/70" />, 2: <PlusSquare aria-hidden className="h-4 w-4 text-white/70" /> }}
          />
        )}
      </Card>
    ),
    desktop: (
      <Card key="desktop" id="desktop" mine={mine === 'desktop'} icon={<Monitor aria-hidden className="h-5 w-5" strokeWidth={1.9} />} title="desktop.card.title" text="desktop.card.text">
        {desktopApp ? done('apps.page.inApp') : (
          <>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {desktop ? (
                <Button asChild size="lg">
                  <a href="/download/desktop"><Download aria-hidden className="h-[18px] w-[18px]" />{t('desktop.download')}</a>
                </Button>
              ) : (
                <span className="inline-flex rounded-full bg-white/[0.06] px-3 py-1.5 text-[13px] font-medium text-white/60">{t('apps.page.soon')}</span>
              )}
              <Button asChild size="lg" variant="secondary">
                <Link href="/desktop">{t('desktop.card.more')}</Link>
              </Button>
            </div>
            {desktop && <FileDetails file={desktop.file} releases={desktop} />}
          </>
        )}
      </Card>
    ),
    computer: (
      <Card key="computer" id="computer" mine={mine === 'computer'} icon={<MonitorDown aria-hidden className="h-5 w-5" strokeWidth={1.9} />} title="apps.computer.title" text="apps.computer.text">
        {computer && !desktopApp && (inApp || installed) ? done('apps.page.installed') : (
          <>
            {computer && canInstall && installButton('apps.computer.install')}
            <ul className="mt-4 space-y-2 text-[14px] leading-relaxed text-white/60">
              <li className={cn(computer && !safari && !canInstall && 'text-white/80')}>{t('apps.computer.chrome')}</li>
              <li className={cn(safari && 'text-white/80')}>{t('apps.computer.safari')}</li>
              <li>{t('apps.computer.firefox')}</li>
            </ul>
          </>
        )}
      </Card>
    ),
    'smart-tv': (
      <Card key="smart-tv" id="smart-tv" mine={mine === 'smart-tv'} icon={<TvMinimal aria-hidden className="h-5 w-5" strokeWidth={1.9} />} title="apps.smartTv.title" text="apps.smartTv.text">
        {tv ? done('apps.smartTv.isOn') : mine === 'smart-tv' ? (
          <Button
            size="lg"
            className="mt-5"
            disabled={switching}
            onClick={async () => {
              setSwitching(true)
              if (await setTvMode(true)) window.location.assign('/')
              else window.location.assign('/?tv=1')
            }}
          >
            <TvMinimal aria-hidden className="h-[18px] w-[18px]" />
            {t('apps.smartTv.on')}
          </Button>
        ) : (
          <>
            <Steps keys={['apps.smartTv.step1', 'apps.smartTv.step2', 'apps.smartTv.step3']} />
            <div className="mt-4">
              <p className="text-[13px] font-medium text-white/60">{t('apps.tv.address')}</p>
              <p dir="ltr" className="mt-1 inline-block select-all rounded-xl bg-white/[0.07] px-3.5 py-2 font-mono text-[17px] font-semibold text-white">{host}</p>
            </div>
          </>
        )}
        <h3 className="mt-6 text-[14px] font-semibold text-white/85">{t('apps.smartTv.cast')}</h3>
        <ul className="mt-2 space-y-2 text-[14px] leading-relaxed text-white/60">
          <li>{t('apps.smartTv.castIos')}</li>
          <li>{t('apps.smartTv.castAndroid')}</li>
        </ul>
        <p className="mt-4 text-[13.5px] leading-relaxed text-white/50">{t('apps.smartTv.stick')}</p>
      </Card>
    ),
  }

  return <div className="page-x grid gap-5 lg:grid-cols-2 lg:items-start">{order.map((id) => cards[id])}</div>
}
