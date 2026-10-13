"use client"
import React, { useId, useMemo, useState } from 'react'
import { m } from 'framer-motion'
import { ExternalLink, Play } from 'lucide-react'
import { cn } from '@/src/lib/utils'
import { spring } from '@/src/lib/motion'
import type { TunisianSeason } from '@/src/lib/tunisian'
import YouTubeDialog, { type DialogVideo } from '@/src/components/media/YouTubeDialog'
import { dialogVideo, mediaThumb } from './tunisian-media'
import { useT } from '@/src/components/I18nProvider'

/**
 * A Tunisian series' seasons as a segmented control, and that season's episodes as tiles. Episodes
 * play here, in the video dialog, as the season's playlist (previous / next). An episode whose
 * page couldn't be read opens on the source site instead.
 */
export default function TunisianSeasons({ seasons, title, picture }: { seasons: TunisianSeason[], title: string, picture: string | null }) {
  const t = useT()
  const pillId = useId()
  const [active, setActive] = useState(seasons[0].season)
  const current = seasons.find((season) => season.season === active) ?? seasons[0]
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)

  // The season's playlist: the episodes with a video, in order.
  const playlist = useMemo(() => current.episodes.filter((episode) => episode.media), [current])
  const videos: DialogVideo[] = useMemo(() => playlist.map((episode) => dialogVideo(episode.media!, title, episode.label)), [playlist, title])
  const external = current.episodes.some((episode) => !episode.media)

  const play = (url: string) => {
    setIndex(Math.max(0, playlist.findIndex((episode) => episode.url === url)))
    setOpen(true)
  }

  return (
    <section aria-label={t('tv.episodes')}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-[21px] font-bold sm:text-[26px]">{t('tv.episodes')}</h2>
        {seasons.length > 1 && (
          <div role="tablist" aria-label={t('tv.seasons')} className="no-scrollbar flex max-w-full overflow-x-auto overflow-y-hidden rounded-full bg-white/[0.07] p-1">
            {seasons.map((season) => {
              const selected = season.season === current.season
              return (
                <button
                  key={season.season}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActive(season.season)}
                  className={cn('relative h-9 shrink-0 rounded-full px-4 text-[14px] font-medium outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-red-500', selected ? 'text-black' : 'text-white/70 hover:text-white')}
                >
                  {selected && <m.span layoutId={`tn-season-${pillId}`} transition={spring.snappy} aria-hidden className="absolute inset-0 rounded-full bg-white" />}
                  <span className="relative">{t('tunisian.season', { number: season.season })}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
        {current.episodes.map((episode) => {
          const thumb = mediaThumb(episode.media, picture)
          const body = (
            <>
              <span className="relative block aspect-video overflow-hidden rounded-xl bg-white/[0.06]">
                {thumb && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" loading="lazy" className={cn('h-full w-full object-cover transition-transform duration-300 group-hover:scale-105', episode.media?.type !== 'youtube' && 'opacity-60')} />
                )}
                <span className="absolute inset-0 grid place-items-center bg-gradient-to-t from-black/60 to-transparent">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-red-600 text-white shadow-lg transition-transform duration-200 group-hover:scale-110">
                    {episode.media
                      ? <Play aria-hidden className="ms-0.5 h-4 w-4 fill-current rtl:-scale-x-100" />
                      : <ExternalLink aria-hidden className="h-4 w-4" />}
                  </span>
                </span>
              </span>
              <span dir="auto" className="mt-2 block truncate px-1 text-[14px] font-medium text-white/85 group-hover:text-white">{episode.label}</span>
            </>
          )
          const className = 'group pressable block rounded-2xl p-1.5 text-start outline-none transition-colors duration-200 hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-red-500'
          return episode.media ? (
            <button key={episode.url} type="button" onClick={() => play(episode.url)} className={className}>{body}</button>
          ) : (
            <a key={episode.url} href={episode.url} target="_blank" rel="noopener noreferrer" className={className}>{body}</a>
          )
        })}
      </div>
      {external && <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-white/40"><ExternalLink aria-hidden className="h-3.5 w-3.5" />{t('tunisian.sourceNote')}</p>}

      <YouTubeDialog open={open} onOpenChange={setOpen} videos={videos} index={index} onIndexChange={setIndex} label={t('stream.player')} />
    </section>
  )
}
