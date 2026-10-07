"use client"
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Play, X } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import { Row, ROW_WIDTH, SectionHeader } from '@/src/components/rows/Row'
import { getWatchHistory, removeFromWatchHistory } from '@/src/lib/user-content'
import { getResumeArt } from '@/src/app/actions/continue'
import { toast } from '@/src/hooks/use-toast'
import type { WatchHistoryItem } from '@/src/lib/models/UserContent'
import { useT } from '@/src/components/I18nProvider'

const MAX_ITEMS = 15

// Where a card takes you: TV reopens the exact episode last watched, movies reopen the player.
const resumeHref = (item: WatchHistoryItem) =>
  item.media_type === 'tv'
    ? item.season !== undefined && item.episode !== undefined
      ? `/tv/${item.id}?s=${item.season}&e=${item.episode}`
      : `/tv/${item.id}`
    : `/movie/${item.id}#streamSection`

/**
 * "Continue watching" for signed-in users: wide tiles from their watch history (newest first),
 * reopening the episode they were on. Renders nothing for guests or an empty history.
 */
export default function ContinueWatching() {
  const { status } = useSession()
  const t = useT()
  const [items, setItems] = useState<WatchHistoryItem[]>([])
  const [art, setArt] = useState<Record<string, string | null>>({})

  useEffect(() => {
    if (status !== 'authenticated') {
      setItems([])
      return
    }
    let cancelled = false
    getWatchHistory().then((history: WatchHistoryItem[]) => {
      if (cancelled) return
      const recent = history.slice(0, MAX_ITEMS)
      setItems(recent)
      if (recent.length) getResumeArt(recent.map(({ id, media_type }) => ({ id, media_type }))).then((found) => { if (!cancelled) setArt(found) }).catch(() => {})
    })
    return () => {
      cancelled = true
    }
  }, [status])

  const remove = async (item: WatchHistoryItem) => {
    const previous = items
    setItems((current) => current.filter((entry) => entry.id !== item.id)) // optimistic
    try {
      await removeFromWatchHistory(item.id)
      toast({ title: t('home.continueRemoved'), description: t('home.continueRemovedDesc', { title: item.title }), duration: 3000 })
    } catch {
      setItems(previous)
      toast({ title: t('common.error'), description: t('home.continueRemoveFailed'), variant: "destructive" })
    }
  }

  if (items.length === 0) return null

  return (
    <section aria-label={t('home.continueWatching')}>
      <SectionHeader title={t('home.continueWatching')} />
      <Row itemClassName={ROW_WIDTH.landscape}>
        {items.map((item) => {
          const backdrop = art[`${item.media_type}:${item.id}`]
          const episode = item.media_type === 'tv' && item.season !== undefined && item.episode !== undefined
            ? t('home.continueBadge', { season: item.season, episode: item.episode })
            : null
          return (
            <div key={`${item.media_type}-${item.id}`} className="group/resume relative">
              <Link
                href={resumeHref(item)}
                aria-label={t('home.resumeTitle', { title: item.title })}
                className="block outline-none"
              >
                <div className="relative aspect-video overflow-hidden rounded-tile bg-white/[0.05] ring-1 ring-inset ring-white/[0.07] transition-[transform,box-shadow] duration-300 ease-out group-hover/resume:-translate-y-1 group-hover/resume:shadow-[0_18px_40px_-14px_rgb(0_0_0/0.9)] group-focus-visible/resume:ring-2 group-focus-visible/resume:ring-red-500 group-active/resume:scale-[0.98]">
                  {backdrop !== undefined && (
                    <TmdbImage
                      kind={backdrop ? 'backdrop' : 'poster'}
                      path={backdrop || item.poster_path}
                      alt=""
                      fill
                      sizes="(min-width: 1536px) 360px, (min-width: 640px) 320px, 74vw"
                      className="object-cover transition-transform duration-500 ease-out group-hover/resume:scale-[1.04]"
                    />
                  )}
                  <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                  {/* The play button wakes up on hover; on touch screens it's always there. */}
                  <span aria-hidden className="absolute left-1/2 top-[42%] grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white ring-1 ring-white/40 backdrop-blur-md transition-[opacity,transform] duration-300 ease-out [@media(hover:hover)]:scale-90 [@media(hover:hover)]:opacity-0 group-hover/resume:scale-100 group-hover/resume:opacity-100">
                    <Play className="ms-0.5 h-5 w-5 fill-current rtl:-scale-x-100" />
                  </span>
                  <div className="absolute inset-x-0 bottom-0 p-3.5">
                    <p className="line-clamp-1 font-display text-[18px] font-bold leading-tight text-white"><bdi>{item.title}</bdi></p>
                    <p className="mt-0.5 text-[12px] font-medium text-white/70">{episode ?? t('home.resume')}</p>
                  </div>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => remove(item)}
                aria-label={t('home.continueRemoveAria', { title: item.title })}
                title={t('home.continueRemoveTitle')}
                className="pressable absolute end-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white/85 backdrop-blur-md transition-opacity duration-200 hover:bg-black/80 hover:text-white focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 group-hover/resume:opacity-100"
              >
                <X aria-hidden className="h-4 w-4" />
              </button>
            </div>
          )
        })}
      </Row>
    </section>
  )
}
