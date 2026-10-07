"use client"
import React from 'react'
import { Play } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select'
import { cn } from '@/src/lib/utils'
import { useI18n } from '@/src/components/I18nProvider'

export type Season = { id: number, season_number: number, name: string, poster_path: string | null, episode_count: number }
export type Episode = {
    id: number, name: string, season_number: number, episode_number: number, still_path: string | null,
    overview: string, runtime?: number | null, air_date?: string | null,
}

/**
 * A season picker and that season's episodes: wide stills with the number, title, length and a
 * two-line synopsis. The episode playing is marked; episodes that haven't aired say when they will.
 */
export default function EpisodeBrowser({ id, seasons, selectedSeason, episodes, loading, current, onSeason, onEpisode }: {
    id: string
    seasons: Season[]
    selectedSeason: number | null
    episodes: Episode[]
    loading: boolean
    current: { season: number, episode: number } | null
    onSeason: (season: number) => void
    onEpisode: (episode: Episode) => void
}) {
    const { t, dateLocale } = useI18n()
    const today = new Date().toISOString().slice(0, 10)
    const season = seasons.find((item) => item.season_number === selectedSeason)

    return (
        <section id={id} aria-label={t('tv.episodes')} className="page-x scroll-mt-[calc(var(--topbar)+72px)]">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-[21px] font-bold sm:text-[26px]">{t('tv.episodes')}</h2>
                {seasons.length > 0 && (
                    <Select value={selectedSeason !== null ? String(selectedSeason) : undefined} onValueChange={(value) => onSeason(Number(value))}>
                        <SelectTrigger aria-label={t('detail.season')} className="h-11 w-auto min-w-[180px] gap-3 rounded-full">
                            <SelectValue placeholder={t('detail.season')} />
                        </SelectTrigger>
                        <SelectContent>
                            {seasons.map((item) => (
                                <SelectItem key={item.id} value={String(item.season_number)}>
                                    <span className="flex items-baseline gap-2">
                                        <span>{item.name}</span>
                                        <span className="text-xs text-white/45">{t('tv.episodeCount', { count: item.episode_count })}</span>
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>

            {season && season.episode_count > 0 && episodes.length === 0 && loading ? (
                <div className="grid gap-x-5 gap-y-7 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {Array.from({ length: Math.min(season.episode_count, 8) }).map((_, index) => (
                        <div key={index}>
                            <div className="tf-shimmer relative aspect-video rounded-tile" />
                            <div className="tf-shimmer relative mt-3 h-4 w-2/3 rounded-full" />
                        </div>
                    ))}
                </div>
            ) : (
                <ol className={cn('grid gap-x-5 gap-y-7 transition-opacity duration-300 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4', loading && 'opacity-40')}>
                    {episodes.map((episode) => {
                        const playing = current?.season === episode.season_number && current?.episode === episode.episode_number
                        const upcoming = !!episode.air_date && episode.air_date > today
                        return (
                            <li key={episode.id}>
                                <button
                                    type="button"
                                    onClick={() => onEpisode(episode)}
                                    aria-current={playing ? 'true' : undefined}
                                    className="group/episode flex w-full gap-3 text-start outline-none sm:block"
                                >
                                    <span className={cn(
                                        'relative block aspect-video w-[44%] shrink-0 overflow-hidden rounded-tile bg-white/[0.05] ring-1 ring-inset transition-[transform,box-shadow] duration-300 ease-out group-hover/episode:-translate-y-1 group-hover/episode:shadow-[0_18px_40px_-14px_rgb(0_0_0/0.9)] group-focus-visible/episode:ring-2 group-focus-visible/episode:ring-red-500 group-active/episode:scale-[0.98] sm:w-full',
                                        playing ? 'ring-2 ring-red-500' : 'ring-white/[0.07]',
                                    )}>
                                        {episode.still_path && (
                                            <TmdbImage kind="still" path={episode.still_path} alt="" fill sizes="(min-width: 1536px) 22vw, (min-width: 640px) 45vw, 44vw" className={cn('object-cover transition-transform duration-500 ease-out group-hover/episode:scale-[1.04]', upcoming && 'opacity-50')} />
                                        )}
                                        <span aria-hidden className="absolute inset-0 grid place-items-center bg-black/35 opacity-0 transition-opacity duration-300 group-hover/episode:opacity-100">
                                            <span className="grid h-11 w-11 place-items-center rounded-full bg-white/15 ring-1 ring-white/40 backdrop-blur-md">
                                                <Play className="ms-0.5 h-5 w-5 fill-current rtl:-scale-x-100" />
                                            </span>
                                        </span>
                                        <span className="absolute bottom-2 start-2 rounded-md bg-black/65 px-1.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                                            {t('detail.episodeShort', { number: episode.episode_number })}
                                        </span>
                                        {playing && (
                                            <span className="absolute end-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white shadow-[0_0_14px_rgb(255_36_20/0.6)]">
                                                <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                                                {t('detail.nowPlaying')}
                                            </span>
                                        )}
                                    </span>
                                    <span className="block min-w-0 flex-1 sm:mt-3">
                                        <span className="flex items-baseline justify-between gap-3">
                                            <span className={cn('line-clamp-2 text-[14.5px] font-medium leading-snug', playing ? 'text-white' : 'text-white/90')}>
                                                <bdi>{episode.name}</bdi>
                                            </span>
                                            {!!episode.runtime && <span className="shrink-0 text-[12px] text-white/45">{t('detail.minutes', { count: episode.runtime })}</span>}
                                        </span>
                                        {upcoming && episode.air_date ? (
                                            <span className="mt-1 block text-[12.5px] text-red-400">
                                                {new Date(`${episode.air_date}T12:00:00Z`).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
                                            </span>
                                        ) : episode.overview ? (
                                            <span className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-white/50">{episode.overview}</span>
                                        ) : null}
                                    </span>
                                </button>
                            </li>
                        )
                    })}
                </ol>
            )}
        </section>
    )
}
