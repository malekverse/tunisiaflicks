// Home slot 3: at most one seasonal banner (Ramadan, the Eids, the national days, New Year, "Your
// year"), from getSeasonalBanner() in src/lib/seasons.ts. Renders nothing out of season, and
// nothing at all (on the server, so no flash and no layout shift) once this occurrence of it was
// dismissed. src/components/ramadan/RamadanBanner.tsx re-exports it.
import Link from 'next/link'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth/next'
import { ChevronRight } from 'lucide-react'
import { DOOR_SHELL } from '@/src/components/hubs/HubDoor'
import SeasonEmblem from '@/src/components/seasons/SeasonEmblem'
import SeasonMotif from '@/src/components/seasons/SeasonMotif'
import SeasonalBannerLive, { SeasonalBannerFrame } from '@/src/components/seasons/SeasonalBannerLive'
import { authOptions } from '@/src/lib/auth'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { getKidsMode } from '@/src/lib/profiles'
import {
  SEASON_DISMISS_COOKIE, SEASONS_TODAY_COOKIE, countdownParts, dismissalOf, getSeasonalBanner, isDismissed, noteVars, seasonClock,
  seasonVars,
} from '@/src/lib/seasons'
import { withTimeout } from '@/src/lib/with-timeout'
import { cn } from '@/src/lib/utils'

const TITLE_ID = 'season-banner-title'
const TEXT_ID = 'season-banner-text'
const NOTE_ID = 'season-banner-note'

export default async function SeasonalBanner({ kids }: { kids?: boolean }): Promise<JSX.Element | null> {
  const jar = cookies()
  const [isKids, session] = await Promise.all([
    kids ?? withTimeout(getKidsMode(), 4000, false),
    withTimeout(getServerSession(authOptions), 4000, null),
  ])
  const clock = seasonClock(jar.get(SEASONS_TODAY_COOKIE)?.value)
  const model = getSeasonalBanner({ kids: isKids, signedIn: !!session?.user, today: clock.today, now: clock.now })
  if (!model || isDismissed(jar.get(SEASON_DISMISS_COOKIE)?.value, model)) return null

  const t = getT()
  const locale = getLocale()
  const say = (key: Parameters<typeof t>[0], vars?: Record<string, string | number>) => t(key, seasonVars(vars, { locale, t }))
  const title = say(model.title, model.titleVars)
  const subtitle = model.subtitle ? say(model.subtitle, model.subtitleVars) : null
  const note = model.note ? say(model.note, noteVars(model)) : null
  const countdown = model.countdown
  const seconds = model.id === 'new-year'
  const motif = model.id === 'ramadan' || model.id === 'eid-al-fitr' || model.id === 'eid-al-adha' || model.id === 'new-year'

  return (
    <SeasonalBannerFrame entry={dismissalOf(model)} label={t('seasons.dismiss')}>
      <Link
        href={model.href}
        aria-labelledby={TITLE_ID}
        aria-describedby={[subtitle && TEXT_ID, note && NOTE_ID].filter(Boolean).join(' ') || undefined}
        className={cn(DOOR_SHELL, 'flex-wrap items-center gap-x-4 gap-y-3 py-4 pe-14 sm:flex-nowrap sm:py-5', motif && 'sm:pe-44')}
        style={{ '--door': model.accent } as React.CSSProperties}
      >
        {motif && (
          <>
            <SeasonMotif
              id={model.id}
              accent={model.accent}
              className="absolute end-2 top-0 -z-10 hidden h-[118px] w-[177px] opacity-40 sm:block"
            />
            {/* Phones: in the bottom end corner, under the X's column (the text stops 56px short of the
                edge), so it never runs behind the words; the crescent rises out of the card's edge. */}
            <SeasonMotif
              id={model.id}
              accent={model.accent}
              variant="corner"
              className={cn(
                'absolute -z-10 opacity-30 sm:hidden',
                model.id === 'new-year' ? 'bottom-0 end-0 h-9 w-12 opacity-60' : '-bottom-4 -end-4 h-[67px] w-[80px]',
              )}
            />
          </>
        )}
        <SeasonEmblem emblem={model.emblem} id={model.id} />
        <span className="min-w-0 flex-1">
          <span id={TITLE_ID} className="block text-balance font-display text-[18px] font-bold leading-tight text-white sm:text-[22px]" dir="auto">
            {title}
            <ChevronRight
              aria-hidden
              className="ms-1 inline-block h-[0.9em] w-[0.9em] align-[-0.1em] text-white/60 transition-transform duration-200 ease-out group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"
              strokeWidth={2.4}
            />
          </span>
          {subtitle && <span id={TEXT_ID} className="mt-1 block text-[13px] text-white/70 sm:text-[14px]">{subtitle}</span>}
          {note && <span id={NOTE_ID} className="mt-1 block text-[13px] text-white/50">{note}</span>}
        </span>
        {countdown && (
          <span className="block basis-full ps-14 sm:basis-auto sm:ps-0">
            <SeasonalBannerLive
              at={Date.parse(countdown.at) - clock.skewMs}
              initial={countdownParts(Date.parse(countdown.at) - clock.now.getTime(), seconds)}
              seconds={seconds}
              zeroTitle={say(countdown.zeroTitle, countdown.zeroVars)}
            />
          </span>
        )}
      </Link>
    </SeasonalBannerFrame>
  )
}
