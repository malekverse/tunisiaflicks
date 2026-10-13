"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Info, Pause, Play, Star } from 'lucide-react'
import { useReducedMotion } from 'framer-motion'
import { Button } from '@/src/components/ui/button'
import { useI18n } from '@/src/components/I18nProvider'
import { useRoomLight } from '@/src/components/shell/RoomLight'
import type { AnimeCard } from '@/src/lib/anime/model'
import type { TKey } from '@/src/lib/i18n'
import { cn } from '@/src/lib/utils'
import { hexToTriplet, untilText } from './anime-format'
import { useNow } from './AnimeCard'

const SLIDE_MS = 8000

/**
 * The top of /anime: what's trending, one at a time (their wide AniList banners), with the next
 * episode's countdown while it airs, Watch and Details. The room takes each one's colour.
 */
export default function AnimeHubHero({ cards }: { cards: AnimeCard[] }) {
  const { t, locale } = useI18n()
  const now = useNow()
  const reduced = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const card = cards[index] ?? cards[0]
  useRoomLight(hexToTriplet(card?.color))

  useEffect(() => {
    if (paused || reduced || cards.length < 2) return
    const timer = window.setTimeout(() => setIndex((value) => (value + 1) % cards.length), SLIDE_MS)
    return () => window.clearTimeout(timer)
  }, [index, paused, reduced, cards.length])

  if (!card) return null
  const meta = [
    card.format && t(`anime.format.${card.format}` as TKey),
    card.year ? String(card.year) : null,
    card.studio,
  ].filter(Boolean) as string[]

  return (
    <section aria-roledescription="carousel" aria-label={t('anime.row.trending')} className="relative isolate w-full">
      <h1 className="sr-only">{t('anime.title')}</h1>
      <div className="relative h-[min(78svh,760px)] min-h-[440px] w-full overflow-hidden">
        {cards.map((item, i) => (
          <div key={item.id} aria-hidden={i !== index} className={cn('absolute inset-0 transition-opacity duration-1000 ease-out', i === index ? 'opacity-100' : 'opacity-0')}>
            {(item.banner ?? item.cover) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.banner ?? item.cover!}
                alt=""
                fetchPriority={i === 0 ? 'high' : 'low'}
                className={cn('absolute inset-0 h-full w-full object-cover', i === index && !reduced && 'animate-ken-burns', !item.banner && 'scale-110 blur-xl')}
              />
            )}
          </div>
        ))}
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-[75%] bg-gradient-to-t from-black via-black/70 to-transparent" />
        <div aria-hidden className="absolute inset-y-0 start-0 hidden w-[70%] bg-gradient-to-r from-black/85 via-black/40 to-transparent md:block rtl:bg-gradient-to-l" />
        <div aria-hidden className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent" />
      </div>

      <div className="page-x absolute inset-x-0 bottom-0 pb-[clamp(28px,6vh,72px)]">
        <div key={card.id} className="max-w-[min(680px,90vw)]">
          <p className="mb-3 animate-focus-in text-[13px] font-semibold uppercase tracking-[0.14em] text-white/60">#{index + 1} {t('anime.row.trending')}</p>
          <p dir="auto" className="animate-focus-in text-balance font-display text-[clamp(34px,5.4vw,76px)] font-extrabold leading-[0.95] text-white">{card.title}</p>
          <p className="mt-4 flex animate-focus-in flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-white/80 [animation-delay:80ms]">
            {card.score !== null && (
              <span className="inline-flex items-center gap-1 font-semibold text-white"><Star aria-hidden className="h-4 w-4 fill-star text-star" />{card.score.toFixed(1)}</span>
            )}
            {meta.map((item) => <span key={item}>{item}</span>)}
            {card.genres.slice(0, 3).length > 0 && <span className="text-white/60">{card.genres.slice(0, 3).map((genre) => t(`anime.genre.${genre}` as TKey)).join(' / ')}</span>}
          </p>
          {card.next && now !== null && card.next.airingAt > now && (
            <p className="mt-3 inline-flex animate-focus-in items-center gap-2 rounded-full bg-white/[0.08] px-3.5 py-1.5 text-[13px] font-medium text-white ring-1 ring-inset ring-white/10 backdrop-blur-md [animation-delay:110ms]">
              <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              {t('anime.nextEpLong', { episode: card.next.episode, time: untilText(card.next.airingAt - now, locale) })}
            </p>
          )}
          {card.description && (
            <p dir="auto" className="mt-3 line-clamp-3 max-w-[62ch] animate-focus-in text-[15px] leading-relaxed text-white/70 [animation-delay:140ms]">{card.description}</p>
          )}
          <div className="mt-6 flex animate-focus-in flex-wrap gap-3 [animation-delay:180ms]">
            <Button asChild size="lg" className="px-8">
              <Link href={`/anime/${card.id}#streamSection`}><Play aria-hidden className="h-5 w-5 fill-current rtl:-scale-x-100" />{t('anime.watch')}</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href={`/anime/${card.id}`}><Info aria-hidden className="h-5 w-5" />{t('anime.details')}</Link>
            </Button>
          </div>
        </div>

        {cards.length > 1 && (
          <div className="mt-8 flex items-center gap-2">
            {cards.map((item, i) => (
              <button
                key={item.id}
                type="button"
                aria-label={t('billboard.show', { title: item.title })}
                aria-current={i === index ? 'true' : undefined}
                onClick={() => setIndex(i)}
                className="group/dot py-2 outline-none"
              >
                <span className={cn('block h-1 rounded-full transition-all duration-500 group-focus-visible/dot:ring-2 group-focus-visible/dot:ring-red-500', i === index ? 'w-10 bg-white' : 'w-5 bg-white/30 group-hover/dot:bg-white/60')} />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPaused((value) => !value)}
              aria-label={paused ? t('billboard.play') : t('clips.pause')}
              className="pressable glass ms-2 grid h-9 w-9 place-items-center rounded-full text-white"
            >
              {paused ? <Play aria-hidden className="ms-0.5 h-3.5 w-3.5 fill-current" /> : <Pause aria-hidden className="h-3.5 w-3.5 fill-current" />}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
