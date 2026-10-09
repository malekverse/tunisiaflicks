// /app, "Get the app" (public): TunisiaFlicks on every screen. The Android apps and the Windows
// desktop app come from the newest GitHub releases (src/lib/app-releases.ts, found by themselves);
// iPhone, iPad and other computers install the site from the browser; other smart TVs use TV mode.
import type { Metadata } from 'next'
import PageHeader from '@/src/components/browse/PageHeader'
import QrCode from '@/src/components/tv/QrCode'
import AppDevices from '@/src/components/apps/AppDevices'
import DesktopSpotlight from '@/src/components/desktop/DesktopSpotlight'
import { getAppReleases, getDesktopRelease } from '@/src/lib/app-releases'
import { showcaseFilm } from '@/src/lib/desktop-showcase'
import { getT } from '@/src/lib/i18n/server'
import { SITE_URL, pageMetadata } from '@/src/lib/seo'
import { isTvMode } from '@/src/lib/tv-mode'
import { withTimeout } from '@/src/lib/with-timeout'

export function generateMetadata(): Metadata {
  const t = getT()
  return pageMetadata({ title: t('apps.page.metaTitle'), description: t('apps.page.metaDesc'), path: '/app' })
}

export default async function AppPage() {
  const t = getT()
  const tv = isTvMode()
  const [releases, desktop, film] = await Promise.all([
    withTimeout(getAppReleases(), 4500, null),
    withTimeout(getDesktopRelease(), 4500, null),
    // TV mode has no use for a Windows app.
    tv ? null : withTimeout(showcaseFilm(), 2500, null),
  ])
  const appUrl = `${SITE_URL}/app`

  return (
    <div className="pb-14">
      <PageHeader title={t('apps.page.title')} subtitle={t('apps.page.subtitle')}>
        <div className="hidden items-center gap-4 rounded-[22px] bg-white/[0.04] p-3 pe-5 ring-1 ring-white/[0.07] md:flex">
          <QrCode value={appUrl} label={t('apps.page.qrAlt', { url: appUrl })} className="h-[104px] w-[104px] p-1.5" />
          <p className="max-w-[15ch] text-[14px] leading-snug text-white/70">{t('apps.page.qrTitle')}</p>
        </div>
      </PageHeader>
      {!tv && <DesktopSpotlight film={film} />}
      <AppDevices releases={releases} desktop={desktop} tv={tv} />
    </div>
  )
}
