// /friends: what friends are watching. Guests get an invitation to sign in, Kids profiles the way
// back to a grown-up profile, people without a page the setup card; the header and the
// Activity | Your friends switch come from the layout.
import PageHeader from '@/src/components/browse/PageHeader'
import FriendsFeed from '@/src/components/social/FriendsFeed'
import ProfileSetupCard from '@/src/components/social/ProfileSetupCard'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { pageMetadata } from '@/src/lib/seo'
import { getFriendsActivity } from '@/src/lib/social/activity'
import { friendRows, otherSide } from '@/src/lib/social/friends'
import { getIdentities } from '@/src/lib/social/identity'
import { normalizePrivacy } from '@/src/lib/social/privacy'
import { withTimeout } from '@/src/lib/with-timeout'
import { tunisToday } from './_lib/feed'
import { SocialGate } from './_lib/gates'
import { pageViewer } from './_lib/viewer'

export const dynamic = 'force-dynamic'

export function generateMetadata() {
  const t = getT()
  return pageMetadata({ title: t('social.nav'), description: t('social.friends.subtitle'), path: '/friends', noIndex: true })
}

export default async function FriendsPage() {
  const t = getT()
  const viewer = await pageViewer()
  if (viewer.kind !== 'member') {
    return (
      <SocialGate
        viewer={viewer}
        title={t('social.nav')}
        subtitle={t('social.friends.subtitle')}
        signIn={{ icon: 'friends', title: t('social.friends.signInTitle'), text: t('social.friends.signInText') }}
        next="/friends"
      />
    )
  }
  if (!viewer.social) {
    return (
      <div className="pb-10">
        <PageHeader title={t('social.nav')} subtitle={t('social.friends.subtitle')} />
        <div className="page-x"><div className="max-w-[760px]"><ProfileSetupCard /></div></div>
      </div>
    )
  }

  const [feed, rows] = await Promise.all([
    withTimeout(getFriendsActivity(viewer.ref, { limit: 20, locale: getLocale() }), 8000, null).catch(() => null),
    friendRows(viewer.ref.profileId).catch(() => null),
  ])
  // The most recently active few, for the side panel on wide screens.
  const ids = (rows ?? []).slice(0, 6).map((row) => otherSide(row, viewer.ref.profileId).profileId)
  const identities = ids.length ? await getIdentities(ids).catch(() => new Map()) : new Map()
  const friends = ids.flatMap((id) => (identities.has(id) ? [identities.get(id)!] : []))
  const privacy = normalizePrivacy(viewer.social.privacy)
  return (
    <FriendsFeed
      initial={feed}
      today={tunisToday()}
      hasFriends={rows === null || rows.length > 0}
      friends={{ people: friends, total: rows?.length ?? friends.length }}
      activityPrivate={privacy.activity === 'private' || privacy.paused}
    />
  )
}
