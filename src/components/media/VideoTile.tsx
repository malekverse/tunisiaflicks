"use client"
import { ExternalLink, Play } from 'lucide-react'
import { useT } from '@/src/components/I18nProvider'
import { youtubeThumb, youtubeWatchUrl } from '@/src/lib/youtube'
import { cn } from '@/src/lib/utils'

/**
 * One YouTube video in a row or grid: its thumbnail (through our own thumbnail route, so nothing
 * reaches Google before play), the duration at the bottom end, an optional badge at the bottom
 * start, then the title (two lines) and a meta row. Pressing it calls `onPlay` (open the
 * YouTubeDialog). A `blocked` video (its owner forbids embedding) says "Only on YouTube" and opens
 * YouTube in a new tab instead.
 */
export default function VideoTile({ videoKey, title, meta, badge, duration, onPlay, blocked = false, className }: {
  videoKey: string
  title: string
  meta?: React.ReactNode
  badge?: React.ReactNode
  duration?: string | null
  onPlay: () => void
  blocked?: boolean
  className?: string
}) {
  const t = useT()
  const mq = youtubeThumb(videoKey, 'mq')
  const hq = youtubeThumb(videoKey, 'hq')

  const body = (
    <>
      <span className="relative block aspect-video overflow-hidden rounded-tile bg-white/[0.05] ring-1 ring-inset ring-white/[0.07] transition-transform duration-150 ease-out group-active/video:scale-[0.98] group-focus-visible/video:ring-2 group-focus-visible/video:ring-red-500">
        {/* hq is 4:3 with bars: object-cover crops them away. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={hq}
          srcSet={`${mq} 320w, ${hq} 480w`}
          sizes="(min-width: 1536px) 360px, (min-width: 640px) 320px, 74vw"
          width={480}
          height={270}
          loading="lazy"
          decoding="async"
          draggable={false}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover/video:scale-[1.04]"
        />
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
        {!blocked && (
          <span aria-hidden className="absolute inset-0 grid place-items-center opacity-0 transition-opacity duration-300 ease-out group-hover/video:opacity-100 group-focus-visible/video:opacity-100">
            <span className="glass grid h-14 w-14 scale-90 place-items-center rounded-full text-white shadow-[0_10px_30px_-8px_rgb(0_0_0/0.9)] transition-transform duration-300 ease-out group-hover/video:scale-100">
              <Play className="ms-0.5 h-6 w-6 fill-current rtl:-scale-x-100" />
            </span>
          </span>
        )}
        {blocked && (
          <span className="glass absolute start-2 top-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium text-white/90">
            <ExternalLink aria-hidden className="h-3.5 w-3.5" />
            {t('video.onlyOnYouTube')}
          </span>
        )}
        {badge && <span className="absolute bottom-2 start-2 flex items-center">{badge}</span>}
        {duration && (
          <span className="absolute bottom-2 end-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[12px] font-medium tabular-nums text-white">
            {duration}
          </span>
        )}
      </span>
      <span dir="auto" className="mt-2.5 line-clamp-2 block px-0.5 text-start text-[14.5px] font-medium leading-snug text-white/90 transition-colors group-hover/video:text-white">
        <bdi>{title}</bdi>
      </span>
      {meta && <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 px-0.5 text-[12.5px] text-white/55">{meta}</span>}
    </>
  )

  const look = cn('group/video block w-full select-none text-start outline-none [-webkit-touch-callout:none]', className)

  if (blocked) {
    return (
      <a href={youtubeWatchUrl(videoKey)} target="_blank" rel="noopener noreferrer" className={look}>
        {body}
      </a>
    )
  }
  return (
    <button type="button" onClick={onPlay} className={look}>
      {body}
    </button>
  )
}
