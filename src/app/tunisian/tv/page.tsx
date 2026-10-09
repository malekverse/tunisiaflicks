import HubHeader from '@/src/components/hubs/HubHeader'
import TunisiaMark from '@/src/components/tunisian/TunisiaMark'
import KidsBlocked from '@/src/components/profiles/KidsBlocked'
import TvWatchProvider from '@/src/components/tunisian-tv/TvWatchProvider'
import TvHero from '@/src/components/tunisian-tv/TvHero'
import TvRow from '@/src/components/tunisian-tv/TvRow'
import { ChannelStack, ChannelStrip } from '@/src/components/tunisian-tv/Channels'
import { TvFooter, TvWarmingUp } from '@/src/components/tunisian-tv/TvNotes'
import { getKidsMode } from '@/src/lib/profiles'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { isArabicScript } from '@/src/lib/i18n/locales'
import { pageMetadata } from '@/src/lib/seo'
import { getTvHub } from '@/src/lib/tunisian-tv/read'
import { channelName, type TvSeriesView, type TvVideoView } from '@/src/lib/tunisian-tv/view'

// The hub is cached for 5 minutes (lib/tunisian-tv/read.ts); rendering per request keeps an
// outage from being frozen into a static page, and a first visit with nothing stored reads the
// live feeds (3 seconds at most).
export const dynamic = 'force-dynamic'
export const maxDuration = 20

export function generateMetadata() {
  const t = getT()
  return pageMetadata({ title: t('ttv.title'), description: t('ttv.subtitle'), path: '/tunisian/tv', card: 'tunisian' })
}

const TUNISIAN_RED = '231 0 19'

const latestOf = (series: TvSeriesView[]): TvVideoView[] =>
  series.map((item) => item.latest).filter((video): video is TvVideoView => !!video)

/** Tunisian TV: the official channels' full episodes, live broadcasts and shows, played here. */
export default async function TunisianTvPage() {
  // Like the Tunisian catalogue, these have no age ratings.
  if (await getKidsMode()) return <KidsBlocked what='tunisian' />
  const t = getT()
  const arabic = isArabicScript(getLocale())
  const hub = await getTvHub()
  const names = Object.fromEntries(hub.channels.map((channel) => [channel.slug, channelName(channel, arabic)]))
  const heroChannel = hub.hero ? hub.channels.find((channel) => channel.slug === hub.hero!.channel) ?? null : null
  const rows = [hub.live, hub.newEpisodes, hub.mostWatched, latestOf(hub.onAir), latestOf(hub.talk), latestOf(hub.complete), latestOf(hub.ramadan?.series ?? [])]
  const empty = !hub.hero && rows.every((row) => row.length === 0)

  return (
    <div className="pb-10">
      <HubHeader
        title={t('ttv.title')}
        subtitle={t('ttv.subtitle')}
        accent={TUNISIAN_RED}
        watermark={<TunisiaMark />}
        end={empty ? undefined : <ChannelStack channels={hub.channels} />}
      />

      {empty ? (
        <TvWarmingUp />
      ) : (
        <TvWatchProvider>
          <div className="space-y-10 sm:space-y-12">
            {hub.hero && (
              <TvHero
                series={hub.hero}
                episodes={hub.heroEpisodes}
                channel={heroChannel}
                fresh={!!hub.fresh && hub.hero.latest?.seriesId === hub.hero.id && Date.now() - Date.parse(hub.hero.lastAt) < 36 * 3_600_000}
                ramadan={!!hub.ramadan?.during && hub.hero.ramadan === hub.ramadan.hijriYear}
              />
            )}
            <TvRow title={t('ttv.row.live')} subtitle={t('ttv.row.liveNote')} videos={hub.live} mode='upload' channelNames={names} />
            <TvRow title={t('ttv.row.new')} subtitle={t('ttv.row.newNote')} videos={hub.newEpisodes} mode='episode' channelNames={names} />
            {hub.ramadan && (
              <TvRow
                title={hub.ramadan.during ? t('ttv.row.ramadanNow') : t('ttv.row.ramadanOf', { year: hub.ramadan.year })}
                videos={latestOf(hub.ramadan.series)}
                mode='series'
                channelNames={names}
              />
            )}
            <TvRow title={t('ttv.row.onAir')} subtitle={t('ttv.row.onAirNote')} videos={latestOf(hub.onAir)} mode='series' channelNames={names} />
            <TvRow title={t('ttv.row.mostWatched')} videos={hub.mostWatched} mode='episode' channelNames={names} views />
            <TvRow title={t('ttv.row.talk')} videos={latestOf(hub.talk)} mode='series' channelNames={names} />
            <TvRow title={t('ttv.row.complete')} subtitle={t('ttv.row.completeNote')} videos={latestOf(hub.complete)} mode='series' channelNames={names} />
            <ChannelStrip channels={hub.channels} />
          </div>
        </TvWatchProvider>
      )}

      <TvFooter updatedAt={hub.updatedAt} />
    </div>
  )
}
