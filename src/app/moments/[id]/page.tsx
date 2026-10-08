import { notFound, redirect } from 'next/navigation'
import MediaGrid from '@/src/components/MediaGrid'
import PageHeader from '@/src/components/browse/PageHeader'
import KidsBlocked from '@/src/components/profiles/KidsBlocked'
import RoomTint from '@/src/components/shell/RoomTint'
import { getKidsMode } from '@/src/lib/profiles'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { dateLocale, type TKey } from '@/src/lib/i18n'
import { getMoment, isMomentId, momentForKids, momentItems } from '@/src/lib/moments'
import { pageMetadata } from '@/src/lib/seo'

export const dynamic = 'force-dynamic'

type Props = { params: { id: string } }

export function generateMetadata({ params }: Props) {
  if (!isMomentId(params.id)) return {}
  const t = getT()
  return pageMetadata({
    title: t(`moment.${params.id}.title` as TKey),
    description: t(`moment.${params.id}.blurb` as TKey),
    path: `/moments/${params.id}`,
    card: 'discover',
  })
}

/** One moment of the year (Halloween, Eid, summer...): its titles, a new selection every day. */
export default async function MomentPage({ params }: Props) {
  if (!isMomentId(params.id)) notFound()
  // Ramadan has its own hub.
  if (params.id === 'ramadan') redirect('/ramadan')
  const kids = await getKidsMode()
  if (kids && !momentForKids(params.id)) return <KidsBlocked />

  const t = getT()
  const locale = getLocale()
  const moment = getMoment(params.id)
  const items = await momentItems(params.id, locale, kids, 3)
  const until = new Date(`${moment.end}T12:00:00Z`).toLocaleDateString(dateLocale(locale) ?? 'en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })

  return (
    <div className="pb-10">
      <RoomTint color={moment.accent} />
      <PageHeader
        title={t(`moment.${params.id}.title` as TKey)}
        subtitle={
          <>
            {t(`moment.${params.id}.blurb` as TKey)}{' '}
            <span className="text-white/40">{moment.active ? t('moment.until', { date: until }) : t('moment.offSeason')}</span>
          </>
        }
      />
      <div className="page-x">
        <MediaGrid items={items} showTypeBadge />
      </div>
    </div>
  )
}
