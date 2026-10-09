import { Clapperboard, MoonStar, Tv } from 'lucide-react'
import HubDoor from '@/src/components/hubs/HubDoor'
import LiveDot from '@/src/components/ui/live-dot'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { isArabicScript } from '@/src/lib/i18n/locales'
import { withTimeout } from '@/src/lib/with-timeout'
import { getTvHub } from '@/src/lib/tunisian-tv/read'
import { seriesName } from '@/src/lib/tunisian-tv/view'

const TUNISIAN_RED = '231 0 19'
const LANTERN = '245 190 80'

/**
 * The three doors at the top of /tunisian: Tunisian cinema, Tunisian TV (a live dot while a
 * channel broadcasts, and the newest drama episode by name) and the Ramadan series. Stacked below
 * xl so their text never has to be cut; on phones it wraps rather than truncating.
 */
export default async function TunisianDoors() {
  const t = getT()
  const arabic = isArabicScript(getLocale())
  const hub = await withTimeout(getTvHub(), 2500, null)
  const live = (hub?.live.length ?? 0) > 0
  const fresh = hub?.fresh ?? null
  const name = fresh ? seriesName(fresh.seriesTitle, fresh.seriesTitleAlt, arabic) : null
  const tvText = name
    ? fresh?.episode !== null && fresh?.episode !== undefined ? t('ttv.door.new', { series: name, n: fresh.episode }) : t('ttv.door.newSeries', { series: name })
    : t('ttv.door.text')
  const wrap = '[&_.truncate]:overflow-visible [&_.truncate]:whitespace-normal'
  return (
    <div className="grid gap-3 xl:grid-cols-3">
      <HubDoor
        href="/tunisian/cinema"
        title={t('tnCinema.title')}
        text={t('tnCinema.teaser')}
        icon={<Clapperboard className="h-5 w-5 sm:h-6 sm:w-6" />}
        accent={TUNISIAN_RED}
        className={wrap}
      />
      <HubDoor
        href="/tunisian/tv"
        title={t('ttv.title')}
        text={tvText}
        icon={<Tv className="h-5 w-5 sm:h-6 sm:w-6" />}
        accent={TUNISIAN_RED}
        badge={live ? <LiveDot label={t('ttv.door.liveLabel')} /> : undefined}
        className={wrap}
      />
      <HubDoor
        href="/ramadan"
        title={t('ttv.door.ramadan')}
        text={t('ttv.door.ramadanText')}
        icon={<MoonStar className="h-5 w-5 sm:h-6 sm:w-6" />}
        accent={LANTERN}
        className={wrap}
      />
    </div>
  )
}
