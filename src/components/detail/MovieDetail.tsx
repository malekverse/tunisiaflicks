"use client"
import React, { useEffect, useMemo, useRef } from 'react'
import MediaHero from '@/src/components/detail/MediaHero'
import StreamSection from '@/src/components/detail/StreamSection'
import HalalReport from '@/src/components/halal/HalalReport'
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
import WatchOffers from '@/src/components/detail/WatchOffers'
import FranchiseOrder from '@/src/components/detail/FranchiseOrder'
import type { Franchise } from '@/src/lib/franchise'
import type { WatchOffers as Offers } from '@/src/lib/watch-providers'

/** What a title page knows on the server, besides the title itself (see the movie and tv pages). */
export type DetailServerProps = {
  id: string
  data: any
  /** TMDB's recommendations (Kids-safe for a Kids profile). */
  similar: any[]
  /** The stream sources' URL templates (server only: STREAM_PROVIDERS). */
  providers: ProviderTemplate[]
  kids: boolean
  /** The profile is in Halal mode: "Not halal? Report it" under the player. */
  halal?: boolean
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
  /** Where it's legally available in the viewer's country (none for Kids). */
  offers?: Offers | null
  /** A film's franchise in watch order (movies only). */
  franchise?: Franchise | null
}

/**
 * The page's chapters in their order, only those the server knows are there: Watch, Episodes,
 * Ratings, In order (a film's franchise), More like this, Extras, Cast, Details. (A soundtrack found later by the browser shows
 * in place without an entry.)
 */
export function detailSections(t: ReturnType<typeof useT>, o: { episodes?: boolean, ratings: boolean, franchise?: boolean, similar: boolean, extras: boolean, cast: boolean }): Section[] {
  return [
    { id: 'streamSection', label: t('detail.watch') },
    ...(o.episodes ? [{ id: 'episodes', label: t('tv.episodes') }] : []),
    ...(o.ratings ? [{ id: 'ratings', label: t('social.ratings.title') }] : []),
    ...(o.franchise ? [{ id: 'franchise', label: t('franchise.nav') }] : []),
    ...(o.similar ? [{ id: 'similar', label: t('detail.moreLikeThis') }] : []),
    ...(o.extras ? [{ id: 'extras', label: t('extras.title') }] : []),
    ...(o.cast ? [{ id: 'cast', label: t('detail.cast') }] : []),
    { id: 'details', label: t('detail.details') },
  ]
}

/** A movie page: the hero, the player, ratings, similar titles, extras, the cast and the facts. */
export default function MovieDetail({ id, data, similar, providers, kids, halal, signedIn, ratings, tabs, trailers, extras, soundtrack: initialSoundtrack, offers, franchise }: DetailServerProps) {
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
    franchise: !!franchise,
    similar: tabs.length > 0,
    extras: extras.length > 0 || initialSoundtrack.state === 'found',
    cast: cast.length > 0,
  }), [t, ratings, franchise, tabs.length, extras.length, initialSoundtrack.state, cast.length])

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
          title={data.title}
          runtime={data.runtime}
          downloadSlot={imdbId ? <DownloadDialog type="movie" imdbId={imdbId} title={data.title} /> : undefined}
        />
        {halal && <HalalReport kind="movie" id={id} className="-mt-12" />}
        <WatchOffers offers={offers} className="-mt-10" />
        {ratings && <RatingsBand id="ratings" media={media} />}
        {franchise && <FranchiseOrder id="franchise" franchise={franchise} currentId={id} signedIn={signedIn} />}
        {tabs.length > 0 && <MoreLikeThis kind="movie" id={id} kids={kids} closest={similar} tabs={tabs} />}
        <ExtrasSection type="movie" id={id} title={data.title ?? ''} kids={kids} groups={extras} soundtrack={soundtrack} />
        <CastRow id="cast" cast={cast} mediaType="movie" mediaId={id} signedIn={signedIn} />
        <DetailsGrid id="details" kind="movie" data={data} soundtrack={soundtrack.status} kids={kids} />
      </div>
    </div>
  )
}
