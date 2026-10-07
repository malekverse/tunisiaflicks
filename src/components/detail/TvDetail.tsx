"use client"
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MediaHero from '@/src/components/detail/MediaHero'
import StreamSection from '@/src/components/detail/StreamSection'
import SectionNav from '@/src/components/detail/SectionNav'
import EpisodeBrowser, { type Episode, type Season } from '@/src/components/detail/EpisodeBrowser'
import { CastRow, DetailsGrid } from '@/src/components/detail/DetailSections'
import { PosterSlider } from '@/src/components/Sliders'
import DownloadDialog from '@/src/components/detail/DownloadDialog'
import { useRoomLight } from '@/src/components/shell/RoomLight'
import { useMarkWatched } from '@/src/hooks/use-media-lists'
import { ambientStyle, useAmbientColor } from '@/src/hooks/use-ambient-color'
import { toast } from '@/src/hooks/use-toast'
import { getSeasonDetails } from '@/src/app/tv/[id]/actions'
import { getStreamProviders } from '@/src/lib/stream-providers'
import { useT } from '@/src/components/I18nProvider'

type Pick = { season: number, episode: number }

const scrollToPlayer = () => {
  // Let the enabled player render first. setTimeout (not requestAnimationFrame, which stalls in
  // background tabs); jump instantly when hidden, since a smooth scroll can't animate there.
  setTimeout(() => {
    document.getElementById('streamSection')?.scrollIntoView({
      behavior: document.visibilityState === 'visible' ? 'smooth' : 'instant',
      block: 'start',
    })
  }, 120)
}

/** A show page: the hero, the player, the episodes, similar shows, the cast and the facts. */
export default function TvDetail({ id, data, similar, resume }: {
  id: string
  data: any
  similar: any[]
  /** Episode to reopen (from "Continue watching" links: /tv/:id?s=&e=). */
  resume?: Pick
}) {
  const t = useT()
  const ambient = useAmbientColor(data.poster_path)
  useRoomLight(ambient)
  const markWatched = useMarkWatched({ id, title: data.name, poster_path: data.poster_path, media_type: 'tv' })

  const seasons: Season[] = useMemo(() => data.seasons ?? [], [data.seasons])
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [seasonLoading, setSeasonLoading] = useState(false)
  const [episode, setEpisode] = useState<Pick | null>(null)
  const requestRef = useRef(0)
  const firstSeason = (seasons.find((season) => season.season_number > 0) ?? seasons[0])?.season_number

  const loadSeason = useCallback(async (seasonNumber: number): Promise<Episode[] | null> => {
    // Only the latest request wins if the viewer flips through seasons quickly.
    const request = ++requestRef.current
    setSeasonLoading(true)
    setSelectedSeason(seasonNumber)
    try {
      const season = await getSeasonDetails(id, seasonNumber)
      if (request !== requestRef.current) return null
      const list: Episode[] = season.episodes ?? []
      setEpisodes(list)
      return list
    } catch (error) {
      if (request !== requestRef.current) return null
      console.error('Error fetching season:', error)
      toast({ title: t('common.error'), description: t('tv.seasonFailed'), variant: 'destructive', duration: 3000 })
      return null
    } finally {
      if (request === requestRef.current) setSeasonLoading(false)
    }
  }, [id, t])

  // Open the resumed season (from a "Continue watching" link) or else the first real season
  // (skipping "Specials"), so there are episodes to pick right away.
  useEffect(() => {
    const resumable = resume && seasons.some((season) => season.season_number === resume.season)
    const start = resumable ? resume.season : firstSeason
    if (start === undefined) return
    loadSeason(start).then(() => {
      if (!resumable) return
      setEpisode(resume)
      markWatched(resume)
      toast({
        title: t('tv.welcomeBack'),
        description: t('tv.resuming', { episode: t('common.seasonEpisode', { season: resume.season, episode: resume.episode }) }),
        duration: 3000,
      })
      scrollToPlayer()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const pickEpisode = useCallback((item: Pick) => {
    setEpisode(item)
    markWatched(item)
    scrollToPlayer()
  }, [markWatched])

  /** Hero "Play": the episode in progress, or the very first one. */
  const playFromStart = async () => {
    if (episode) return scrollToPlayer()
    if (firstSeason === undefined) return
    const list = selectedSeason === firstSeason && episodes.length ? episodes : await loadSeason(firstSeason)
    const first = list?.[0]
    if (first) pickEpisode({ season: first.season_number, episode: first.episode_number })
  }

  // The next episode: in this season, or the first of the next season.
  const next = useMemo(() => {
    if (!episode) return null
    const index = episodes.findIndex((item) => item.season_number === episode.season && item.episode_number === episode.episode)
    if (index >= 0 && index < episodes.length - 1) return { season: episodes[index + 1].season_number, episode: episodes[index + 1].episode_number }
    const following = seasons.find((season) => season.season_number > episode.season && season.episode_count > 0)
    return following ? { season: following.season_number, episode: 1 } : null
  }, [episode, episodes, seasons])

  const playNext = async () => {
    if (!next) return
    if (next.season !== selectedSeason) await loadSeason(next.season)
    pickEpisode(next)
  }

  const code = (item: Pick) => t('common.seasonEpisode', { season: item.season, episode: item.episode })
  const playLabel = episode
    ? t('detail.playEpisode', { episode: code(episode) })
    : firstSeason !== undefined ? t('detail.playEpisode', { episode: code({ season: firstSeason, episode: 1 }) }) : t('billboard.play')

  const streamServices = getStreamProviders('tv', id, episode?.season, episode?.episode)
  const imdbId: string | undefined = data.external_ids?.imdb_id || undefined
  const cast: any[] = data.credits?.cast ?? []

  const sections = useMemo(() => [
    { id: 'streamSection', label: t('detail.watch') },
    ...(seasons.length ? [{ id: 'episodes', label: t('tv.episodes') }] : []),
    ...(similar.length ? [{ id: 'similar', label: t('detail.moreLikeThis') }] : []),
    ...(cast.length ? [{ id: 'cast', label: t('detail.cast') }] : []),
    { id: 'details', label: t('detail.details') },
  ], [t, seasons.length, similar.length, cast.length])

  return (
    <div className="w-full min-w-0 pb-6" {...ambientStyle(ambient)}>
      <MediaHero kind="tv" data={data} playLabel={playLabel} onPlay={playFromStart} />
      <SectionNav sections={sections} />
      <div className="space-y-16 pt-10">
        <StreamSection
          services={streamServices}
          enabled={episode !== null}
          backdrop={data.backdrop_path}
          placeholder={{
            title: t('detail.pickEpisode'),
            description: t('detail.pickEpisodeText'),
            action: firstSeason !== undefined ? { label: playLabel, onClick: playFromStart } : undefined,
          }}
          onNext={episode && next ? playNext : undefined}
          nextLabel={next ? `${t('detail.nextEpisode')} ${code(next)}` : undefined}
          downloadSlot={imdbId ? (
            <DownloadDialog
              type="tv"
              imdbId={imdbId}
              title={episode ? t('tv.downloadTitle', { name: data.name, season: episode.season, episode: episode.episode }) : data.name}
              season={episode?.season ?? 1}
              episode={episode?.episode ?? 1}
              disabled={!episode}
              disabledHint={t('tv.pickFirst')}
            />
          ) : undefined}
        />

        {seasons.length > 0 && (
          <EpisodeBrowser
            id="episodes"
            seasons={seasons}
            selectedSeason={selectedSeason}
            episodes={episodes}
            loading={seasonLoading}
            current={episode}
            onSeason={(season) => { loadSeason(season) }}
            onEpisode={(item) => pickEpisode({ season: item.season_number, episode: item.episode_number })}
          />
        )}

        {similar.length > 0 && (
          <div id="similar" className="scroll-mt-[calc(var(--topbar)+72px)]">
            <PosterSlider title={t('detail.moreLikeThis')} items={similar} kind="tv" />
          </div>
        )}
        <CastRow id="cast" cast={cast} />
        <DetailsGrid id="details" kind="tv" data={data} />
      </div>
    </div>
  )
}
