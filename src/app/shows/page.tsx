import ShowsView from '@/src/components/shows/ShowsView'
import ShowsSignIn from '@/src/components/shows/ShowsSignIn'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { getActiveProfile } from '@/src/lib/profiles'
import { pageMetadata } from '@/src/lib/seo'
import { getTrackedShows } from '@/src/lib/tracker-server'
import { withTimeout } from '@/src/lib/with-timeout'

// My shows: the series in this profile's watch history and where it is in each (signed out: an
// invitation to sign in). Personal, so never indexed.
export const dynamic = 'force-dynamic'

export function generateMetadata() {
  const t = getT()
  return pageMetadata({ title: t('shows.title'), description: t('shows.subtitle'), path: '/shows', card: false, noIndex: true })
}

export default async function ShowsPage() {
  const active = await getActiveProfile()
  if (!active?.profile) return <ShowsSignIn />
  const shows = await withTimeout(getTrackedShows({ userId: active.userId, profileId: active.profile.id }, getLocale()), 12000, null).catch(() => null)
  return <ShowsView shows={shows} />
}
