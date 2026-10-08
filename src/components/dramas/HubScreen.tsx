"use client"
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, Clapperboard, Info, Pause, Play, Plus, Star, Volume2, VolumeX } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import YouTubeBackdrop from '@/src/components/media/YouTubeBackdrop'
import YouTubeDialog from '@/src/components/media/YouTubeDialog'
import { Button } from '@/src/components/ui/button'
import { useI18n } from '@/src/components/I18nProvider'
import { useCanAutoplay } from '@/src/hooks/use-autoplay'
import { useLibraryToggle } from '@/src/hooks/use-library-toggle'
import { useInLibrary } from '@/src/store/library'
import { isArabicScript } from '@/src/lib/i18n/locales'
import type { FeaturedSeries } from '@/src/lib/dramas'
import { cn } from '@/src/lib/utils'

const TRAILER_DELAY_MS = 2500

function ListButton({ series }: { series: FeaturedSeries }) {
  const { t } = useI18n()
  const toggle = useLibraryToggle()
  const saved = useInLibrary('saved', { id: String(series.id), media_type: 'tv' })
  const label = saved ? t('billboard.inMyList') : t('billboard.myList')
  return (
    <Button
      variant="secondary"
      size="icon-lg"
      aria-pressed={saved}
      aria-label={label}
      title={label}
      onClick={() => toggle('saved', { id: String(series.id), title: series.title, poster_path: series.poster, media_type: 'tv' })}
    >
      <span className="relative grid h-5 w-5 place-items-center">
        <Plus aria-hidden className={cn('absolute h-5 w-5 transition-[opacity,transform] duration-200', saved ? 'rotate-90 scale-50 opacity-0' : 'opacity-100')} />
        <Check aria-hidden className={cn('absolute h-5 w-5 transition-[opacity,transform] duration-200', saved ? 'opacity-100' : '-rotate-45 scale-50 opacity-0')} />
      </span>
    </Button>
  )
}

/**
 * The hub's screen (clamp(440px, 42vw, 640px) tall, and never so tall that Play falls below the
 * fold on a 768px-high laptop): today's featured series in a framed stage under the hub title.
 * The backdrop drifts (Ken Burns); after a moment, where trailers may play on their own (a mouse,
 * no reduced motion, no Data Saver, the setting on), the trailer takes over, muted, with visible
 * pause and sound buttons, and it pauses whenever less than 35% of the frame is on screen (or the
 * tab is hidden). Elsewhere (touch screens included) a Trailer button opens it in the video
 * dialog. Phones get the picture as a 16:10 band with the words under it.
 */
export default function HubScreen({ series, accent }: { series: FeaturedSeries, accent: string }) {
  const { t, locale } = useI18n()
  const autoplay = useCanAutoplay()
  const ref = useRef<HTMLElement>(null)
  const [inView, setInView] = useState(true)
  const [tabVisible, setTabVisible] = useState(true)
  const [trailerOn, setTrailerOn] = useState(false)
  // Played to the end once: the picture comes back for good, and the Trailer button appears.
  const [trailerDone, setTrailerDone] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(true)
  const [paused, setPaused] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const running = inView && tabVisible && !paused && !dialogOpen

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.intersectionRatio >= 0.35), { threshold: [0, 0.35, 1] })
    observer.observe(node)
    const onVisibility = () => setTabVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useEffect(() => {
    if (!autoplay || !series.trailer || trailerOn || trailerDone || !inView) return
    const timer = setTimeout(() => setTrailerOn(true), TRAILER_DELAY_MS)
    return () => clearTimeout(timer)
  }, [autoplay, series.trailer, trailerOn, trailerDone, inView])

  const length = series.seasons ? (series.seasons > 1 ? t('pick.seasons', { count: series.seasons }) : t('pick.oneSeason')) : ''
  const trailerTitle = t('hero.trailerTitle', { title: series.title })

  return (
    <section ref={ref} aria-label={t('dramas.hero.label')} className="page-x">
      <div className="relative isolate -mx-[var(--gutter)] overflow-hidden md:mx-0 md:h-[clamp(440px,min(42vw,calc(100svh_-_210px)),640px)] md:rounded-stage md:bg-white/[0.04] md:ring-1 md:ring-inset md:ring-white/[0.08]">
        {/* The picture: a 16:10 band on phones, the whole stage from tablets up. */}
        <div className="relative aspect-[16/10] w-full overflow-hidden md:absolute md:inset-0 md:aspect-auto">
          <div className={cn('absolute inset-0', !playing && 'animate-ken-burns')}>
            <TmdbImage
              kind="backdrop"
              path={series.backdrop}
              alt=""
              fill
              priority
              preview="w300"
              shimmer={false}
              sizes="(min-width: 768px) 92vw, 100vw"
              className="object-cover object-top"
            />
          </div>
          {trailerOn && series.trailer && (
            <YouTubeBackdrop
              videoKey={series.trailer}
              muted={muted}
              play={running}
              zoom={1.3}
              onState={(state) => {
                if (state === 'playing') setPlaying(true)
                if (state === 'ended') {
                  setPlaying(false)
                  setTrailerOn(false)
                  setTrailerDone(true)
                }
              }}
            />
          )}
          {/* Scrims: into the page below (phones), behind the words (start side), and the hub's light. */}
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-[65%] bg-gradient-to-t from-black via-black/55 to-transparent md:h-[70%] md:from-black/90" />
          <div aria-hidden className="absolute inset-y-0 start-0 hidden w-[68%] bg-gradient-to-r from-black/85 via-black/40 to-transparent md:block rtl:bg-gradient-to-l" />
          <div
            aria-hidden
            className="absolute inset-0 hidden [--glow-x:0%] md:block rtl:[--glow-x:100%]"
            style={{ background: `radial-gradient(70% 60% at var(--glow-x) 112%, rgb(${accent} / 0.38), transparent 70%)` }}
          />
        </div>

        <div className="relative -mt-14 px-[var(--gutter)] md:absolute md:inset-x-0 md:bottom-0 md:mt-0 md:p-[clamp(28px,3.2vw,48px)]">
          <div className="max-w-[560px] md:max-w-[min(560px,50vw)]">
            {series.logo ? (
              <h2 className="relative h-[clamp(52px,8.4vw,112px)] w-[min(76%,420px)] animate-focus-in">
                <span className="sr-only">{series.title}</span>
                <TmdbImage
                  kind="logo"
                  path={series.logo.path}
                  alt=""
                  fill
                  shimmer={false}
                  sizes="(min-width: 768px) 420px, 76vw"
                  className="object-contain object-left-bottom drop-shadow-[0_4px_30px_rgb(0_0_0/0.6)] rtl:object-right-bottom"
                />
              </h2>
            ) : (
              <h2 className="animate-focus-in text-balance font-display text-[clamp(32px,4.2vw,60px)] font-extrabold leading-[0.95] text-white">
                <bdi>{series.title}</bdi>
              </h2>
            )}

            <p className="mt-4 animate-focus-in text-[15px] font-medium leading-snug text-white [animation-delay:60ms]">{series.why}</p>
            <p className="mt-2 flex animate-focus-in flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-white/75 [animation-delay:90ms]">
              {series.rating > 0 && (
                <span className="inline-flex items-center gap-1 font-semibold text-white">
                  <Star aria-hidden className="h-3.5 w-3.5 fill-star text-star" />
                  {series.rating.toFixed(1)}
                </span>
              )}
              {series.year && <span>{series.year}</span>}
              {length && <span>{length}</span>}
              {series.genres.length > 0 && <span className="text-white/60">{series.genres.join(isArabicScript(locale) ? '، ' : ' / ')}</span>}
            </p>
            {series.overview && (
              <p dir="auto" className={cn('mt-3 line-clamp-3 max-w-[54ch] animate-focus-in text-[14.5px] leading-relaxed text-white/70 transition-opacity duration-700 [animation-delay:120ms] md:line-clamp-2', playing && 'md:opacity-0')}>
                {series.overview}
              </p>
            )}

            <div className="mt-5 flex animate-focus-in items-center gap-2.5 [animation-delay:150ms] sm:flex-wrap sm:gap-3">
              <Button asChild size="lg" className="flex-1 px-8 sm:flex-none">
                <Link href={`/tv/${series.id}?s=1&e=1`}>
                  <Play aria-hidden className="h-5 w-5 fill-current rtl:-scale-x-100" />
                  {t('billboard.play')}
                </Link>
              </Button>
              {/* Phones: an icon, so Play keeps its width and the row stays on one line. */}
              <Button asChild size="lg" variant="secondary" className="w-12 px-0 sm:w-auto sm:px-7">
                <Link href={`/tv/${series.id}`} aria-label={t('pick.moreInfo')}>
                  <Info aria-hidden className="h-5 w-5" />
                  <span className="hidden sm:inline">{t('pick.moreInfo')}</span>
                </Link>
              </Button>
              {series.trailer && (!autoplay || trailerDone) && (
                <Button
                  size="icon-lg"
                  variant="secondary"
                  onClick={() => setDialogOpen(true)}
                  aria-label={trailerTitle}
                  title={t('detail.trailer')}
                >
                  <Clapperboard aria-hidden className="h-5 w-5" />
                </Button>
              )}
              <ListButton series={series} />
            </div>
          </div>
        </div>

        {/* Visible whenever the trailer plays: over the picture's top end on narrow windows, at the
            stage's bottom end from tablets up. */}
        {playing && (
          <div className="absolute end-[var(--gutter)] top-3 flex gap-2 animate-in fade-in duration-500 md:bottom-[clamp(28px,3.2vw,48px)] md:end-[clamp(28px,3.2vw,48px)] md:top-auto">
            <button
              type="button"
              onClick={() => setPaused((value) => !value)}
              aria-pressed={paused}
              aria-label={paused ? t('clips.play') : t('clips.pause')}
              className="pressable glass grid h-11 w-11 place-items-center rounded-full text-white outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              {paused ? <Play aria-hidden className="ms-0.5 h-4 w-4 fill-current rtl:-scale-x-100" /> : <Pause aria-hidden className="h-4 w-4 fill-current" />}
            </button>
            <button
              type="button"
              onClick={() => setMuted((value) => !value)}
              aria-label={muted ? t('billboard.soundOn') : t('billboard.soundOff')}
              className="pressable glass grid h-11 w-11 place-items-center rounded-full text-white outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              {muted ? <VolumeX aria-hidden className="h-5 w-5" /> : <Volume2 aria-hidden className="h-5 w-5" />}
            </button>
          </div>
        )}
      </div>

      {series.trailer && (
        <YouTubeDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          videos={[{ key: series.trailer, title: trailerTitle }]}
          index={0}
          onIndexChange={() => {}}
          label={t('detail.trailer')}
        />
      )}
    </section>
  )
}
