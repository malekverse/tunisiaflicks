// /app, "Get the app" (public): TunisiaFlicks on every screen. The Android apps come from the
// newest GitHub release (src/lib/app-releases.ts, found by itself); iPhone, iPad and computers
// install the site from the browser; other smart TVs use TV mode.
import type { Metadata } from 'next'
import PageHeader from '@/src/components/browse/PageHeader'
import QrCode from '@/src/components/tv/QrCode'
import AppDevices from '@/src/components/apps/AppDevices'
import { getAppReleases } from '@/src/lib/app-releases'
import { getT } from '@/src/lib/i18n/server'
import { SITE_URL, pageMetadata } from '@/src/lib/seo'
import { isTvMode } from '@/src/lib/tv-mode'
import { withTimeout } from '@/src/lib/with-timeout'

export function generateMetadata(): Metadata {
  const t = getT()
  return pageMetadata({ title: `${t('apps.page.metaTitle')} | TunisiaFlicks`, description: t('apps.page.metaDesc'), path: '/app' })
}

export default async function AppPage() {
  const t = getT()
  const releases = await withTimeout(getAppReleases(), 4500, null)
  const appUrl = `${SITE_URL}/app`

  return (
    <div className="pb-14">
      <PageHeader title={t('apps.page.title')} subtitle={t('apps.page.subtitle')}>
        <div className="hidden items-center gap-4 rounded-[22px] bg-white/[0.04] p-3 pe-5 ring-1 ring-white/[0.07] md:flex">
          <QrCode value={appUrl} label={t('apps.page.qrAlt', { url: appUrl })} className="h-[104px] w-[104px] p-1.5" />
          <p className="max-w-[15ch] text-[14px] leading-snug text-white/70">{t('apps.page.qrTitle')}</p>
        </div>
      </PageHeader>
      <AppDevices releases={releases} tv={isTvMode()} />
    </div>
  )
}
