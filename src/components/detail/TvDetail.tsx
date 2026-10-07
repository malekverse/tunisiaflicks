"use client"
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MediaHero from '@/src/components/detail/MediaHero'
import StreamSection from '@/src/components/detail/StreamSection'
import { PosterSlider } from '@/src/components/Sliders'
import { useMediaLists } from '@/src/hooks/use-media-lists'
import { toast } from '@/src/hooks/use-toast'
import DownloadDialog from '@/src/components/detail/DownloadDialog'
import { getSeasonDetails } from '@/src/app/tv/[id]/actions'
import { getStreamProviders } from '@/src/lib/stream-providers'
import { cn } from '@/src/lib/utils'
import { useT } from '@/src/components/I18nProvider'

type Season = { id: number, season_number: number, name: string, poster_path: string | null, episode_count: number }
type Episode = { id: number, name: string, season_number: number, episode_number: number, still_path: string | null, overview: string }

export default function TvDetail({ id, data, similar, resume }: {
  id: string
  data: any
  similar: any[]
  /** Episode to reopen (from "Continue Watching" links: /tv/:id?s=&e=). */
  resume?: { season: number, episode: number }
}) {
  const t = useT()
  const lists = useMediaLists({ id, title: data.name, poster_path: data.poster_path, media_type: 'tv' })

  const seasons: Season[] = useMemo(() => data.seasons ?? [], [data.seasons])
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [seasonLoading, setSeasonLoading] = useState(false)
  const [episode, setEpisode] = useState<{ season: number, episode: number } | null>(null)
  const requestRef = useRef(0)

  const loadSeason = useCallback(async (seasonNumber: number, announce = true) => {
    // Only the latest click wins if the user taps through seasons quickly.
    const request = ++requestRef.current
    setSeasonLoading(true)
    try {
      const season = await getSeasonDetails(id, seasonNumber)
      if (request !== requestRef.current) return
      setSelectedSeason(seasonNumber)
      setEpisodes(season.episodes ?? [])
      // The season list carries the (possibly translated) season names.
      const name = seasons.find((item) => item.season_number === seasonNumber)?.name ?? season.name
      if (announce) toast({ title: t('tv.seasonSelected'), description: t('tv.nowViewing', { season: name }), duration: 3000 })
    } catch (error) {
      if (request !== requestRef.current) return
      console.error("Error fetching season:", error)
      toast({ title: t('common.error'), description: t('tv.seasonFailed'), variant: "destructive", duration: 3000 })
    } finally {
      if (request === requestRef.current) setSeasonLoading(false)
    }
  }, [id, seasons, t])

  // Open the resumed season (from a "Continue Watching" link) or else the first real season
  // (skipping "Specials"), so there are episodes to pick right away.
  useEffect(() => {
    const resumable = resume && seasons.some((season) => season.season_number === resume.season)
    const start = resumable ? resume.season : (seasons.find((season) => season.season_number > 0) ?? seasons[0])?.season_number
    if (start === undefined) return

    loadSeason(start, false).then(() => {
      if (!resumable) return
      setEpisode({ season: resume.season, episode: resume.episode })
      toast({
        title: t('tv.welcomeBack'),
        description: t('tv.resuming', { episode: t('common.seasonEpisode', { season: resume.season, episode: resume.episode }) }),
        duration: 3000,
      })
      // Let the enabled player render first. setTimeout (not requestAnimationFrame, which stalls
      // in background tabs); jump instantly when hidden, since a smooth scroll can't animate there.
      setTimeout(() => {
        document.getElementById('streamSection')?.scrollIntoView({
          behavior: document.visibilityState === 'visible' ? 'smooth' : 'instant',
        })
      }, 150)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const pickEpisode = (item: Episode) => {
    setEpisode({ season: item.season_number, episode: item.episode_number })
    lists.markWatched({ season: item.season_number, episode: item.episode_number })
    toast({
      title: t('tv.episodeSelected'),
      description: t('tv.nowWatching', {
        episode: t('common.seasonEpisode', { season: item.season_number, episode: item.episode_number }),
        name: item.name,
      }),
      duration: 3000,
    })
    document.getElementById('streamSection')?.scrollIntoView({ behavior: 'smooth' })
  }

  const streamServices = getStreamProviders('tv', id, episode?.season, episode?.episode)
  const imdbId: string | undefined = data.external_ids?.imdb_id || undefined

  return (
    <div className="w-full min-w-0 space-y-8 pb-8 -mt-4">
      <MediaHero
        kind="tv"
        data={data}
        isFavorite={lists.isFavorite}
        isSaved={lists.isSaved}
        onToggleFavorite={lists.toggleFavorite}
        onToggleSaved={lists.toggleSaved}
        onWatch={() => lists.markWatched()}
      />

      <div className="px-4 sm:px-14 max-w-[1800px] mx-auto w-full space-y-8">
        {seasons.length > 0 && (
          <section aria-label={t('tv.seasons')}>
            <h2 className="text-2xl sm:text-3xl font-semibold mb-3">{t('tv.seasons')}</h2>
            <div className="flex gap-3 overflow-x-auto pb-3 no-scrollbar">
              {seasons.map((season) => (
                <button
                  key={season.id}
                  type="button"
                  onClick={() => loadSeason(season.season_number)}
                  aria-pressed={selectedSeason === season.season_number}
                  className={cn(
                    "shrink-0 w-[110px] sm:w-[140px] text-start rounded-xl transition-transform duration-200 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500",
                    selectedSeason === season.season_number && "ring-2 ring-red-500"
                  )}
                >
                  <div className="aspect-[2/3] rounded-xl overflow-hidden bg-zinc-800">
                    {season.poster_path && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`https://image.tmdb.org/t/p/w342${season.poster_path}`} alt={season.name} loading="lazy" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <p className="mt-1 px-1 text-sm font-semibold truncate">{season.name}</p>
                  <p className="px-1 text-xs text-gray-500 dark:text-gray-400">{t('tv.episodeCount', { count: season.episode_count })}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        {(episodes.length > 0 || seasonLoading) && (
          <section id="episodesSection" aria-label={t('tv.episodes')} className="scroll-mt-20">
            <h2 className="text-2xl sm:text-3xl font-semibold mb-3">
              {t('tv.episodes')}{selectedSeason !== null && `: ${seasons.find((season) => season.season_number === selectedSeason)?.name ?? ''}`}
            </h2>
            <div className={cn("grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4 transition-opacity", seasonLoading && "opacity-50")}>
              {episodes.map((item) => {
                const isSelected = episode?.season === item.season_number && episode?.episode === item.episode_number
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.overview}
                    onClick={() => pickEpisode(item)}
                    className={cn(
                      "text-start rounded-md transition-transform duration-200 hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500",
                      isSelected && "ring-2 ring-red-500 scale-[1.03]"
                    )}
                  >
                    <div className="aspect-video rounded-md overflow-hidden bg-zinc-800">
                      {item.still_path && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`https://image.tmdb.org/t/p/w300${item.still_path}`} alt="" loading="lazy" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <p className="mt-1 px-1 font-semibold text-sm">{t('tv.episodeTitle', { number: item.episode_number, name: item.name })}</p>
                  </button>
                )
              })}
            </div>
          </section>
        )}
      </div>

      <StreamSection
        services={streamServices}
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
        enabled={episode !== null}
        placeholder={{ title: t('tv.placeholderTitle'), description: t('tv.placeholderDesc') }}
      />

      <div className="px-4 sm:px-14 max-w-[1800px] mx-auto w-full">
        <PosterSlider title={t('common.recommended')} items={similar} kind="tv" />
      </div>
    </div>
  )
}
