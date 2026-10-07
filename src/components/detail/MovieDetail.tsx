"use client"
import React, { useEffect, useMemo, useRef } from 'react'
import MediaHero from '@/src/components/detail/MediaHero'
import StreamSection from '@/src/components/detail/StreamSection'
import SectionNav from '@/src/components/detail/SectionNav'
import { CastRow, DetailsGrid } from '@/src/components/detail/DetailSections'
import { PosterSlider } from '@/src/components/Sliders'
import DownloadDialog from '@/src/components/detail/DownloadDialog'
import { useRoomLight } from '@/src/components/shell/RoomLight'
import { useMarkWatched } from '@/src/hooks/use-media-lists'
import { ambientStyle, useAmbientColor } from '@/src/hooks/use-ambient-color'
import { getStreamProviders } from '@/src/lib/stream-providers'
import { useT } from '@/src/components/I18nProvider'

/** A movie page: the hero, then the player, similar titles, the cast and the facts. */
export default function MovieDetail({ id, data, similar }: { id: string, data: any, similar: any[] }) {
  const t = useT()
  const ambient = useAmbientColor(data.poster_path)
  useRoomLight(ambient)
  const markWatched = useMarkWatched({ id, title: data.title, poster_path: data.poster_path, media_type: 'movie' })

  const streamServices = getStreamProviders('movie', id)
  const imdbId: string | undefined = data.imdb_id || data.external_ids?.imdb_id || undefined
  const cast: any[] = data.credits?.cast ?? []

  const sections = useMemo(() => [
    { id: 'streamSection', label: t('detail.watch') },
    ...(similar.length ? [{ id: 'similar', label: t('detail.moreLikeThis') }] : []),
    ...(cast.length ? [{ id: 'cast', label: t('detail.cast') }] : []),
    { id: 'details', label: t('detail.details') },
  ], [t, similar.length, cast.length])

  // Arriving straight at the player ("Play" on the home page) counts as starting to watch.
  // (markWatched only succeeds once the session has loaded, hence the retry on its change.)
  const marked = useRef<string | null>(null)
  useEffect(() => {
    if (marked.current !== id && window.location.hash === '#streamSection' && markWatched()) marked.current = id
  }, [id, markWatched])

  const play = () => {
    markWatched()
    document.getElementById('streamSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="w-full min-w-0 pb-6" {...ambientStyle(ambient)}>
      <MediaHero kind="movie" data={data} playLabel={t('billboard.play')} onPlay={play} />
      <SectionNav sections={sections} />
      <div className="space-y-16 pt-10">
        <StreamSection
          services={streamServices}
          downloadSlot={imdbId ? <DownloadDialog type="movie" imdbId={imdbId} title={data.title} /> : undefined}
        />
        {similar.length > 0 && (
          <div id="similar" className="scroll-mt-[calc(var(--topbar)+72px)]">
            <PosterSlider title={t('detail.moreLikeThis')} items={similar} kind="movie" />
          </div>
        )}
        <CastRow id="cast" cast={cast} />
        <DetailsGrid id="details" kind="movie" data={data} />
      </div>
    </div>
  )
}
