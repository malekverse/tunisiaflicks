import { redirect } from 'next/navigation'
import ChallengesView, { type ChallengesData } from '@/src/components/challenges/ChallengesView'
import KidsBlocked from '@/src/components/profiles/KidsBlocked'
import { getT } from '@/src/lib/i18n/server'
import { getActiveProfile, getKidsMode } from '@/src/lib/profiles'
import { challengesFor, daysLeft, monthOf } from '@/src/lib/badges/challenges'
import { getChallengesView } from '@/src/lib/badges/challenges-view'
import { tunisToday } from '@/src/lib/badges/time'
import { loadSocialProfile } from '@/src/lib/social/session'
import { pageMetadata } from '@/src/lib/seo'

// Monthly film challenges (lib/badges/challenges): this month's three, measured from the profile's
// private play log, its friends' progress, and the months before. Personal, so never cached; Kids
// profiles don't get challenges (they reward watching more).
export const dynamic = 'force-dynamic'

export function generateMetadata() {
  const t = getT()
  return pageMetadata({ title: t('challenges.nav'), description: t('challenges.subtitle'), path: '/challenges', card: false, noIndex: true })
}

export default async function ChallengesPage() {
  const t = getT()
  if (await getKidsMode()) return <KidsBlocked title={t('challenges.kidsTitle')} description={t('challenges.kidsText')} next="/challenges" />
  const today = tunisToday()
  const month = monthOf(today)
  const active = await getActiveProfile()
  // Signed in with several profiles and none picked on this device: pick one first.
  if (active && !active.profile) redirect('/profiles?next=/challenges')
  let data: ChallengesData
  if (!active?.profile) {
    data = { signedIn: false, month, daysLeft: daysLeft(month, today), challenges: challengesFor(month) }
  } else {
    const social = await loadSocialProfile(active.profile.id)
    const view = await getChallengesView({ userId: active.userId, profileId: active.profile.id }, { friends: !!social })
    data = { signedIn: true, ...view }
  }
  return <ChallengesView data={data} />
}
