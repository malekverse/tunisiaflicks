"use client"
// Home: "New episodes for you", the shows you're nearly caught up on that have a new episode out
// lately (My shows' "New" badge), each opening that episode. Signed-in only, and only when there is
// one; the answer is kept for 20 minutes in the tab, so browsing back home doesn't ask again.
import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Play } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import { Row, ROW_WIDTH, SectionHeader } from '@/src/components/rows/Row'
import { useT } from '@/src/components/I18nProvider'
import { getNewEpisodes } from '@/src/app/shows/actions'
import type { TrackedShow } from '@/src/lib/tracker-server'

const KEY = 'tf-new-episodes'
const FRESH_MS = 20 * 60 * 1000

export default function NewEpisodesRow() {
  const t = useT()
  const { data: session, status } = useSession()
  const userId = session?.user?.id ?? null
  const [shows, setShows] = useState<TrackedShow[]>([])

  useEffect(() => {
    if (status !== 'authenticated' || !userId) {
      setShows([])
      return
    }
    try {
      const kept = JSON.parse(sessionStorage.getItem(KEY) ?? 'null')
      if (kept && kept.user === userId && Date.now() - kept.at < FRESH_MS && Array.isArray(kept.shows)) {
        setShows(kept.shows)
        return
      }
    } catch { /* nothing kept */ }
    let cancelled = false
    getNewEpisodes()
      .then((found) => {
        if (cancelled) return
        setShows(found)
        try { sessionStorage.setItem(KEY, JSON.stringify({ user: userId, at: Date.now(), shows: found })) } catch { /* private mode */ }
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [status, userId])

  if (!shows.length) return null

  return (
    <section aria-label={t('shows.newRow')}>
      <SectionHeader title={t('shows.newRow')} href="/shows" />
      <Row itemClassName={ROW_WIDTH.landscape}>
        {shows.map((show) => {
          const next = show.progress.upNext!
          const code = t('common.seasonEpisode', { season: next.season, episode: next.episode })
          return (
            <Link
              key={show.id}
              href={`/tv/${show.id}?s=${next.season}&e=${next.episode}`}
              aria-label={t('shows.playAria', { title: show.title, episode: code })}
              className="group/new block outline-none"
            >
              <span className="relative block aspect-video overflow-hidden rounded-tile bg-white/[0.05] ring-1 ring-inset ring-white/[0.07] transition-[transform,box-shadow] duration-300 ease-out group-hover/new:-translate-y-1 group-focus-visible/new:ring-2 group-focus-visible/new:ring-red-500">
                <TmdbImage
                  kind={show.upNext?.still_path ? 'still' : 'backdrop'}
                  path={show.upNext?.still_path || show.backdrop_path}
                  name={show.title}
                  alt=""
                  fill
                  sizes="(min-width: 1536px) 360px, (min-width: 640px) 320px, 74vw"
                  className="object-cover"
                />
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                <span className="absolute start-3 top-3 rounded-full bg-red-600 px-2.5 py-1 text-[12px] font-semibold text-white">{t('shows.new')}</span>
                <span aria-hidden className="absolute left-1/2 top-[42%] grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white ring-1 ring-white/40 backdrop-blur-md transition-[opacity,transform] duration-300 [@media(hover:hover)]:scale-90 [@media(hover:hover)]:opacity-0 group-hover/new:scale-100 group-hover/new:opacity-100">
                  <Play className="ms-0.5 h-5 w-5 fill-current rtl:-scale-x-100" />
                </span>
                <span className="absolute inset-x-0 bottom-0 p-3.5">
                  <bdi dir="auto" className="line-clamp-1 text-start font-display text-[18px] font-bold leading-tight text-white">{show.title}</bdi>
                  <span className="mt-0.5 flex min-w-0 gap-2 text-[12px] font-medium text-white/70">
                    <span className="shrink-0">{code}</span>
                    {show.upNext?.name && <bdi dir="auto" className="truncate">{show.upNext.name}</bdi>}
                  </span>
                </span>
              </span>
            </Link>
          )
        })}
      </Row>
    </section>
  )
}
