import { getLocale, getT } from '@/src/lib/i18n/server'
import { isArabicScript } from '@/src/lib/i18n/locales'
import { withTimeout } from '@/src/lib/with-timeout'
import { getRamadanTv, getTvHub } from '@/src/lib/tunisian-tv/read'
import { channelName, type TvVideoView } from '@/src/lib/tunisian-tv/view'
import TvWatchProvider from './TvWatchProvider'
import TvRow from './TvRow'

/**
 * /ramadan: this Ramadan's series on the Tunisian channels (the latest Ramadan's outside it),
 * playable right there. Null for Kids, and when the channels have none (bounded to 3 seconds).
 */
export default async function RamadanTvRows({ kids }: { kids: boolean }) {
  if (kids) return null
  const [ramadan, hub] = await withTimeout(Promise.all([getRamadanTv(), getTvHub()]), 3000, [null, null] as const)
  const videos = (ramadan?.series ?? []).map((series) => series.latest).filter((video): video is TvVideoView => !!video)
  if (!ramadan || videos.length === 0) return null
  const t = getT()
  const arabic = isArabicScript(getLocale())
  const names = Object.fromEntries((hub?.channels ?? []).map((channel) => [channel.slug, channelName(channel, arabic)]))
  return (
    <TvWatchProvider>
      <TvRow
        title={ramadan.during ? t('ttv.ramadan.rowNow') : t('ttv.ramadan.rowOf', { year: ramadan.year })}
        subtitle={t('ttv.ramadan.rowNote')}
        videos={videos}
        mode="series"
        channelNames={names}
      />
    </TvWatchProvider>
  )
}
