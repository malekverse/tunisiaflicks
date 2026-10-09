// /notifications: the whole inbox (the bell shows the latest). Guests get an invitation to sign in.
import { Suspense } from 'react'
import PageHeader from '@/src/components/browse/PageHeader'
import NotificationsView from '@/src/components/social/NotificationsView'
import { getT } from '@/src/lib/i18n/server'
import { getKidsMode } from '@/src/lib/profiles'
import { pageMetadata } from '@/src/lib/seo'
import SocialSignIn from '../friends/_lib/SocialSignIn'
import { pageViewer } from '../friends/_lib/viewer'

export const dynamic = 'force-dynamic'

export function generateMetadata() {
  const t = getT()
  return pageMetadata({ title: t('alerts.bellLabel'), description: t('social.notifications.subtitle'), path: '/notifications', noIndex: true })
}

export default async function NotificationsPage() {
  const t = getT()
  const viewer = await pageViewer()
  const kids = viewer.kind === 'kids' || (viewer.kind === 'tv' && viewer.kids) || (viewer.kind === 'pick' && (await getKidsMode()))
  return (
    <div className="pb-10">
      <PageHeader title={t('alerts.bellLabel')} subtitle={t(kids ? 'social.notifications.subtitleKids' : 'social.notifications.subtitle')} />
      {viewer.kind === 'guest' ? (
        <SocialSignIn icon="bell" title={t('social.notifications.signInTitle')} text={t('social.notifications.signInText')} callbackUrl="/notifications" />
      ) : viewer.kind === 'pick' ? (
        <div aria-busy className="min-h-[40vh]" />
      ) : (
        <Suspense fallback={null}>
          <NotificationsView kids={kids} />
        </Suspense>
      )}
    </div>
  )
}
