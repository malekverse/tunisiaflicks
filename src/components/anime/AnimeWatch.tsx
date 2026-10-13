"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Lock } from 'lucide-react'
import { m } from 'framer-motion'
import StreamSection from '@/src/components/detail/StreamSection'
import { Row } from '@/src/components/rows/Row'
import { useI18n } from '@/src/components/I18nProvider'
import { animeSources, type AnimeCard } from '@/src/lib/anime/model'
import { formatDate } from '@/src/lib/i18n/format'
import { spring } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import { useAnimeProgress } from './use-anime-progress'

const RANGE = 100
/** Watching this long (visible) ticks the episode as watched. */
const WATCHED_AFTER_S = 120

type EpisodeTitle = { title: string, thumbnail: string | null }

/** "Episode 3 - The Hero's Party" → {3: {name, thumbnail}} (AniList's official-stream episode list). */
function titledEpisodes(list: EpisodeTitle[]): Map<number, { name: string, thumbnail: string | null }> {
  const map = new Map<number, { name: string, thumbnail: string | null }>()
  for (const item of list) {
    const match = /^Episode\s+(\d+)\s*[-–:]\s*(.+)$/i.exec(item.title.trim())
    if (match) map.set(Number(match[1]), { name: match[2].trim(), thumbnail: item.thumbnail })
  }
  return map
}

/**
 * A title's player: the episode picker (ranges of 100 for long series, thumbnails when AniList has
 * the official episode list), sub or dub, the players for that episode (lib/anime/model), the next
 * episode, and progress on this device. The episode is in the address (?ep=5), so it can be shared.
 */
export default function AnimeWatch({ card, aired, episodeTitles, initialEpisode }: {
  card: AnimeCard
  aired: number
  episodeTitles: EpisodeTitle[]
  /** From the address (?ep=); otherwise the episode they were on, else the first. */
  initialEpisode: number | null
}) {
  const { t, locale } = useI18n()
  const { progress, ready, open, markWatched } = useAnimeProgress(card, aired)
  const clamp = useCallback((episode: number) => Math.min(Math.max(1, Math.floor(episode)), Math.max(1, aired)), [aired])
  const [episode, setEpisode] = useState<number | null>(initialEpisode ? clamp(initialEpisode) : null)
  const [dub, setDub] = useState(false)
  const restored = useRef(false)

  // Once the device's progress is read: their episode (unless the address chose one) and audio.
  useEffect(() => {
    if (!ready || restored.current) return
    restored.current = true
    if (episode === null) setEpisode(clamp(progress?.episode ?? 1))
    if (progress) setDub(progress.dub)
  }, [ready, progress, episode, clamp])

  const current = aired > 0 ? episode ?? 1 : null
  const services = useMemo(() => (current ? animeSources(card, current, dub) : []), [card, current, dub])

  // Opening an episode moves their place on; watching it a while ticks it.
  useEffect(() => {
    if (ready && restored.current && current) open(current, dub)
  }, [ready, current, dub, open])
  useEffect(() => {
    if (!current) return
    let seconds = 0
    const timer = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      seconds += 10
      if (seconds >= WATCHED_AFTER_S) { markWatched(current); window.clearInterval(timer) }
    }, 10_000)
    return () => window.clearInterval(timer)
  }, [current, dub, markWatched])

  const pick = (next: number, scroll = true) => {
    const value = clamp(next)
    setEpisode(value)
    const url = new URL(window.location.href)
    url.searchParams.set('ep', String(value))
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)
    if (scroll) document.getElementById('streamSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const total = Math.max(aired, card.episodes ?? 0, card.next?.episode ?? 0)
  const watched = new Set(progress?.watched ?? [])
  const titled = useMemo(() => titledEpisodes(episodeTitles), [episodeTitles])
  const movie = card.format === 'MOVIE' && total <= 1

  const firstDate = card.next && aired === 0 ? formatDate(card.next.airingAt * 1000, locale, { day: 'numeric', month: 'long', year: 'numeric' }) : null

  return (
    <div className="space-y-6">
      <StreamSection
        services={services}
        enabled={!!current}
        placeholder={{
          title: t('anime.notOut.title'),
          description: firstDate ? t('anime.notOut.text', { date: firstDate }) : t('anime.notOut.textNoDate'),
        }}
        onNext={current && current < aired ? () => pick(current + 1) : undefined}
        nextLabel={current && current < aired ? t('anime.nextEpisodeButton', { episode: current + 1 }) : undefined}
      />

      {!movie && total > 0 && (
        <EpisodePicker
          total={total}
          aired={aired}
          current={current}
          watched={watched}
          titled={titled}
          dub={dub}
          onDub={setDub}
          onPick={pick}
        />
      )}
      {movie && aired > 0 && (
        <div className="page-x"><div className="mx-auto max-w-[1400px]"><AudioSwitch dub={dub} onDub={setDub} /></div></div>
      )}
    </div>
  )
}

function AudioSwitch({ dub, onDub }: { dub: boolean, onDub: (dub: boolean) => void }) {
  const { t } = useI18n()
  return (
    <div role="radiogroup" aria-label={t('anime.audio')} className="inline-flex shrink-0 gap-1 rounded-full bg-white/[0.06] p-1">
      {[false, true].map((value) => (
        <button
          key={String(value)}
          type="button"
          role="radio"
          aria-checked={dub === value}
          onClick={() => onDub(value)}
          className={cn('relative h-8 rounded-full px-4 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-red-500', dub === value ? 'text-black' : 'text-white/70 hover:text-white')}
        >
          {dub === value && <m.span layoutId="anime-audio" transition={spring.snappy} aria-hidden className="absolute inset-0 rounded-full bg-white" />}
          <span className="relative">{t(value ? 'anime.dub' : 'anime.sub')}</span>
        </button>
      ))}
    </div>
  )
}

function EpisodePicker({ total, aired, current, watched, titled, dub, onDub, onPick }: {
  total: number
  aired: number
  current: number | null
  watched: Set<number>
  titled: Map<number, { name: string, thumbnail: string | null }>
  dub: boolean
  onDub: (dub: boolean) => void
  onPick: (episode: number) => void
}) {
  const { t } = useI18n()
  const ranges = Math.ceil(total / RANGE)
  const [range, setRange] = useState(() => Math.floor(((current ?? 1) - 1) / RANGE))
  useEffect(() => { if (current) setRange(Math.floor((current - 1) / RANGE)) }, [current])
  const from = range * RANGE + 1
  const to = Math.min(total, from + RANGE - 1)
  const numbers = Array.from({ length: to - from + 1 }, (_, index) => from + index)
  // Thumbnails when AniList knows most of this range's episodes (the official stream's list).
  const outInRange = Math.max(0, Math.min(aired, to) - from + 1)
  const visual = outInRange > 0 && numbers.filter((n) => n <= aired && titled.get(n)?.thumbnail).length >= outInRange * 0.6

  return (
    <section aria-label={t('anime.episodes')} className="space-y-4">
      <div className="page-x">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-[21px] font-bold text-white sm:text-[24px]">
            {t('anime.episodes')} <span className="ms-1 text-[15px] font-medium text-white/45">{aired < total ? `${aired}/${total}` : total}</span>
          </h2>
          <AudioSwitch dub={dub} onDub={onDub} />
        </div>
        {ranges > 1 && (
          <div className="no-scrollbar mx-auto mt-3 flex max-w-[1400px] gap-1.5 overflow-x-auto">
            {Array.from({ length: ranges }, (_, index) => {
              const start = index * RANGE + 1
              const end = Math.min(total, start + RANGE - 1)
              return (
                <button
                  key={index}
                  type="button"
                  aria-pressed={range === index}
                  onClick={() => setRange(index)}
                  className={cn('h-8 shrink-0 rounded-full px-3.5 text-[12.5px] font-medium tabular-nums outline-none ring-1 ring-inset transition-colors focus-visible:ring-2 focus-visible:ring-red-500', range === index ? 'bg-white text-black ring-white' : 'text-white/65 ring-white/12 hover:text-white')}
                >
                  {start}–{end}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {visual ? (
        <Row itemClassName="w-[62vw] max-w-[280px] sm:w-[260px]" label={t('anime.episodes')}>
          {numbers.map((n) => {
            const info = titled.get(n)
            const out = n <= aired
            return (
              <button
                key={n}
                type="button"
                disabled={!out}
                onClick={() => onPick(n)}
                aria-current={n === current ? 'true' : undefined}
                className="group/ep block w-full text-start outline-none disabled:cursor-not-allowed"
              >
                <span className={cn('relative block aspect-video overflow-hidden rounded-[12px] bg-white/[0.05] ring-1 ring-inset transition-[box-shadow,transform] duration-300 group-hover/ep:-translate-y-0.5 group-focus-visible/ep:ring-2 group-focus-visible/ep:ring-red-500', n === current ? 'ring-2 ring-white' : 'ring-white/[0.08]')}>
                  {info?.thumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={info.thumbnail} alt="" loading="lazy" decoding="async" className={cn('absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover/ep:scale-[1.04]', !out && 'opacity-30 grayscale')} />
                  )}
                  <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                  <span className="glass absolute start-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white">{t('anime.ep', { episode: n })}</span>
                  {watched.has(n) && n !== current && <span className="absolute end-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-black"><Check aria-label={t('anime.watched')} className="h-3.5 w-3.5" strokeWidth={3} /></span>}
                  {n === current && <span className="absolute bottom-2 start-2 rounded-full bg-red-600 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-white">{t('anime.nowPlaying')}</span>}
                  {!out && <Lock aria-label={t('anime.notAired')} className="absolute end-2 top-2 h-4 w-4 text-white/70" />}
                </span>
                <span dir="auto" className="mt-2 line-clamp-2 block px-0.5 text-[13px] leading-snug text-white/80 group-hover/ep:text-white">{info?.name ?? t('anime.episode', { episode: n })}</span>
              </button>
            )
          })}
        </Row>
      ) : (
        <div className="page-x">
          <div className="mx-auto grid max-w-[1400px] grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-2">
            {numbers.map((n) => {
              const out = n <= aired
              const isCurrent = n === current
              const label = titled.get(n)?.name
              return (
                <button
                  key={n}
                  type="button"
                  disabled={!out}
                  onClick={() => onPick(n)}
                  aria-current={isCurrent ? 'true' : undefined}
                  title={out ? (label ? `${t('anime.episode', { episode: n })}: ${label}` : t('anime.episode', { episode: n })) : t('anime.notAired')}
                  className={cn(
                    'relative h-11 rounded-[10px] text-[14px] font-semibold tabular-nums outline-none ring-1 ring-inset transition-colors focus-visible:ring-2 focus-visible:ring-red-500',
                    isCurrent ? 'bg-white text-black ring-white'
                      : !out ? 'cursor-not-allowed text-white/25 ring-white/[0.06]'
                        : watched.has(n) ? 'bg-white/[0.04] text-white/45 ring-white/[0.08] hover:text-white'
                          : 'bg-white/[0.07] text-white ring-white/[0.1] hover:bg-white/[0.14]',
                  )}
                >
                  {n}
                  {watched.has(n) && !isCurrent && <span aria-hidden className="absolute end-1 top-1 h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
