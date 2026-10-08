import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import MediaGrid from '@/src/components/MediaGrid'
import PageHeader from '@/src/components/browse/PageHeader'
import KidsBlocked from '@/src/components/profiles/KidsBlocked'
import RoomTint from '@/src/components/shell/RoomTint'
import SeasonCountdown from '@/src/components/seasons/SeasonCountdown'
import SeasonEmblem from '@/src/components/seasons/SeasonEmblem'
import SeasonMotif from '@/src/components/seasons/SeasonMotif'
import { getKidsMode } from '@/src/lib/profiles'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { dateLocale, type TKey } from '@/src/lib/i18n'
import { getMoment, isMomentId, momentForKids, momentItems } from '@/src/lib/moments'
import { SEASONS_TODAY_COOKIE, countdownParts, getMomentCountdown, seasonClock, seasonEmblem, seasonVars } from '@/src/lib/seasons'
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

/**
 * One moment of the year (Halloween, Eid, summer...): its titles, a new selection every day. In
 * season, the seasonal ones echo the home banner: their emblem above the title, their motif behind
 * it, and on the eve a live countdown.
 */
export default async function MomentPage({ params }: Props) {
  if (!isMomentId(params.id)) notFound()
  // Ramadan has its own hub.
  if (params.id === 'ramadan') redirect('/ramadan')
  const kids = await getKidsMode()
  if (kids && !momentForKids(params.id)) return <KidsBlocked />

  const t = getT()
  const locale = getLocale()
  const clock = seasonClock(cookies().get(SEASONS_TODAY_COOKIE)?.value)
  const moment = getMoment(params.id, clock.today)
  const items = await momentItems(params.id, locale, kids, 3, clock.today)
  const until = new Date(`${moment.end}T12:00:00Z`).toLocaleDateString(dateLocale(locale) ?? 'en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })

  const emblem = moment.active ? seasonEmblem(params.id) : null
  const countdown = moment.active ? getMomentCountdown(params.id, clock.today, clock.now) : null
  const seconds = params.id === 'new-year'

  return (
    <div className="pb-10">
      <RoomTint color={moment.accent} />
      <div className="relative isolate" style={{ '--door': moment.accent } as React.CSSProperties}>
        {moment.active && (
          // The season's drawing, large and faint behind the header, clear of the countdown at its end
          // (Eids: lantern and crescent; New Year: sparkles).
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[340px] overflow-hidden sm:h-[420px]">
            <SeasonMotif
              id={params.id}
              accent={moment.accent}
              variant="page"
              className="absolute -end-28 top-2 h-[220px] w-[330px] opacity-[0.16] sm:end-[14%] sm:top-0 sm:h-[330px] sm:w-[495px] sm:opacity-30"
            />
          </div>
        )}
        <PageHeader
          title={t(`moment.${params.id}.title` as TKey)}
          icon={emblem ? <SeasonEmblem emblem={emblem} id={params.id} size="header" /> : undefined}
          subtitle={
            <>
              {t(`moment.${params.id}.blurb` as TKey)}{' '}
              <span className="text-white/50">{moment.active ? t('moment.until', { date: until }) : t('moment.offSeason')}</span>
            </>
          }
        >
          {countdown && (
            <SeasonCountdown
              at={Date.parse(countdown.at) - clock.skewMs}
              initial={countdownParts(Date.parse(countdown.at) - clock.now.getTime(), seconds)}
              seconds={seconds}
              zeroTitle={t(countdown.zeroTitle, seasonVars(countdown.zeroVars, { locale, t }))}
              size="lg"
            />
          )}
        </PageHeader>
      </div>
      <div className="page-x">
        <MediaGrid items={items} showTypeBadge />
      </div>
    </div>
  )
}
