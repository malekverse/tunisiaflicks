"use client"
import React from 'react'
import MediaHero from '@/src/components/detail/MediaHero'
import StreamSection from '@/src/components/detail/StreamSection'
import { PosterSlider } from '@/src/components/Sliders'
import DownloadDialog from '@/src/components/detail/DownloadDialog'
import { useMediaLists } from '@/src/hooks/use-media-lists'
import { getStreamProviders } from '@/src/lib/stream-providers'

export default function MovieDetail({ id, data, similar }: { id: string, data: any, similar: any[] }) {
  const lists = useMediaLists({ id, title: data.title, poster_path: data.poster_path, media_type: 'movie' })

  const streamServices = getStreamProviders('movie', id)
  const imdbId: string | undefined = data.imdb_id || data.external_ids?.imdb_id || undefined

  return (
    <div className="w-full min-w-0 space-y-8 pb-8 -mt-4">
      <MediaHero
        kind="movie"
        data={data}
        isFavorite={lists.isFavorite}
        isSaved={lists.isSaved}
        onToggleFavorite={lists.toggleFavorite}
        onToggleSaved={lists.toggleSaved}
        onWatch={() => lists.markWatched()}
      />
      <StreamSection
        services={streamServices}
        downloadSlot={imdbId ? <DownloadDialog type="movie" imdbId={imdbId} title={data.title} /> : undefined}
      />
      <div className="px-4 sm:px-14 max-w-[1800px] mx-auto w-full space-y-8">
        <PosterSlider title="Recommended" items={similar} kind="movie" />
      </div>
    </div>
  )
}
