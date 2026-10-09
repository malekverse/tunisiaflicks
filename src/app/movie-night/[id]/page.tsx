// /movie-night/[id]: a night. Members (the host and the guests) get all of it; someone waiting for
// approval, or holding an invitation link (?invite=), gets the preview; everyone else a 404, so a
// night's existence stays between the people in it. Kids profiles are turned away (Switch profile
// comes back here, link included).
import { notFound, redirect } from 'next/navigation'
import KidsBlocked from '@/src/components/profiles/KidsBlocked'
import NightPreview from '@/src/components/movie-night/NightPreview'
import NightView from '@/src/components/movie-night/NightView'
import { getT } from '@/src/lib/i18n/server'
import { loadNight } from '@/src/lib/movie-night'
import { isNightId } from '@/src/lib/movie-night-rules'
import { pageMetadata } from '@/src/lib/seo'
import { socialSelf } from '@/src/lib/social/session'

export const dynamic = 'force-dynamic'

export function generateMetadata({ params }: { params: { id: string } }) {
  const t = getT()
  // Nothing private in the title or the description: the share card (./opengraph-image.tsx) only
  // shows the date, the host's first name and the posters.
  return pageMetadata({ title: t('movieNight.title'), description: t('movieNight.share.text'), path: `/movie-night/${params.id}`, card: false, noIndex: true })
}

export default async function NightPage({ params, searchParams }: { params: { id: string }; searchParams: Record<string, string | string[] | undefined> }) {
  if (!isNightId(params.id)) notFound()
  const token = typeof searchParams.invite === 'string' ? searchParams.invite : null
  const self = await socialSelf().catch(() => null)
  if (self?.kids) {
    const t = getT()
    const next = `/movie-night/${params.id}${token ? `?invite=${encodeURIComponent(token)}` : ''}`
    return <KidsBlocked what="social" title={t('movieNight.kids.title')} description={t('movieNight.kids.text')} next={next} />
  }
  const viewer = self && !self.limited ? self.ref : null
  const load = await loadNight(params.id, viewer, { token })
  if (load.access === 'none') notFound()
  if (load.access === 'member') {
    // Already in: the link has done its job.
    if (token) redirect(`/movie-night/${params.id}`)
    return <NightView initial={load.view} created={searchParams.created === '1'} />
  }
  return <NightPreview preview={load.view} token={token} signedIn={!!viewer} />
}
