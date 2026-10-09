"use client"
// The browser parts of /app: installing the site (the browser's own install prompt when it offers
// one, otherwise the steps for this platform) and TV mode.
import { useEffect, useState } from 'react'
import { CircleCheck, MonitorDown, Share, TvMinimal } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import { Button } from '@/src/components/ui/button'
import { useInTvApp } from '@/src/hooks/use-tv-mode'
import { setTvMode } from './TvModeSetting'

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

function Title({ icon, children, id }: { icon: React.ReactNode; children: React.ReactNode; id: string }) {
  return (
    <h2 id={id} className="flex items-center gap-3 font-display text-[21px] font-bold leading-tight text-white sm:text-[26px]">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.07] text-white">{icon}</span>
      {children}
    </h2>
  )
}

export function InstallPanel({ className }: { className?: string }) {
  const t = useT()
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [installed, setInstalled] = useState(false)
  const [platform, setPlatform] = useState<'ios' | 'other' | null>(null)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
    setInstalled(standalone)
    const ua = navigator.userAgent
    setPlatform(/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'ios' : 'other')
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setPrompt(event as InstallPrompt)
    }
    const onInstalled = () => {
      setInstalled(true)
      setPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = async () => {
    if (!prompt) return
    await prompt.prompt()
    const choice = await prompt.userChoice.catch(() => null)
    if (choice?.outcome === 'accepted') setInstalled(true)
    setPrompt(null)
  }

  return (
    <section aria-labelledby="app-pwa" className={className}>
      <Title id="app-pwa" icon={<MonitorDown aria-hidden className="h-5 w-5" strokeWidth={1.9} />}>{t('tvMode.app.pwa.title')}</Title>
      <p className="mt-3 text-[15px] leading-relaxed text-white/65">{t('tvMode.app.pwa.text')}</p>
      {installed ? (
        <p className="mt-5 inline-flex items-center gap-2 text-[15px] font-medium text-emerald-300">
          <CircleCheck aria-hidden className="h-5 w-5" />
          {t('tvMode.app.pwa.installed')}
        </p>
      ) : prompt ? (
        <Button size="lg" className="mt-5" onClick={install}>
          <MonitorDown aria-hidden className="h-[18px] w-[18px]" />
          {t('tvMode.app.pwa.install')}
        </Button>
      ) : platform === 'ios' ? (
        <div className="mt-5">
          <h3 className="text-[14px] font-semibold text-white">{t('tvMode.app.pwa.iosTitle')}</h3>
          <ol className="mt-2.5 space-y-2.5">
            {(['tvMode.app.pwa.ios1', 'tvMode.app.pwa.ios2', 'tvMode.app.pwa.ios3'] as const).map((key, index) => (
              <li key={key} className="flex items-center gap-3 text-[14.5px] text-white/70">
                <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[13px] font-semibold text-white">{index + 1}</span>
                <span className="inline-flex items-center gap-1.5">
                  {t(key)}
                  {index === 1 && <Share aria-hidden className="h-4 w-4 text-white/70" />}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : platform === 'other' ? (
        <div className="mt-5">
          <h3 className="text-[14px] font-semibold text-white">{t('tvMode.app.pwa.otherTitle')}</h3>
          <p className="mt-1.5 text-[14.5px] leading-relaxed text-white/65">{t('tvMode.app.pwa.other')}</p>
        </div>
      ) : null}
    </section>
  )
}

export function TvModePanel({ className, tv }: { className?: string; tv: boolean }) {
  const t = useT()
  const inApp = useInTvApp()
  const [busy, setBusy] = useState(false)
  if (inApp) return null

  const turnOn = async () => {
    setBusy(true)
    if (await setTvMode(true)) window.location.assign('/')
    else window.location.assign('/?tv=1')
  }

  return (
    <section aria-labelledby="app-tv-mode" className={className}>
      <Title id="app-tv-mode" icon={<TvMinimal aria-hidden className="h-5 w-5" strokeWidth={1.9} />}>{t('tvMode.app.mode.title')}</Title>
      <p className="mt-3 text-[15px] leading-relaxed text-white/65">{t('tvMode.app.mode.text')}</p>
      {tv ? (
        <p className="mt-5 inline-flex items-center gap-2 text-[15px] font-medium text-emerald-300">
          <CircleCheck aria-hidden className="h-5 w-5" />
          {t('tvMode.app.mode.isOn')}
        </p>
      ) : (
        <Button size="lg" variant="secondary" className="mt-5" disabled={busy} onClick={turnOn}>
          <TvMinimal aria-hidden className="h-[18px] w-[18px]" />
          {t('tvMode.app.mode.on')}
        </Button>
      )}
    </section>
  )
}
