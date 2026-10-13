"use client"
import { useState } from 'react'
import Link from 'next/link'
import { Clapperboard, Play, Star } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import ExpandableText from '@/src/components/ExpandableText'
import YouTubeDialog from '@/src/components/media/YouTubeDialog'
import { useI18n } from '@/src/components/I18nProvider'
import { useRoomLight } from '@/src/components/shell/RoomLight'
import type { AnimeCard } from '@/src/lib/anime/model'
import type { TKey } from '@/src/lib/i18n'
import { cn } from '@/src/lib/utils'
import { hexToTriplet, untilText } from './anime-format'
import { useNow } from './AnimeCard'
import { useAnimeProgress } from './use-anime-progress'

/**
 * The top of an anime's page: its banner (or the cover, blurred), the cover beside the titles
 * (the chosen one big, the others under it), score, format, status, the next episode's countdown,
 * genres, ranks, the synopsis, and Watch (or Continue EP 5) and Trailer. The room takes the
 * cover's colour.
 */
export default function AnimeDetailHero({ card, aired, ranks }: { card: AnimeCard, aired: number, ranks: string[] }) {
  const { t, locale } = useI18n()
  const now = useNow()
  const { progress } = useAnimeProgress(card, aired)
  const [trailer, setTrailer] = useState(false)
  useRoomLight(hexToTriplet(card.color))

  const watch = () => document.getElementById('streamSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const playLabel = aired === 0 ? t('anime.watch')
    : progress ? t('anime.resumeEp', { episode: Math.min(progress.episode, aired) })
      : card.format === 'MOVIE' ? t('anime.watch') : t('anime.watchEp', { episode: 1 })
  const meta = [
    card.format && t(`anime.format.${card.format}` as TKey),
    card.season && card.year ? `${t(`anime.season.${card.season}` as TKey)} ${card.year}` : card.year ? String(card.year) : null,
    card.episodes && card.format !== 'MOVIE' ? t('anime.episodesCount', { count: card.episodes }) : null,
    card.studio,
  ].filter(Boolean) as string[]
  const backdrop = card.banner ?? card.cover

  return (
    <section aria-label={card.title} className="relative isolate w-full">
      <div className="relative h-[clamp(220px,42vw,520px)] w-full overflow-hidden">
        {backdrop && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={backdrop} alt="" className={cn('absolute inset-0 h-full w-full object-cover', !card.banner && 'scale-110 blur-2xl opacity-60')} />
        )}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
        <div aria-hidden className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent" />
      </div>

      <div className="page-x relative -mt-[clamp(110px,16vw,200px)] pb-2">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:gap-9">
          {card.cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.cover}
              alt=""
              className="w-[clamp(130px,26vw,230px)] shrink-0 animate-focus-in rounded-poster shadow-[0_30px_70px_-20px_rgb(0_0_0/0.9)] ring-1 ring-white/10"
            />
          )}
          <div className="min-w-0 max-w-[760px]">
            <h1 dir="auto" className="animate-focus-in text-balance font-display text-[clamp(32px,4.6vw,64px)] font-extrabold leading-[0.98] text-white">{card.title}</h1>
            {card.altTitles.length > 0 && (
              <p dir="auto" className="mt-2 line-clamp-2 animate-focus-in text-[15px] text-white/55 [animation-delay:60ms]">{card.altTitles.join(' · ')}</p>
            )}
            <p className="mt-4 flex animate-focus-in flex-wrap items-center gap-x-3 gap-y-1.5 text-[15px] text-white/80 [animation-delay:100ms]">
              {card.score !== null && (
                <span className="inline-flex items-center gap-1 font-semibold text-white">
                  <Star aria-hidden className="h-4 w-4 fill-star text-star" />{card.score.toFixed(1)}
                </span>
              )}
              {meta.map((item) => <span key={item}>{item}</span>)}
              {card.status && (
                <span className={cn('rounded-full px-2.5 py-0.5 text-[12px] font-semibold', card.status === 'RELEASING' ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/25' : 'bg-white/[0.08] text-white/75')}>
                  {t(`anime.status.${card.status}` as TKey)}
                </span>
              )}
            </p>
            {card.next && now !== null && card.next.airingAt > now && (
              <p className="mt-3 inline-flex animate-focus-in items-center gap-2 rounded-full bg-white/[0.07] px-3.5 py-1.5 text-[13.5px] font-medium text-white ring-1 ring-inset ring-white/10 [animation-delay:140ms]">
                <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                {t('anime.nextEpLong', { episode: card.next.episode, time: untilText(card.next.airingAt - now, locale) })}
              </p>
            )}
            {card.genres.length > 0 && (
              <div className="mt-4 flex animate-focus-in flex-wrap gap-1.5 [animation-delay:160ms]">
                {card.genres.map((genre) => (
                  <Link key={genre} href={`/anime/browse?genre=${encodeURIComponent(genre)}`} className="pressable rounded-full bg-white/[0.06] px-3 py-1 text-[12.5px] text-white/75 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.12] hover:text-white">
                    {t(`anime.genre.${genre}` as TKey)}
                  </Link>
                ))}
              </div>
            )}
            {ranks.length > 0 && (
              <p className="mt-3 animate-focus-in text-[13px] text-amber-200/80 [animation-delay:180ms]">{ranks.join(' · ')}</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex animate-focus-in flex-wrap gap-3 [animation-delay:200ms]">
          <Button size="lg" onClick={watch} className="px-8">
            <Play aria-hidden className="h-5 w-5 fill-current rtl:-scale-x-100" />{playLabel}
          </Button>
          {card.trailer && (
            <Button size="lg" variant="secondary" onClick={() => setTrailer(true)}>
              <Clapperboard aria-hidden className="h-5 w-5" />{t('detail.trailer')}
            </Button>
          )}
        </div>

        {card.description && (
          <div className="mt-6 max-w-[72ch] animate-focus-in text-[15px] leading-relaxed text-white/70 [animation-delay:240ms]">
            <ExpandableText text={card.description} lines={4} threshold={360} />
          </div>
        )}
      </div>

      {card.trailer && (
        <YouTubeDialog
          open={trailer}
          onOpenChange={setTrailer}
          videos={[{ key: card.trailer, title: card.title }]}
          index={0}
          onIndexChange={() => {}}
          label={t('detail.trailer')}
        />
      )}
    </section>
  )
}
