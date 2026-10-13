"use client"
import { useEffect, useState } from 'react'
import PosterCard from '@/src/components/PosterCard'
import { useI18n } from '@/src/components/I18nProvider'
import type { AnimeCard as Card } from '@/src/lib/anime/model'
import type { TKey } from '@/src/lib/i18n'
import { untilText } from './anime-format'

/** Seconds since 1970, ticking every `everyMs`; null until mounted (the server's clock isn't the viewer's). */
export function useNow(everyMs = 30_000): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Math.floor(Date.now() / 1000))
    const timer = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), everyMs)
    return () => window.clearInterval(timer)
  }, [everyMs])
  return now
}

/**
 * An anime as a poster, behaving like a movie's (hover preview with the trailer, long press,
 * right-click menu): cover, title, year and score under it, and on the cover what fans look for
 * first: the next episode's countdown while it airs, else the format when it isn't a series.
 * `badge` replaces that (Continue watching shows the episode you're on).
 */
export default function AnimeCard({ card, badge, priority, className }: { card: Card, badge?: string, priority?: boolean, className?: string }) {
  const { t, locale } = useI18n()
  const now = useNow()
  let label = badge
  if (!label && card.next) {
    label = now !== null && card.next.airingAt > now
      ? t('anime.nextEp', { episode: card.next.episode, time: untilText(card.next.airingAt - now, locale) })
      : t('anime.ep', { episode: card.next.episode })
  } else if (!label && card.format && card.format !== 'TV') {
    label = t(`anime.format.${card.format}` as TKey)
  }
  return (
    <PosterCard
      // Like a movie's card: the hover preview (with the trailer), the long-press sheet and the
      // right-click menu, saving to the account's favorites and "watch later".
      id={String(card.id)}
      mediaType="anime"
      posterImg={card.cover}
      externalImg
      backdropImg={card.banner}
      overview={card.description ?? undefined}
      peekExtra={{
        trailer: card.trailer,
        genres: card.genres.slice(0, 3).map((genre) => t(`anime.genre.${genre}` as TKey)),
        format: card.format ? t(`anime.format.${card.format}` as TKey) : undefined,
      }}
      title={card.title}
      voteAverage={card.score ?? undefined}
      releaseDate={card.year ? String(card.year) : null}
      link={`/anime/${card.id}`}
      priority={priority}
      className={className}
      overlay={label ? (
        <span className="glass absolute start-2 top-2 max-w-[calc(100%-1rem)] truncate rounded-full px-2 py-0.5 text-[10.5px] font-semibold text-white/95">
          {label}
        </span>
      ) : null}
    />
  )
}
