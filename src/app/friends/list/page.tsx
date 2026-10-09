// /friends/list: requests to answer, your friends, and adding one (#add) by handle or link.
import PageHeader from '@/src/components/browse/PageHeader'
import PeopleList from '@/src/components/social/PeopleList'
import ProfileSetupCard from '@/src/components/social/ProfileSetupCard'
import { getT } from '@/src/lib/i18n/server'
import { pageMetadata } from '@/src/lib/seo'
import { SocialGate } from '../_lib/gates'
import { pageViewer } from '../_lib/viewer'

export const dynamic = 'force-dynamic'

export function generateMetadata() {
  const t = getT()
  return pageMetadata({ title: t('social.friends.tabList'), description: t('social.friends.subtitle'), path: '/friends/list', noIndex: true })
}

export default async function FriendsListPage() {
  const t = getT()
  const viewer = await pageViewer()
  if (viewer.kind !== 'member') {
    return (
      <SocialGate
        viewer={viewer}
        title={t('social.nav')}
        subtitle={t('social.friends.subtitle')}
        signIn={{ icon: 'friends', title: t('social.friends.signInTitle'), text: t('social.friends.signInText') }}
        next="/friends/list"
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
  return <PeopleList handle={viewer.social.handle} name={viewer.social.name} />
}
