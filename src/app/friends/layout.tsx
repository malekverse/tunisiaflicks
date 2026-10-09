// /friends and /friends/list share their header: 'Friends', one line, and the Activity | Your
// friends switch (kept across the two pages, so its pill slides). Only for grown-ups with a page;
// everyone else gets the page's own gate (sign in, Kids, create your page) from the page itself.
import PageHeader from '@/src/components/browse/PageHeader'
import { getT } from '@/src/lib/i18n/server'
import FriendsTabs from './_lib/FriendsTabs'
import { pageViewer, requestCounts } from './_lib/viewer'

export const dynamic = 'force-dynamic'

export default async function FriendsLayout({ children }: { children: React.ReactNode }) {
  const viewer = await pageViewer()
  if (viewer.kind !== 'member' || !viewer.social) return <>{children}</>
  const t = getT()
  const counts = await requestCounts(viewer.ref).catch(() => ({ waiting: 0, unread: 0 }))
  return (
    <div className="pb-10">
      <PageHeader title={t('social.nav')} subtitle={t('social.friends.subtitle')}>
        <FriendsTabs waiting={counts.waiting} unread={counts.unread} />
      </PageHeader>
      {children}
    </div>
  )
}
