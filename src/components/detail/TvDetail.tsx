"use client"
import React, { useCallback, useEffect, useRef, useState } from 'react'
import MediaHero from '@/src/components/detail/MediaHero'
import StreamSection from '@/src/components/detail/StreamSection'
import { PosterSlider } from '@/src/components/Sliders'
import { useMediaLists } from '@/src/hooks/use-media-lists'
import { toast } from '@/src/hooks/use-toast'
import DownloadDialog from '@/src/components/detail/DownloadDialog'
import { getSeasonDetails } from '@/src/app/tv/[id]/actions'
import { getStreamProviders } from '@/src/lib/stream-providers'
import { cn } from '@/src/lib/utils'

type Season = { id: number, season_number: number, name: string, poster_path: string | null, episode_count: number }
type Episode = { id: number, name: string, season_number: number, episode_number: number, still_path: string | null, overview: string }

export default function TvDetail({ id, data, similar }: { id: string, data: any, similar: any[] }) {
  const lists = useMediaLists({ id, title: data.name, poster_path: data.poster_path, media_type: 'tv' })

  const seasons: Season[] = data.seasons ?? []
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
      if (announce) toast({ title: "Season Selected", description: `Now viewing ${season.name}`, duration: 3000 })
    } catch (error) {
      if (request !== requestRef.current) return
      console.error("Error fetching season:", error)
      toast({ title: "Error", description: "Failed to load season details", variant: "destructive", duration: 3000 })
    } finally {
      if (request === requestRef.current) setSeasonLoading(false)
    }
  }, [id])

  // Start with the first real season (skipping "Specials") so there are episodes to pick right away.
  useEffect(() => {
    const first = seasons.find((season) => season.season_number > 0) ?? seasons[0]
    if (first) loadSeason(first.season_number, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const pickEpisode = (item: Episode) => {
    setEpisode({ season: item.season_number, episode: item.episode_number })
    lists.markWatched()
    toast({
      title: "Episode Selected",
      description: `Now watching S${item.season_number}:E${item.episode_number} - ${item.name}`,
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
        onWatch={lists.markWatched}
      />

      <div className="px-4 sm:px-14 max-w-[1800px] mx-auto w-full space-y-8">
        {seasons.length > 0 && (
          <section aria-label="Seasons">
            <h2 className="text-2xl sm:text-3xl font-semibold mb-3">Seasons</h2>
            <div className="flex gap-3 overflow-x-auto pb-3 no-scrollbar">
              {seasons.map((season) => (
                <button
                  key={season.id}
                  type="button"
                  onClick={() => loadSeason(season.season_number)}
                  aria-pressed={selectedSeason === season.season_number}
                  className={cn(
                    "shrink-0 w-[110px] sm:w-[140px] text-left rounded-xl transition-transform duration-200 hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500",
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
                  <p className="px-1 text-xs text-gray-500 dark:text-gray-400">{season.episode_count} episodes</p>
                </button>
              ))}
            </div>
          </section>
        )}

        {(episodes.length > 0 || seasonLoading) && (
          <section id="episodesSection" aria-label="Episodes" className="scroll-mt-20">
            <h2 className="text-2xl sm:text-3xl font-semibold mb-3">
              Episodes{selectedSeason !== null && `: ${seasons.find((season) => season.season_number === selectedSeason)?.name ?? ''}`}
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
                      "text-left rounded-md transition-transform duration-200 hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500",
                      isSelected && "ring-2 ring-red-500 scale-[1.03]"
                    )}
                  >
                    <div className="aspect-video rounded-md overflow-hidden bg-zinc-800">
                      {item.still_path && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`https://image.tmdb.org/t/p/w300${item.still_path}`} alt="" loading="lazy" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <p className="mt-1 px-1 font-semibold text-sm">Episode {item.episode_number}: {item.name}</p>
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
            title={episode ? `${data.name} — S${episode.season}E${episode.episode}` : data.name}
            season={episode?.season ?? 1}
            episode={episode?.episode ?? 1}
            disabled={!episode}
            disabledHint="Please select a season and episode first"
          />
        ) : undefined}
        enabled={episode !== null}
        placeholder={{ title: "Select a Season and Episode", description: "Please select a season and episode to watch" }}
      />

      <div className="px-4 sm:px-14 max-w-[1800px] mx-auto w-full">
        <PosterSlider title="Recommended" items={similar} kind="tv" />
      </div>
    </div>
  )
}
