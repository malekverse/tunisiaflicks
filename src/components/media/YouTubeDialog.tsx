"use client"
import { useRef } from 'react'
import { ChevronLeft, ChevronRight, MonitorPlay } from 'lucide-react'
import { FaYoutube } from 'react-icons/fa'
import { Dialog, DialogContent, DialogTitle } from '@/src/components/ui/dialog'
import { Button } from '@/src/components/ui/button'
import { useI18n } from '@/src/components/I18nProvider'
import { htmlLang } from '@/src/lib/i18n/locales'
import { youtubeChannelLiveUrl, youtubeEmbedUrl, youtubeLiveEmbedUrl, youtubeWatchUrl } from '@/src/lib/youtube'
import { cn } from '@/src/lib/utils'

export type DialogVideo = { key: string, title: string, subtitle?: string, liveChannelId?: string, blocked?: boolean }

const NAV_BUTTON = 'pressable glass grid h-11 w-11 shrink-0 place-items-center rounded-full text-white outline-none transition-[transform,opacity,background-color] duration-150 hover:bg-white/[0.14] focus-visible:ring-2 focus-visible:ring-red-500 disabled:pointer-events-none disabled:opacity-30'

/**
 * YouTube in a dialog: one video, or a playlist you step through (trailers, a channel's videos).
 * The player is the privacy-enhanced embed and only exists while the dialog is open. Below it, the
 * title, the position, previous and next, and "Watch on YouTube" (hidden with `external={false}`,
 * for Kids). While the dialog itself has focus (not the player), the arrow keys step through,
 * mirrored in Arabic. Videos whose owner blocks embedding show a card that sends people to YouTube.
 */
export default function YouTubeDialog({ open, onOpenChange, videos, index, onIndexChange, label, external = true }: {
  open: boolean
  onOpenChange: (o: boolean) => void
  videos: DialogVideo[]
  index: number
  onIndexChange: (i: number) => void
  label: string
  external?: boolean
}) {
  const { t, dir, locale } = useI18n()
  const content = useRef<HTMLDivElement>(null)
  const count = videos.length
  const current = Math.min(Math.max(index, 0), Math.max(count - 1, 0))
  const video = videos[current] as DialogVideo | undefined
  const hl = htmlLang(locale).split('-')[0]

  const go = (step: 1 | -1) => {
    const next = current + step
    if (next >= 0 && next < count) onIndexChange(next)
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    event.preventDefault()
    // In Arabic the next video is on the left.
    const forward = (event.key === 'ArrowRight') !== (dir === 'rtl')
    go(forward ? 1 : -1)
  }

  const watchUrl = video ? (video.liveChannelId ? youtubeChannelLiveUrl(video.liveChannelId) : youtubeWatchUrl(video.key)) : ''
  const src = video ? (video.liveChannelId ? youtubeLiveEmbedUrl(video.liveChannelId, { hl }) : youtubeEmbedUrl(video.key, { autoplay: true, hl })) : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={content}
        tabIndex={-1}
        aria-describedby={undefined}
        onKeyDown={onKeyDown}
        // Focus the dialog, not the player: the arrow keys work straight away.
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          content.current?.focus()
        }}
        className="max-w-5xl gap-0 overflow-hidden border-0 p-0 outline-none"
      >
        <DialogTitle className="sr-only">{label}</DialogTitle>
        <div className="relative aspect-video w-full bg-black">
          {open && video && !video.blocked && (
            <iframe
              key={video.liveChannelId ?? video.key}
              src={src}
              title={video.title}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              // YouTube refuses to play without a referrer (error 153): never 'no-referrer' here.
              referrerPolicy="strict-origin-when-cross-origin"
              className="absolute inset-0 h-full w-full border-0"
            />
          )}
          {video?.blocked && (
            <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_center,rgb(255_255_255/0.06),transparent_70%)] p-6 text-center">
              <div className="flex flex-col items-center">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-white/[0.06] text-white/70">
                  <MonitorPlay aria-hidden className="h-6 w-6" />
                </span>
                <p className="mt-4 max-w-sm text-balance font-display text-xl font-bold text-white">{t('video.blocked')}</p>
                {external && (
                  <Button asChild size="lg" className="mt-6">
                    <a href={watchUrl} target="_blank" rel="noopener noreferrer">
                      <FaYoutube aria-hidden className="h-5 w-5" />
                      {t('video.watchOnYouTube')}
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>

        {video && (
          <div className="flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4">
            <div className="min-w-0 flex-1">
              <p dir="auto" className="line-clamp-1 text-[15px] font-semibold text-white">{video.title}</p>
              {video.subtitle && <p dir="auto" className="mt-0.5 line-clamp-1 text-[13px] text-white/60">{video.subtitle}</p>}
            </div>

            {count > 1 && (
              <div className="flex shrink-0 items-center gap-1.5">
                <button type="button" onClick={() => go(-1)} disabled={current === 0} aria-label={t('video.previous')} className={NAV_BUTTON}>
                  <ChevronLeft aria-hidden className="h-5 w-5 rtl:rotate-180" />
                </button>
                <span aria-hidden className="min-w-[4.5ch] text-center text-[13px] tabular-nums text-white/60">
                  {current + 1} / {count}
                </span>
                <span className="sr-only" aria-live="polite">{t('video.position', { current: current + 1, total: count })}</span>
                <button type="button" onClick={() => go(1)} disabled={current === count - 1} aria-label={t('video.next')} className={NAV_BUTTON}>
                  <ChevronRight aria-hidden className="h-5 w-5 rtl:rotate-180" />
                </button>
              </div>
            )}

            {external && !video.blocked && (
              <a
                href={watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('video.watchOnYouTube')}
                className={cn(
                  'pressable inline-flex h-11 shrink-0 select-none items-center gap-2 rounded-full bg-white/[0.08] text-[13.5px] font-medium text-white/85 outline-none transition-colors hover:bg-white/[0.14] hover:text-white focus-visible:ring-2 focus-visible:ring-red-500',
                  'w-11 justify-center sm:w-auto sm:px-4',
                )}
              >
                <FaYoutube aria-hidden className="h-[18px] w-[18px]" />
                <span aria-hidden className="hidden sm:inline">{t('video.watchOnYouTube')}</span>
              </a>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
