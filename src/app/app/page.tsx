// /app, "Get the app" (public): the Android TV app (an APK on GitHub Releases, shown once
// NEXT_PUBLIC_ANDROID_APK_URL is set, with its checksums), the phone app on Google Play (once
// NEXT_PUBLIC_PLAY_STORE_URL is set), installing the site itself (PWA), and TV mode in a browser.
import type { Metadata } from 'next'
import { Download, Smartphone, Tv } from 'lucide-react'
import { FaGooglePlay } from 'react-icons/fa'
import PageHeader from '@/src/components/browse/PageHeader'
import QrCode from '@/src/components/tv/QrCode'
import { InstallPanel, TvModePanel } from '@/src/components/tv/AppPanels'
import { getT } from '@/src/lib/i18n/server'
import { SITE_URL, pageMetadata } from '@/src/lib/seo'
import { androidApkChecks, androidApkUrl, isTvMode, playStoreUrl } from '@/src/lib/tv-mode'

export function generateMetadata(): Metadata {
  const t = getT()
  return pageMetadata({ title: `${t('tvMode.app.metaTitle')} | TunisiaFlicks`, description: t('tvMode.app.metaDesc'), path: '/app' })
}

const PANEL = 'rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-white/[0.07] sm:p-7'

function PanelTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 font-display text-[21px] font-bold leading-tight text-white sm:text-[26px]">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.07] text-white">{icon}</span>
      {children}
    </h2>
  )
}

function Fingerprint({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[13px] font-medium text-white/70">{label}</dt>
      <dd dir="ltr" className="mt-1 break-all rounded-xl bg-white/[0.05] px-3 py-2 font-mono text-[12.5px] leading-relaxed text-white/80 [user-select:all]">{value}</dd>
    </div>
  )
}

export default function AppPage() {
  const t = getT()
  const apk = androidApkUrl()
  const checks = androidApkChecks()
  const play = playStoreUrl()
  const tv = isTvMode()
  const appUrl = `${SITE_URL}/app`

  return (
    <div className="pb-14">
      <PageHeader title={t('tvMode.app.title')} subtitle={t('tvMode.app.subtitle')}>
        <div className="hidden items-center gap-4 rounded-[22px] bg-white/[0.04] p-3 pe-5 ring-1 ring-white/[0.07] md:flex">
          <QrCode value={appUrl} label={t('tvMode.app.qr.alt', { url: appUrl })} className="h-[104px] w-[104px] p-1.5" />
          <p className="max-w-[15ch] text-[14px] leading-snug text-white/70">{t('tvMode.app.qr.title')}</p>
        </div>
      </PageHeader>

      <div className="page-x grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:items-start">
        {apk ? (
          <section aria-labelledby="app-tv" className={PANEL}>
            <div id="app-tv"><PanelTitle icon={<Tv aria-hidden className="h-5 w-5" strokeWidth={1.9} />}>{t('tvMode.app.tv.title')}</PanelTitle></div>
            <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-white/65">{t('tvMode.app.tv.text')}</p>
            <a
              href={apk}
              rel="noopener"
              className="pressable mt-5 inline-flex h-12 items-center gap-2.5 rounded-full bg-red-600 px-6 text-[15px] font-semibold text-white outline-none transition-colors hover:bg-red-500 focus-visible:ring-2 focus-visible:ring-white"
            >
              <Download aria-hidden className="h-[18px] w-[18px]" />
              {t('tvMode.app.tv.download')}
            </a>

            <h3 className="mt-8 text-[15px] font-semibold text-white">{t('tvMode.app.tv.stepsTitle')}</h3>
            <ol className="mt-3 space-y-3">
              {(['tvMode.app.tv.step1', 'tvMode.app.tv.step2', 'tvMode.app.tv.step3', 'tvMode.app.tv.step4'] as const).map((key, index) => (
                <li key={key} className="flex gap-3 text-[14.5px] leading-relaxed text-white/70">
                  <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/[0.08] text-[13px] font-semibold text-white">{index + 1}</span>
                  <span className="pt-0.5">{t(key)}</span>
                </li>
              ))}
            </ol>
            <dl className="mt-5 space-y-4">
              <Fingerprint label={t('tvMode.app.tv.address')} value={apk} />
            </dl>

            {(checks.apkSha256 || checks.certSha256) && (
              <div className="mt-8 border-t border-white/[0.07] pt-6">
                <h3 className="text-[15px] font-semibold text-white">{t('tvMode.app.tv.verifyTitle')}</h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-white/55">
                  {t('tvMode.app.tv.verifyText')}
                  {checks.releaseUrl && <>{' '}<a href={checks.releaseUrl} rel="noopener" className="text-white underline decoration-white/30 underline-offset-4 hover:decoration-white">{t('tvMode.app.tv.release')}</a></>}
                </p>
                <dl className="mt-4 space-y-4">
                  {checks.apkSha256 && <Fingerprint label={t('tvMode.app.tv.sha')} value={checks.apkSha256} />}
                  {checks.certSha256 && <Fingerprint label={t('tvMode.app.tv.cert')} value={checks.certSha256} />}
                </dl>
              </div>
            )}
          </section>
        ) : null}

        <div className={apk ? 'grid gap-5' : 'grid gap-5 lg:col-span-2 lg:grid-cols-2'}>
          {play && (
            <section aria-labelledby="app-play" className={PANEL}>
              <div id="app-play"><PanelTitle icon={<Smartphone aria-hidden className="h-5 w-5" strokeWidth={1.9} />}>{t('tvMode.app.play.title')}</PanelTitle></div>
              <p className="mt-3 text-[15px] leading-relaxed text-white/65">{t('tvMode.app.play.text')}</p>
              <a
                href={play}
                rel="noopener"
                className="pressable mt-5 inline-flex h-14 items-center gap-3 rounded-[14px] bg-black px-5 text-white outline-none ring-1 ring-white/25 transition-colors hover:ring-white/50 focus-visible:ring-2 focus-visible:ring-white"
              >
                <FaGooglePlay aria-hidden className="h-6 w-6" />
                <span className="flex flex-col items-start leading-none">
                  <span className="text-[11px] text-white/80">{t('tvMode.app.play.getItOn')}</span>
                  <span className="mt-1 text-[19px] font-semibold">Google Play</span>
                </span>
              </a>
            </section>
          )}
          <InstallPanel className={PANEL} />
          <TvModePanel className={PANEL} tv={tv} />
        </div>
      </div>
    </div>
  )
}
