// /movie-night/[id]/edit: the host changes the time, the name, the place or the note (and when the
// vote closes). Anyone else is sent back to the night (or gets the night's 404).
import { notFound, redirect } from 'next/navigation'
import PageHeader from '@/src/components/browse/PageHeader'
import KidsBlocked from '@/src/components/profiles/KidsBlocked'
import NightForm from '@/src/components/movie-night/NightForm'
import { getT } from '@/src/lib/i18n/server'
import { loadNight } from '@/src/lib/movie-night'
import { isNightId } from '@/src/lib/movie-night-rules'
import { pageMetadata } from '@/src/lib/seo'
import { socialSelf } from '@/src/lib/social/session'

export const dynamic = 'force-dynamic'

export function generateMetadata({ params }: { params: { id: string } }) {
  const t = getT()
  return pageMetadata({ title: t('movieNight.edit.title'), path: `/movie-night/${params.id}/edit`, card: false, noIndex: true })
}

export default async function EditNightPage({ params }: { params: { id: string } }) {
  if (!isNightId(params.id)) notFound()
  const t = getT()
  const self = await socialSelf().catch(() => null)
  if (self?.kids) return <KidsBlocked what="social" title={t('movieNight.kids.title')} description={t('movieNight.kids.text')} next={`/movie-night/${params.id}`} />
  const load = await loadNight(params.id, self && !self.limited ? self.ref : null)
  if (load.access === 'none') notFound()
  if (load.access !== 'member' || !load.view.can.edit) redirect(`/movie-night/${params.id}`)
  const view = load.view
  return (
    <div className="pb-10">
      <PageHeader title={t('movieNight.edit.title')} />
      <NightForm
        mode="edit"
        account="ok"
        host={view.host}
        initial={{
          id: view.id,
          title: view.title,
          place: view.place,
          note: view.note,
          starts_at: view.starts_at,
          tz: view.tz,
          vote_closes_at: view.vote.closes_at,
          voteOpen: view.vote.open,
        }}
      />
    </div>
  )
}
