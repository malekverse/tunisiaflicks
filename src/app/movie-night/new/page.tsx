// /movie-night/new: plan a night. ?title=movie:550 (from a title's ShareSheet) puts that film on
// the ballot already.
import PageHeader from '@/src/components/browse/PageHeader'
import KidsBlocked from '@/src/components/profiles/KidsBlocked'
import NightForm from '@/src/components/movie-night/NightForm'
import NightsSignedOut from '@/src/components/movie-night/NightsSignedOut'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { isCandidateKey, parseCandidateKey } from '@/src/lib/movie-night-rules'
import { pageMetadata } from '@/src/lib/seo'
import { getIdentity } from '@/src/lib/social/identity'
import { resolveShareMedia } from '@/src/lib/social/media'
import { socialSelf } from '@/src/lib/social/session'
import { withTimeout } from '@/src/lib/with-timeout'

export const dynamic = 'force-dynamic'

export function generateMetadata() {
  const t = getT()
  return pageMetadata({ title: t('movieNight.new.title'), description: t('movieNight.metaDescription'), path: '/movie-night/new', noIndex: true })
}

export default async function NewNightPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const t = getT()
  const self = await socialSelf().catch(() => null)
  if (self?.kids) return <KidsBlocked what="social" title={t('movieNight.kids.title')} description={t('movieNight.kids.text')} next="/movie-night/new" />
  if (!self || self.limited) {
    return (
      <div className="pb-10">
        <PageHeader title={t('movieNight.new.title')} subtitle={t('movieNight.new.subtitle')} />
        <NightsSignedOut />
      </div>
    )
  }

  const raw = typeof searchParams.title === 'string' ? searchParams.title : ''
  let prefill = null
  if (isCandidateKey(raw)) {
    const { media_type, id } = parseCandidateKey(raw)
    const media = await withTimeout(resolveShareMedia(media_type, id, getLocale()), 4000, null)
    if (media) prefill = { key: `${media.media_type}:${media.id}`, media, year: '' }
  }
  const identity = self.social ? await getIdentity(self.ref.profileId).catch(() => null) : null
  const host = identity ?? { name: self.profileName, color: self.color, image: null, handle: null }
  const account = !self.verified ? 'unverified' : !self.social ? 'needs_handle' : 'ok'

  return (
    <div className="pb-10">
      <PageHeader title={t('movieNight.new.title')} subtitle={t('movieNight.new.subtitle')} />
      <NightForm mode="new" prefill={prefill} account={account} host={host} />
    </div>
  )
}
