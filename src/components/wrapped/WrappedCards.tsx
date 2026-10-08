"use client"
import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { m, useInView, useReducedMotion } from 'framer-motion'
import { Film, Heart, Star, Tv } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import { useI18n } from '@/src/components/I18nProvider'
import { TMDB_IMAGE_BASE } from '@/src/lib/tmdb-image'
import { EASE_OUT } from '@/src/lib/motion'
import { cn } from '@/src/lib/utils'
import type { WrappedStats } from '@/src/lib/wrapped'
import StatNumber from './StatNumber'
import { genreLabel, personaOf } from './labels'

// Phones: a story you swipe through, one card per screen (the next one peeks in). Desktop: the
// same cards laid out as one big board.
const CARD = cn(
  'relative isolate flex shrink-0 snap-start snap-always flex-col overflow-hidden rounded-[24px] bg-white/[0.04] p-6 ring-1 ring-white/[0.07]',
  'h-[var(--story-h)] w-[86%] sm:w-[58%] sm:rounded-stage sm:p-8',
  'lg:h-auto lg:min-h-[260px] lg:w-auto',
)
const LABEL = 'text-[15px] font-medium text-white/70'
const BIG = 'block font-display text-[clamp(96px,34vw,150px)] font-extrabold leading-[0.85] text-white lg:text-[clamp(72px,6.4vw,112px)]'
// Typographic cards: centred in the tall phone story, sitting at the bottom of the board's tiles.
const TYPE_CARD = 'justify-center lg:justify-end'
// Where each card's light comes from on the board (on phones it always pours in from the top).
const GLOW = {
  topEnd: 'lg:left-auto lg:-right-[40%] lg:-top-1/2 lg:w-[110%]',
  bottomStart: 'lg:-left-[40%] lg:top-auto lg:-bottom-1/2 lg:w-[110%]',
  bottomEnd: 'lg:left-auto lg:-right-[30%] lg:top-auto lg:-bottom-1/2 lg:w-[110%]',
  topStart: 'lg:-left-[30%] lg:-top-1/2 lg:w-[110%]',
}
// The picks share the last row(s) of the board, whatever subset of them exists.
const PICK_SPANS: Record<number, string> = { 1: 'lg:col-span-6', 2: 'lg:col-span-3', 3: 'lg:col-span-2', 4: 'lg:col-span-3' }

/** The colour of a poster, blurred into soft light behind a card. */
function Glow({ path, className }: { path?: string | null, className?: string }) {
  if (!path) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      aria-hidden
      alt=""
      src={`${TMDB_IMAGE_BASE}/w92${path}`}
      loading="lazy"
      decoding="async"
      className={cn('pointer-events-none absolute -left-[25%] -top-[18%] -z-10 aspect-square w-[150%] max-w-none object-cover opacity-40 blur-3xl saturate-150 lg:opacity-35', className)}
    />
  )
}

/** A tilted wall of this year's posters, behind the intro. */
function PosterWall({ posters }: { posters: string[] }) {
  if (posters.length === 0) return null
  const tiles = Array.from({ length: 24 }, (_, index) => posters[index % posters.length])
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
      <div className="absolute left-1/2 top-1/2 grid w-[170%] -translate-x-1/2 -translate-y-1/2 -rotate-[9deg] grid-cols-4 gap-2.5 opacity-60 sm:gap-3 lg:w-[130%] lg:grid-cols-6">
        {tiles.map((path, index) => (
          <div key={index} className="relative aspect-[2/3] overflow-hidden rounded-[10px] bg-white/[0.05]">
            <TmdbImage kind="poster" path={path} fill sizes="(min-width: 1024px) 14vw, 30vw" alt="" shimmer={false} className="object-cover" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Three of the year's posters, fanned: the "titles" card on phones. */
function PosterStack({ posters }: { posters: string[] }) {
  const three = posters.slice(0, 3)
  if (three.length === 0) return null
  const tilt = three.length === 1 ? [0] : three.length === 2 ? [-7, 7] : [-10, 0, 10]
  return (
    <div aria-hidden className="relative mx-auto flex h-[30%] max-h-[190px] min-h-[120px] w-full items-center justify-center lg:hidden">
      {three.map((path, index) => (
        <div
          key={path}
          style={{ transform: `translateX(${(index - (three.length - 1) / 2) * 46}%) rotate(${tilt[index]}deg)`, zIndex: index === 1 ? 2 : 1 }}
          className="absolute aspect-[2/3] h-full overflow-hidden rounded-[10px] bg-white/[0.06] shadow-[0_20px_40px_-14px_rgb(0_0_0/0.9)] ring-1 ring-white/10"
        >
          <TmdbImage kind="poster" path={path} fill sizes="120px" alt="" className="object-cover" />
        </div>
      ))}
    </div>
  )
}

function PickCard({ href, poster, label, title, meta, className }: {
  href: string
  poster: string | null
  label: string
  title: string
  meta: React.ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      data-story
      className={cn(CARD, 'group justify-end gap-6 transition-shadow duration-200 hover:ring-white/20 lg:flex-row lg:items-center lg:justify-start', className)}
    >
      <Glow path={poster} className={GLOW.topStart} />
      <div className="relative aspect-[2/3] w-[60%] max-w-[240px] shrink-0 self-center overflow-hidden rounded-[14px] bg-white/[0.06] shadow-[0_24px_60px_-20px_rgb(0_0_0/0.9)] ring-1 ring-white/10 lg:w-28 lg:self-auto xl:w-32">
        <TmdbImage kind="poster" path={poster} fill sizes="(min-width: 1024px) 128px, 60vw" alt="" className="object-cover" />
      </div>
      <div className="min-w-0">
        <p className={LABEL}>{label}</p>
        <p className="mt-2 text-balance font-display text-[clamp(28px,7vw,36px)] font-bold leading-[1.02] text-white lg:text-[clamp(24px,2.2vw,32px)]"><bdi>{title}</bdi></p>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 text-sm text-white/65">{meta}</p>
      </div>
    </Link>
  )
}

/** The recap itself, shared by /wrapped and the public share pages. */
export default function WrappedCards({ stats, isCurrentYear }: { stats: WrappedStats, isCurrentYear: boolean }) {
  const { t, locale, dateLocale } = useI18n()
  const reduceMotion = useReducedMotion()
  const scroller = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const genreList = useRef<HTMLOListElement>(null)
  const genresInView = useInView(genreList, { once: true, amount: 0.6 })

  const hours = stats.minutes / 60
  const days = Math.round(hours / 24)
  const topGenreMinutes = stats.topGenres[0]?.minutes || 1
  const persona = personaOf(stats.personality, t)
  const PersonaIcon = persona.icon
  const plural = (count: number, one: Parameters<typeof t>[0], many: Parameters<typeof t>[0]) => t(count === 1 ? one : many, { count })

  const picks = [
    stats.topShow && 'show',
    stats.topMovie && 'movie',
    stats.firstWatch && 'first',
    stats.favorites > 0 && 'favorites',
  ].filter(Boolean)
  const pickSpan = PICK_SPANS[picks.length] ?? 'lg:col-span-3'
  // A collage of one or two posters is a gap, not a collage (the intro's wall already shows them).
  const showCollage = stats.posters.length >= 4
  const count = 4 + (stats.topGenres.length > 0 ? 1 : 0) + picks.length + (showCollage ? 1 : 0)

  // Which story card is on screen (phones), for the progress segments: the most visible one.
  // Measured rather than observed, so it reads the same in both text directions.
  useEffect(() => {
    const root = scroller.current
    if (!root) return
    let frame = 0
    const update = () => {
      frame = 0
      const box = root.getBoundingClientRect()
      let best = 0
      let bestVisible = -1
      root.querySelectorAll<HTMLElement>('[data-story]').forEach((item, index) => {
        const rect = item.getBoundingClientRect()
        const visible = Math.min(rect.right, box.right) - Math.max(rect.left, box.left)
        if (visible > bestVisible + 1) { best = index; bestVisible = visible }
      })
      setActive(best)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    root.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      root.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      cancelAnimationFrame(frame)
    }
  }, [count])

  const goTo = (index: number) => {
    const item = scroller.current?.querySelectorAll<HTMLElement>('[data-story]')[index]
    item?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest', inline: 'start' })
  }

  return (
    <section aria-label={t('nav.myYear')}>
      <div className="mb-3 flex gap-1.5 lg:hidden" role="group" aria-label={t('wrapped.cards')}>
        {Array.from({ length: count }, (_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => goTo(index)}
            aria-label={t('wrapped.goToCard', { n: index + 1, total: count })}
            aria-current={index === active ? 'step' : undefined}
            className="group flex-1 py-2.5 outline-none"
          >
            <span
              className={cn(
                'block h-[3px] rounded-full transition-colors duration-300 group-focus-visible:ring-2 group-focus-visible:ring-red-500',
                index === active ? 'bg-white' : index < active ? 'bg-white/55' : 'bg-white/20',
              )}
            />
          </button>
        ))}
      </div>

      <div
        ref={scroller}
        style={{ '--story-h': 'max(440px, min(660px, calc(100dvh - 270px)))' } as React.CSSProperties}
        className="no-scrollbar -mx-[var(--gutter)] flex snap-x snap-mandatory scroll-px-[var(--gutter)] gap-3 overflow-x-auto overscroll-x-contain px-[var(--gutter)] lg:mx-0 lg:grid lg:grid-cols-6 lg:gap-4 lg:overflow-visible lg:px-0"
      >
        {/* Intro */}
        <article data-story className={cn(CARD, 'justify-end bg-black lg:col-span-4 lg:row-span-2 lg:min-h-[500px] lg:p-10')}>
          <PosterWall posters={stats.posters} />
          <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/75 to-black/20" />
          <h1 className="text-balance font-display text-[clamp(46px,12vw,104px)] font-extrabold leading-[0.9] text-white lg:text-[clamp(56px,6vw,104px)]">
            <bdi>{t(isCurrentYear ? 'wrapped.headingSoFar' : 'wrapped.heading', { name: stats.name, year: stats.year })}</bdi>
          </h1>
          <p className="mt-4 text-[17px] text-white/75">{t('wrapped.intro')}</p>
        </article>

        {/* Titles */}
        <article data-story className={cn(CARD, TYPE_CARD, 'gap-10 lg:col-span-2')}>
          <Glow path={stats.posters[1] ?? stats.posters[0]} className={GLOW.topEnd} />
          <PosterStack posters={stats.posters} />
          <div>
            <p className={LABEL}>{t('wrapped.youWatched')}</p>
            <StatNumber value={stats.titles} className={cn(BIG, 'mt-3')} />
            <p className="mt-2 font-display text-2xl font-bold">{plural(stats.titles, 'wrapped.titleOne', 'wrapped.titleMany')}</p>
            <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/65">
              <span className="inline-flex items-center gap-1.5"><Film aria-hidden className="h-4 w-4" />{plural(stats.movies, 'wrapped.movieOne', 'wrapped.movieMany')}</span>
              <span className="inline-flex items-center gap-1.5"><Tv aria-hidden className="h-4 w-4" />{plural(stats.shows, 'wrapped.showOne', 'wrapped.showMany')}</span>
            </p>
          </div>
        </article>

        {/* Time */}
        <article data-story className={cn(CARD, TYPE_CARD, 'lg:col-span-2')}>
          <Glow path={stats.posters[2] ?? stats.posters[0]} className={GLOW.bottomStart} />
          <div>
            <p className={LABEL}>{t('wrapped.timeSpent')}</p>
            <StatNumber value={hours >= 10 ? Math.round(hours) : Math.round(hours * 10) / 10} decimals={hours >= 10 ? 0 : 1} prefix="~" className={cn(BIG, 'mt-3')} />
            <p className="mt-2 font-display text-2xl font-bold">{t('wrapped.hours')}</p>
            <p className="mt-3 text-sm text-white/70">
              {hours >= 24
                ? plural(days, 'wrapped.dayOne', 'wrapped.days')
                : stats.episodes > 0 ? plural(stats.episodes, 'wrapped.episodeOne', 'wrapped.episodes') : t('wrapped.wellSpent')}
            </p>
            <p className="mt-1.5 text-[12px] text-white/45">{t('wrapped.estimated')}</p>
          </div>
        </article>

        {/* Personality */}
        <article data-story className={cn(CARD, TYPE_CARD, stats.topGenres.length > 0 ? 'lg:col-span-3' : 'lg:col-span-6')}>
          <Glow path={stats.posters[3] ?? stats.posters[0]} className={GLOW.topEnd} />
          <span className="mb-8 grid h-20 w-20 place-items-center rounded-full bg-white/[0.08] ring-1 ring-white/10 lg:mb-auto lg:h-14 lg:w-14">
            <PersonaIcon aria-hidden className="h-9 w-9 text-white lg:h-7 lg:w-7" strokeWidth={1.8} />
          </span>
          <div className="lg:mt-8">
            <p className={LABEL}>{t('wrapped.personality')}</p>
            <p className="mt-2 text-balance font-display text-[clamp(38px,10vw,56px)] font-extrabold leading-[0.95] text-white lg:text-[clamp(36px,3.4vw,56px)]">{persona.title}</p>
            <p className="mt-3 max-w-[42ch] text-pretty text-[15px] leading-relaxed text-white/70">{persona.blurb}</p>
          </div>
        </article>

        {/* Genres */}
        {stats.topGenres.length > 0 && (
          <article data-story className={cn(CARD, 'justify-center gap-10 lg:col-span-3 lg:justify-between lg:gap-8')}>
            <Glow path={stats.posters[4] ?? stats.posters[0]} className={GLOW.bottomEnd} />
            <p className={LABEL}>{t('wrapped.topGenres')}</p>
            <ol ref={genreList} className="space-y-5">
              {stats.topGenres.map((genre, index) => (
                <li key={genre.name}>
                  <div className="flex items-baseline gap-3">
                    <span className="w-5 shrink-0 font-display text-lg font-bold tabular-nums text-white/40">{index + 1}</span>
                    <span className={cn('min-w-0 font-display leading-none text-white', index === 0 ? 'text-[clamp(32px,8vw,44px)] font-extrabold lg:text-[clamp(30px,2.8vw,44px)]' : 'text-2xl font-bold')}>
                      {genreLabel(genre.name, locale)}
                    </span>
                  </div>
                  <div className="ms-8 mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <m.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: genresInView ? 1 : 0 }}
                      transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.15 + index * 0.08 }}
                      style={{ width: `${Math.max(8, (genre.minutes / topGenreMinutes) * 100)}%` }}
                      className={cn('h-full origin-left rounded-full rtl:origin-right', index === 0 ? 'bg-white' : 'bg-white/45')}
                    />
                  </div>
                </li>
              ))}
            </ol>
          </article>
        )}

        {stats.topShow && (
          <PickCard
            href={`/tv/${stats.topShow.id}`}
            poster={stats.topShow.poster_path}
            label={t('wrapped.topShow')}
            title={stats.topShow.title}
            meta={<span>{plural(stats.topShow.episodes, 'wrapped.episodesShortOne', 'wrapped.episodesShort')}</span>}
            className={pickSpan}
          />
        )}

        {stats.topMovie && (
          <PickCard
            href={`/movie/${stats.topMovie.id}`}
            poster={stats.topMovie.poster_path}
            label={t('wrapped.topMovie')}
            title={stats.topMovie.title}
            meta={(
              <span className="inline-flex items-center gap-1.5">
                <Star aria-hidden className="h-4 w-4 fill-star text-star" />{t('wrapped.rating', { rating: stats.topMovie.rating })}
              </span>
            )}
            className={pickSpan}
          />
        )}

        {stats.firstWatch && (
          <PickCard
            href={`/${stats.firstWatch.media_type}/${stats.firstWatch.id}`}
            poster={stats.firstWatch.poster_path}
            label={t('wrapped.startedWith', { year: stats.year })}
            title={stats.firstWatch.title}
            meta={<span>{new Date(stats.firstWatch.date).toLocaleDateString(dateLocale ?? 'en-GB', { day: 'numeric', month: 'long' })}</span>}
            className={pickSpan}
          />
        )}

        {stats.favorites > 0 && (
          <article data-story className={cn(CARD, TYPE_CARD, pickSpan)}>
            <Glow path={stats.posters[5] ?? stats.posters[0]} className={GLOW.topStart} />
            <div>
              <Heart aria-hidden className="mb-6 h-10 w-10 fill-red-500 text-red-500 lg:mb-4 lg:h-8 lg:w-8" />
              <p className={LABEL}>{t('wrapped.fellInLove')}</p>
              <StatNumber value={stats.favorites} className={cn(BIG, 'mt-2')} />
              <p className="mt-2 font-display text-2xl font-bold">{plural(stats.favorites, 'wrapped.favoriteOne', 'wrapped.favoriteMany')}</p>
            </div>
          </article>
        )}

        {/* Collage */}
        {showCollage && (
          <article data-story className={cn(CARD, 'lg:col-span-6')}>
            <p className={LABEL}>{t('wrapped.inPosters', { year: stats.year })}</p>
            <div className="mt-5 grid grid-cols-4 content-start gap-2 lg:grid-cols-12 lg:gap-3">
              {stats.posters.map((path) => (
                <div key={path} className="relative aspect-[2/3] w-full overflow-hidden rounded-[8px] bg-white/[0.06] lg:rounded-poster">
                  <TmdbImage kind="poster" path={path} fill sizes="(min-width: 1024px) 8vw, 22vw" alt="" className="object-cover" />
                </div>
              ))}
            </div>
          </article>
        )}
      </div>
    </section>
  )
}
