"use client"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import YouTubeDialog, { type DialogVideo } from '@/src/components/media/YouTubeDialog'
import { useI18n } from '@/src/components/I18nProvider'
import { isArabicScript } from '@/src/lib/i18n/locales'
import { episodeLabel } from '@/src/lib/tunisian-tv/labels'
import { seriesName, type TvVideoView } from '@/src/lib/tunisian-tv/view'

type Watch = {
  /** Opens the player on `videos[index]`; previous and next step through the whole list, part by part. */
  play: (videos: TvVideoView[], index: number) => void
}

const WatchContext = createContext<Watch | null>(null)

/** The play function of the page's one player (a no-op outside a TvWatchProvider). */
export function useTvWatch(): Watch {
  return useContext(WatchContext) ?? { play: () => {} }
}

/**
 * One YouTube player per page. Tiles call play(list, index); the list becomes the dialog's
 * playlist, each broadcast's parts in order ("Part 2 of 3"). Nothing reaches YouTube before Play:
 * the dialog's player only exists while it is open, and it is the privacy-enhanced embed.
 * `initial` (from ?v=) opens on load; closing the player takes ?v= out of the address.
 */
export default function TvWatchProvider({ children, initial }: { children: React.ReactNode, initial?: TvVideoView | null }) {
  const { t, locale } = useI18n()
  const arabic = isArabicScript(locale)
  const [list, setList] = useState<DialogVideo[]>([])
  const [index, setIndex] = useState(0)
  const [open, setOpen] = useState(false)

  const toDialog = useCallback((videos: TvVideoView[]) => {
    const items: DialogVideo[] = []
    const starts: number[] = []
    for (const video of videos) {
      starts.push(items.length)
      const name = video.seriesTitle ? seriesName(video.seriesTitle, video.seriesTitleAlt, arabic) : null
      const episode = episodeLabel(t, video)
      const title = name && episode ? t('ttv.titleEpisode', { series: name, episode }) : video.title
      const total = video.parts.length
      video.parts.forEach((part, partIndex) => {
        items.push({
          key: part.id,
          title,
          subtitle: total > 1 ? t('ttv.partOf', { n: part.part ?? partIndex + 1, total }) : (video.live ? t('ttv.live') : video.subtitle ?? undefined),
          blocked: part.blocked,
          liveChannelId: video.liveChannelId ?? undefined,
        })
      })
    }
    return { items, starts }
  }, [arabic, t])

  const play = useCallback((videos: TvVideoView[], at: number) => {
    const { items, starts } = toDialog(videos)
    if (items.length === 0) return
    setList(items)
    setIndex(starts[Math.min(Math.max(at, 0), starts.length - 1)] ?? 0)
    setOpen(true)
  }, [toDialog])

  // ?v= opens that video once, when the page loads.
  const opened = useRef(false)
  useEffect(() => {
    if (opened.current || !initial) return
    opened.current = true
    play([initial], 0)
  }, [initial, play])

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next && typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (url.searchParams.has('v')) {
        url.searchParams.delete('v')
        window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
      }
    }
  }

  const value = useMemo(() => ({ play }), [play])
  return (
    <WatchContext.Provider value={value}>
      {children}
      <YouTubeDialog open={open} onOpenChange={onOpenChange} videos={list} index={index} onIndexChange={setIndex} label={t('ttv.player')} />
    </WatchContext.Provider>
  )
}
