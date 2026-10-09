"use client"
import React, { useEffect, useMemo, useRef } from 'react'
import MediaHero from '@/src/components/detail/MediaHero'
import StreamSection from '@/src/components/detail/StreamSection'
import SectionNav, { type Section } from '@/src/components/detail/SectionNav'
import { CastRow, DetailsGrid } from '@/src/components/detail/DetailSections'
import MoreLikeThis, { type SimilarTab } from '@/src/components/detail/MoreLikeThis'
import ExtrasSection from '@/src/components/detail/ExtrasSection'
import RatingsBand from '@/src/components/social/RatingsBand'
import DownloadDialog from '@/src/components/detail/DownloadDialog'
import type { DialogVideo } from '@/src/components/media/YouTubeDialog'
import { useRoomLight } from '@/src/components/shell/RoomLight'
import { useMarkWatched } from '@/src/hooks/use-media-lists'
import { ambientStyle, useAmbientColor } from '@/src/hooks/use-ambient-color'
import { useSoundtrack, type SoundtrackInitial } from '@/src/hooks/use-soundtrack'
import { fillProviders } from '@/src/lib/media-assets'
import type { ExtrasGroup } from '@/src/lib/extras'
import type { ProviderTemplate } from '@/src/lib/stream-providers'
import { useT } from '@/src/components/I18nProvider'

/** What a title page knows on the server, besides the title itself (see the movie and tv pages). */
export type DetailServerProps = {
  id: string
  data: any
  /** TMDB's recommendations (Kids-safe for a Kids profile). */
  similar: any[]
  /** The stream sources' URL templates (server only: STREAM_PROVIDERS). */
  providers: ProviderTemplate[]
  kids: boolean
  signedIn: boolean
  /** Whether the ratings band shows: signed in, or there is an average to show a guest. */
  ratings: boolean
  /** "More like this" tabs ([] = no section). */
  tabs: SimilarTab[]
  /** The hero's trailer dialog, the main trailer first. */
  trailers: DialogVideo[]
  /** The Extras videos (without the main trailer). */
  extras: ExtrasGroup[]
  soundtrack: SoundtrackInitial
}

/**
 * The page's chapters in their order, only those the server knows are there: Watch, Episodes,
 * Ratings, More like this, Extras, Cast, Details. (A soundtrack found later by the browser shows
 * in place without an entry.)
 */
export function detailSections(t: ReturnType<typeof useT>, o: { episodes?: boolean, ratings: boolean, similar: boolean, extras: boolean, cast: boolean }): Section[] {
  return [
    { id: 'streamSection', label: t('detail.watch') },
    ...(o.episodes ? [{ id: 'episodes', label: t('tv.episodes') }] : []),
    ...(o.ratings ? [{ id: 'ratings', label: t('social.ratings.title') }] : []),
    ...(o.similar ? [{ id: 'similar', label: t('detail.moreLikeThis') }] : []),
    ...(o.extras ? [{ id: 'extras', label: t('extras.title') }] : []),
    ...(o.cast ? [{ id: 'cast', label: t('detail.cast') }] : []),
    { id: 'details', label: t('detail.details') },
  ]
}

/** A movie page: the hero, the player, ratings, similar titles, extras, the cast and the facts. */
export default function MovieDetail({ id, data, similar, providers, kids, signedIn, ratings, tabs, trailers, extras, soundtrack: initialSoundtrack }: DetailServerProps) {
  const t = useT()
  const ambient = useAmbientColor(data.poster_path)
  useRoomLight(ambient)
  const markWatched = useMarkWatched({ id, title: data.title, poster_path: data.poster_path, media_type: 'movie' })
  const soundtrack = useSoundtrack({ type: 'movie', id, kids, initial: initialSoundtrack })

  const streamServices = useMemo(() => fillProviders(providers, 'movie', id), [providers, id])
  const imdbId: string | undefined = data.imdb_id || data.external_ids?.imdb_id || undefined
  const cast: any[] = data.credits?.cast ?? []
  const media = useMemo(() => ({ media_type: 'movie' as const, id, title: data.title ?? '', poster_path: data.poster_path ?? null }), [id, data.title, data.poster_path])

  const sections = useMemo(() => detailSections(t, {
    ratings,
    similar: tabs.length > 0,
    extras: extras.length > 0 || initialSoundtrack.state === 'found',
    cast: cast.length > 0,
  }), [t, ratings, tabs.length, extras.length, initialSoundtrack.state, cast.length])

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
      <MediaHero kind="movie" data={data} playLabel={t('billboard.play')} onPlay={play} trailers={trailers} kids={kids} />
      <SectionNav sections={sections} />
      <div className="space-y-16 pt-10">
        <StreamSection
          services={streamServices}
          media={{ type: 'movie', id }}
          downloadSlot={imdbId ? <DownloadDialog type="movie" imdbId={imdbId} title={data.title} /> : undefined}
        />
        {ratings && <RatingsBand id="ratings" media={media} />}
        {tabs.length > 0 && <MoreLikeThis kind="movie" id={id} kids={kids} closest={similar} tabs={tabs} />}
        <ExtrasSection type="movie" id={id} title={data.title ?? ''} kids={kids} groups={extras} soundtrack={soundtrack} />
        <CastRow id="cast" cast={cast} mediaType="movie" mediaId={id} signedIn={signedIn} />
        <DetailsGrid id="details" kind="movie" data={data} soundtrack={soundtrack.status} kids={kids} />
      </div>
    </div>
  )
}
