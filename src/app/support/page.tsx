// /support: why TunisiaFlicks is free, what keeps it running, a coffee on Ko-fi, the code that
// links a coffee to an account, and the supporters who asked to be thanked by name. No amounts,
// no invented numbers. Until NEXT_PUBLIC_SUPPORT_URL is set it says support isn't open yet (and
// stays out of search engines); Kids profiles never see it (no money talk).
import type { Metadata } from 'next'
import { Coffee } from 'lucide-react'
import PageHeader from '@/src/components/browse/PageHeader'
import { EmptyState } from '@/src/components/MediaGrid'
import KidsBlocked from '@/src/components/profiles/KidsBlocked'
import SupportView, { SUPPORT_PANEL } from '@/src/components/support/SupportView'
import { getT } from '@/src/lib/i18n/server'
import { getActiveProfile, getKidsMode } from '@/src/lib/profiles'
import { pageMetadata } from '@/src/lib/seo'
import { supporterCredits } from '@/src/lib/support'
import { supportUrl } from '@/src/lib/support-url'
import { withTimeout } from '@/src/lib/with-timeout'

export const dynamic = 'force-dynamic'

export function generateMetadata(): Metadata {
  const t = getT()
  return pageMetadata({ title: t('support.meta.title'), description: t('support.meta.description'), path: '/support', noIndex: !supportUrl() })
}

export default async function SupportPage() {
  const t = getT()
  if (await getKidsMode()) {
    return <KidsBlocked title={t('support.kids.title')} description={t('support.kids.desc')} next="/support" />
  }
  const url = supportUrl()
  if (!url) {
    return (
      <div className="pb-10">
        <PageHeader title={t('support.title')} />
        <div className="page-x">
          <div className={SUPPORT_PANEL}>
            <EmptyState title={t('support.empty.title')} icon={<Coffee aria-hidden className="h-6 w-6" />}>
              {t('support.empty.text')}
            </EmptyState>
          </div>
        </div>
      </div>
    )
  }

  const [active, credits] = await Promise.all([
    getActiveProfile(),
    withTimeout(supporterCredits(), 2500, [] as string[]),
  ])
  return <SupportView url={url} signedIn={!!active} credits={credits} />
}
