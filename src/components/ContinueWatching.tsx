"use client"
import React, { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { FaPlay } from 'react-icons/fa6'
import { IoClose } from 'react-icons/io5'
import PosterCard from '@/src/components/PosterCard'
import { getWatchHistory, removeFromWatchHistory } from '@/src/lib/user-content'
import { toast } from '@/src/hooks/use-toast'
import type { WatchHistoryItem } from '@/src/lib/models/UserContent'

const MAX_ITEMS = 15

// Where a card takes you: TV reopens the exact episode last watched, movies reopen the title.
const resumeHref = (item: WatchHistoryItem) =>
  item.media_type === 'tv'
    ? item.season !== undefined && item.episode !== undefined
      ? `/tv/${item.id}?s=${item.season}&e=${item.episode}`
      : `/tv/${item.id}`
    : `/movie/${item.id}`

/**
 * "Continue Watching" row for signed-in users, built from their watch history (newest first).
 * Renders nothing for guests or when the history is empty, so the home page is unchanged for them.
 */
export default function ContinueWatching() {
  const { status } = useSession()
  const [items, setItems] = useState<WatchHistoryItem[]>([])

  useEffect(() => {
    if (status !== 'authenticated') {
      setItems([])
      return
    }
    let cancelled = false
    getWatchHistory().then((history: WatchHistoryItem[]) => {
      if (!cancelled) setItems(history.slice(0, MAX_ITEMS))
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
      toast({ title: "Removed", description: `${item.title} was removed from Continue Watching`, duration: 3000 })
    } catch {
      setItems(previous)
      toast({ title: "Error", description: "Couldn't remove it, please try again", variant: "destructive" })
    }
  }

  if (items.length === 0) return null

  return (
    <section aria-label="Continue Watching" className="w-full">
      <h2 className="text-2xl sm:text-3xl font-semibold mb-3">Continue Watching</h2>
      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
        {items.map((item) => (
          <div key={`${item.media_type}-${item.id}`} className="group relative shrink-0 w-[145px] md:w-[167px]">
            <PosterCard
              posterImg={item.poster_path}
              title={item.title}
              mediaType={item.media_type}
              link={resumeHref(item)}
              actions={false}
            />

            {/* Play affordance on hover (decorative; the whole card is the link). */}
            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500 text-white shadow-lg">
                <FaPlay className="ml-0.5" />
              </span>
            </div>

            {item.media_type === 'tv' && item.season !== undefined && item.episode !== undefined && (
              <span className="pointer-events-none absolute left-1.5 top-1.5 z-30 rounded-md bg-red-600 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                S{item.season} · E{item.episode}
              </span>
            )}

            <button
              type="button"
              onClick={() => remove(item)}
              aria-label={`Remove ${item.title} from Continue Watching`}
              title="Remove from Continue Watching"
              className="absolute right-1.5 top-1.5 z-30 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white transition-opacity hover:bg-red-500 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
            >
              <IoClose />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
