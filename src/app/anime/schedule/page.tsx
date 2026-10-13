// /anime/schedule: this week's new episodes, a tab per day in the viewer's time zone.
import PageHeader from '@/src/components/browse/PageHeader'
import AnimeUnavailable from '@/src/components/anime/AnimeUnavailable'
import ScheduleBoard from '@/src/components/anime/ScheduleBoard'
import { animeViewer, getSchedule } from '@/src/lib/anime/server'
import { getT } from '@/src/lib/i18n/server'
import { pageMetadata } from '@/src/lib/seo'
import { withTimeout } from '@/src/lib/with-timeout'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export function generateMetadata() {
  const t = getT()
  return pageMetadata({ title: t('anime.schedule.title'), description: t('anime.schedule.subtitle'), path: '/anime/schedule', card: 'anime' })
}

export default async function AnimeSchedule() {
  const t = getT()
  const slots = await withTimeout(getSchedule(await animeViewer()), 20_000, null)
  return (
    <div className="pb-10">
      <PageHeader title={t('anime.schedule.title')} subtitle={t('anime.schedule.subtitle')} />
      {slots ? <ScheduleBoard slots={slots} /> : <AnimeUnavailable />}
    </div>
  )
}
