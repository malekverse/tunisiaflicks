// /app, "Get the app" (public): installing the site itself (PWA), and TV mode in a browser.
// (The Android TV APK and the Google Play app are parked on the feat/android-apps branch.)
import type { Metadata } from 'next'
import PageHeader from '@/src/components/browse/PageHeader'
import QrCode from '@/src/components/tv/QrCode'
import { InstallPanel, TvModePanel } from '@/src/components/tv/AppPanels'
import { getT } from '@/src/lib/i18n/server'
import { SITE_URL, pageMetadata } from '@/src/lib/seo'
import { isTvMode } from '@/src/lib/tv-mode'

export function generateMetadata(): Metadata {
  const t = getT()
  return pageMetadata({ title: `${t('tvMode.app.metaTitle')} | TunisiaFlicks`, description: t('tvMode.app.metaDesc'), path: '/app' })
}

const PANEL = 'rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-white/[0.07] sm:p-7'

export default function AppPage() {
  const t = getT()
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

      <div className="page-x grid gap-5 lg:grid-cols-2 lg:items-start">
        <InstallPanel className={PANEL} />
        <TvModePanel className={PANEL} tv={tv} />
      </div>
    </div>
  )
}
