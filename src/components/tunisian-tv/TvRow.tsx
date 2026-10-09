"use client"
import VideoTile from '@/src/components/media/VideoTile'
import LiveDot from '@/src/components/ui/live-dot'
import { Row, SectionHeader } from '@/src/components/rows/Row'
import { useI18n } from '@/src/components/I18nProvider'
import { isArabicScript } from '@/src/lib/i18n/locales'
import { compactCount, episodeLabel, timeAgo } from '@/src/lib/tunisian-tv/labels'
import { formatDuration } from '@/src/lib/tunisian-tv/parse'
import { seriesName, type TvVideoView } from '@/src/lib/tunisian-tv/view'
import { useTvWatch } from './TvWatchProvider'

// The same widths as LANDSCAPE_WIDTH in components/dramas/widths.ts (a server module's values
// can't be read from here).
const TILE_WIDTH = 'w-[74vw] max-w-[320px] sm:w-[300px] sm:max-w-none lg:w-[320px] 2xl:w-[360px]'

/**
 * What a tile says:
 * - 'series': a series (its newest episode plays): the series' name, then the episode and channel.
 * - 'episode': one episode among others: the series' name when the title numbers an episode.
 * - 'inSeries': in its own series' row: the episode's number or title.
 * - 'upload': anything a channel posted: its own title.
 */
export type TileMode = 'series' | 'episode' | 'inSeries' | 'upload'

function LiveBadge({ label }: { label: string }) {
  return (
    <span className="glass inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold text-white">
      <LiveDot label={label} />
      <span aria-hidden>{label}</span>
    </span>
  )
}

export function TvTile({ video, mode, channelName, views = false, onPlay }: {
  video: TvVideoView
  mode: TileMode
  channelName?: string | null
  views?: boolean
  onPlay: () => void
}) {
  const { t, locale, dateLocale } = useI18n()
  const arabic = isArabicScript(locale)
  const series = video.seriesTitle ? seriesName(video.seriesTitle, video.seriesTitleAlt, arabic) : null
  const episode = episodeLabel(t, video)

  let title = video.title
  if ((mode === 'series' || mode === 'episode') && series && (episode || mode === 'series')) title = series
  else if (mode === 'inSeries') title = video.subtitle && episode ? video.subtitle : episode ?? video.subtitle ?? video.title

  const meta: React.ReactNode[] = []
  if (video.live) {
    if (channelName) meta.push(<span key="live">{t('ttv.liveOn', { channel: channelName })}</span>)
  } else {
    if (mode === 'inSeries' && video.subtitle && episode) meta.push(<span key="ep">{episode}</span>)
    else if (mode !== 'inSeries' && mode !== 'upload' && episode && title !== video.title) meta.push(<span key="ep">{episode}</span>)
    if (channelName) meta.push(<bdi key="ch">{channelName}</bdi>)
    // Relative to now: the server and the browser can be a minute apart.
    meta.push(<time key="at" dateTime={video.publishedAt} suppressHydrationWarning>{timeAgo(video.publishedAt, dateLocale)}</time>)
    if (video.parts.length > 1) meta.push(<span key="parts">{t('ttv.parts', { count: video.parts.length })}</span>)
    if (views && video.views) meta.push(<span key="views" suppressHydrationWarning>{t('ttv.views', { count: compactCount(video.views, dateLocale) })}</span>)
  }

  return (
    <VideoTile
      videoKey={video.id}
      title={title}
      meta={meta.length ? meta : undefined}
      badge={video.live ? <LiveBadge label={t('ttv.live')} /> : undefined}
      duration={video.live ? null : formatDuration(video.duration)}
      blocked={video.blocked}
      onPlay={onPlay}
    />
  )
}

/**
 * A titled row of videos. Pressing one opens the page's player on it, and previous / next walk
 * the row (or, with `chronological`, the series from its first episode to its last, while the
 * row itself shows the newest first).
 */
export default function TvRow({ id, title, subtitle, videos, mode, channelNames, views, chronological = false, className }: {
  id?: string
  title: string
  subtitle?: React.ReactNode
  videos: TvVideoView[]
  mode: TileMode
  /** Channel slug → name in the reader's language; leave out to hide the channel (its own page). */
  channelNames?: Record<string, string>
  views?: boolean
  chronological?: boolean
  className?: string
}) {
  const { play } = useTvWatch()
  if (videos.length === 0) return null
  const ordered = chronological ? [...videos].reverse() : videos
  return (
    <section id={id} aria-label={title} className={className ?? 'w-full scroll-mt-24'}>
      <SectionHeader title={<bdi>{title}</bdi>} subtitle={subtitle || undefined} />
      <Row label={title} itemClassName={TILE_WIDTH}>
        {videos.map((video) => (
          <TvTile
            key={video.id}
            video={video}
            mode={mode}
            views={views}
            channelName={channelNames?.[video.channel] ?? null}
            onPlay={() => play(ordered, ordered.indexOf(video))}
          />
        ))}
      </Row>
    </section>
  )
}
