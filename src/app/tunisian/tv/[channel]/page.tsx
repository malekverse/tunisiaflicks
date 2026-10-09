import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BadgeCheck, ChevronLeft } from 'lucide-react'
import { FaYoutube } from 'react-icons/fa'
import { Button } from '@/src/components/ui/button'
import LiveDot from '@/src/components/ui/live-dot'
import RoomTint from '@/src/components/shell/RoomTint'
import KidsBlocked from '@/src/components/profiles/KidsBlocked'
import ChannelAvatar from '@/src/components/tunisian-tv/ChannelAvatar'
import TvWatchProvider from '@/src/components/tunisian-tv/TvWatchProvider'
import TvRow from '@/src/components/tunisian-tv/TvRow'
import { ChannelStatusNote, TvFooter, TvWarmingUp } from '@/src/components/tunisian-tv/TvNotes'
import { getKidsMode } from '@/src/lib/profiles'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { dateLocale, isArabicScript } from '@/src/lib/i18n/locales'
import { pageMetadata } from '@/src/lib/seo'
import { isYouTubeId } from '@/src/lib/youtube'
import { channelBySlug } from '@/src/lib/tunisian-tv/channels'
import { cadenceLine } from '@/src/lib/tunisian-tv/labels'
import { getTvChannel, getTvVideo } from '@/src/lib/tunisian-tv/read'
import { channelName, seriesAnchor, seriesName, type TvSeriesView, type TvVideoView } from '@/src/lib/tunisian-tv/view'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

export function generateMetadata({ params }: { params: { channel: string } }) {
  const def = channelBySlug(params.channel)
  if (!def) return {}
  const t = getT()
  const name = isArabicScript(getLocale()) ? def.nameAr : def.name
  return pageMetadata({
    title: t('ttv.channel.metaTitle', { channel: name }),
    description: t('ttv.channel.metaDescription', { channel: name }),
    path: `/tunisian/tv/${def.slug}`,
    card: 'tunisian',
  })
}

/** A channel's page: its series (one row each), its latest uploads and its shows; ?v= opens a video. */
export default async function TunisianTvChannelPage({ params, searchParams }: { params: { channel: string }, searchParams: { v?: string } }) {
  const def = channelBySlug(params.channel)
  if (!def) notFound()
  if (await getKidsMode()) return <KidsBlocked what='tunisian' />
  const page = await getTvChannel(def.slug)
  if (!page) notFound()

  const t = getT()
  const locale = getLocale()
  const arabic = isArabicScript(locale)
  const { channel } = page
  const name = channelName(channel, arabic)

  // ?v= opens that video: one the page lists, or one we keep for this channel.
  const all: TvVideoView[] = [...page.series.flatMap((section) => section.episodes), ...page.latest, ...page.shows.flatMap((section) => section.episodes)]
  const wanted = isYouTubeId(searchParams.v) ? searchParams.v : null
  const initial = wanted
    ? all.find((video) => video.parts.some((part) => part.id === wanted)) ?? await getTvVideo(def.slug, wanted)
    : null

  const live: TvVideoView[] = channel.live ? [{
    id: channel.live.videoId, title: channel.live.title, subtitle: null, channel: channel.slug, seriesId: null, seriesTitle: null, seriesTitleAlt: null,
    episode: null, season: null, parts: [{ id: channel.live.videoId, part: null, blocked: false }], publishedAt: new Date().toISOString(), views: null,
    duration: null, blocked: false, live: true, liveChannelId: channel.youtubeId,
  }] : []
  const empty = all.length === 0 && live.length === 0
  const sectionSubtitle = (series: TvSeriesView) => {
    const cadence = cadenceLine(t, series.cadence, dateLocale(locale))
    const count = series.episodeCount > 1 ? t('ttv.episodes', { count: series.episodeCount }) : null
    if (!cadence && !count) return null
    return (
      <span className="flex flex-wrap gap-x-3 gap-y-0.5">
        {cadence && <span>{cadence}</span>}
        {count && <span>{count}</span>}
      </span>
    )
  }

  return (
    <div className="pb-10">
      <RoomTint color={channel.color} />
      <header className="page-x page-top relative isolate pb-8 sm:pb-10">
        <div
          aria-hidden
          className="pointer-events-none absolute -start-32 -top-40 -z-10 h-[440px] w-[680px] rounded-full opacity-60 blur-3xl"
          style={{ background: `radial-gradient(closest-side, rgb(${channel.color} / 0.32), transparent)` }}
        />
        <Link href="/tunisian/tv" className="pressable -ms-1 inline-flex min-h-11 items-center gap-1 rounded-full pe-3 ps-1 text-[13.5px] font-medium text-white/60 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-red-500">
          <ChevronLeft aria-hidden className="h-4 w-4 rtl:rotate-180" />
          {t('ttv.channel.back')}
        </Link>
        <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-end sm:gap-6">
          <span className="relative w-fit animate-focus-in">
            <ChannelAvatar channel={channel} size={88} className="ring-4 ring-black shadow-[0_20px_60px_-20px_rgb(0_0_0/0.9)]" />
            {channel.live && <LiveDot label={t('ttv.live')} className="absolute bottom-1 end-1 scale-150" />}
          </span>
          <div className="min-w-0 flex-1">
            <h1 dir="auto" className="animate-focus-in text-balance font-display text-[clamp(36px,5.4vw,72px)] font-extrabold leading-[0.95] text-white [animation-delay:60ms]">{name}</h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[14px] text-white/60">
              <bdi dir="ltr">{channel.handle}</bdi>
              <span className="inline-flex items-center gap-1.5 text-white/75">
                <BadgeCheck aria-hidden className="h-4 w-4" />
                {t('ttv.channel.official')}
              </span>
              <span>{channel.kind === 'radio' ? t('ttv.channel.radio') : t('ttv.channel.tv')}</span>
              {channel.live && <span className="font-semibold text-white">{t('ttv.live')}</span>}
            </p>
          </div>
          <Button asChild variant="secondary" className="w-fit shrink-0">
            <a href={`https://www.youtube.com/${encodeURIComponent(channel.handle)}`} target="_blank" rel="noopener noreferrer">
              <FaYoutube aria-hidden className="h-[18px] w-[18px]" />
              {t('ttv.channel.open')}
            </a>
          </Button>
        </div>
      </header>

      <div className="space-y-10 sm:space-y-12">
        <ChannelStatusNote channel={channel} />
        {empty ? (
          <TvWarmingUp channel />
        ) : (
          <TvWatchProvider initial={initial}>
            <div className="space-y-10 sm:space-y-12">
              <TvRow title={t('ttv.row.live')} videos={live} mode='upload' />
              {page.series.map(({ series, episodes }) => (
                <TvRow
                  key={series.id}
                  id={seriesAnchor(series.id)}
                  title={seriesName(series.title, series.titleAlt, arabic)}
                  subtitle={sectionSubtitle(series)}
                  videos={episodes}
                  mode='inSeries'
                  chronological
                />
              ))}
              <TvRow title={t('ttv.channel.latest')} videos={page.latest} mode='upload' />
              {page.shows.map(({ series, episodes }) => (
                <TvRow
                  key={series.id}
                  id={seriesAnchor(series.id)}
                  title={seriesName(series.title, series.titleAlt, arabic)}
                  subtitle={sectionSubtitle(series)}
                  videos={episodes}
                  mode='inSeries'
                  chronological
                />
              ))}
            </div>
          </TvWatchProvider>
        )}
      </div>

      <TvFooter updatedAt={page.updatedAt} />
    </div>
  )
}
