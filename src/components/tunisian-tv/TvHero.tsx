"use client"
import { useState } from 'react'
import Link from 'next/link'
import { ExternalLink, ListVideo, Play } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { useI18n } from '@/src/components/I18nProvider'
import { isArabicScript } from '@/src/lib/i18n/locales'
import { cadenceLine, episodeLabel } from '@/src/lib/tunisian-tv/labels'
import { channelName, seriesName, tvSeriesHref, type TvChannelView, type TvSeriesView, type TvVideoView } from '@/src/lib/tunisian-tv/view'
import { youtubeThumb, youtubeWatchUrl } from '@/src/lib/youtube'
import ChannelAvatar from './ChannelAvatar'
import { useTvWatch } from './TvWatchProvider'

/**
 * The series the hub leads with, framed like a screen lit by its own cover: the newest drama
 * episode (or this Ramadan's drama), its channel and rhythm, Play (the page's red) and its
 * episodes on the channel page. The cover is our own copy of YouTube's 1280×720 picture (the
 * 480×360 one when there is none).
 */
export default function TvHero({ series, episodes, channel, fresh, ramadan }: {
  series: TvSeriesView
  episodes: TvVideoView[]
  channel: TvChannelView | null
  fresh: boolean
  ramadan: boolean
}) {
  const { t, locale, dateLocale } = useI18n()
  const { play } = useTvWatch()
  const arabic = isArabicScript(locale)
  const cover = series.coverId ?? series.latest?.id ?? null
  const [maxres, setMaxres] = useState(true)
  const latest = series.latest
  const name = seriesName(series.title, series.titleAlt, arabic)
  const episode = latest ? episodeLabel(t, latest) : null
  const cadence = cadenceLine(t, series.cadence, dateLocale)
  const light = series.color ?? channel?.color ?? '231 0 19'
  const list = episodes.length ? episodes : latest ? [latest] : []
  const at = latest ? Math.max(0, list.findIndex((video) => video.id === latest.id)) : 0

  return (
    <section aria-label={t('ttv.hero.label')} className="page-x">
      <div
        className="relative isolate overflow-hidden rounded-stage bg-white/[0.04] ring-1 ring-inset ring-white/[0.08] md:aspect-[21/9] md:min-h-[420px]"
        style={{ boxShadow: `0 40px 120px -60px rgb(${light} / 0.55)` }}
      >
        {cover && (
          <div className="relative md:absolute md:inset-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={youtubeThumb(cover, maxres ? 'maxres' : 'hq')}
              onError={() => setMaxres(false)}
              alt=""
              width={1280}
              height={720}
              decoding="async"
              draggable={false}
              className="aspect-video w-full object-cover md:aspect-auto md:h-full"
            />
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent md:hidden" />
          </div>
        )}
        {/* The screen's own light, and the dark the words sit on. */}
        <div aria-hidden className="absolute inset-0 -z-10 [--glow-x:15%] rtl:[--glow-x:85%]" style={{ background: `radial-gradient(90% 120% at var(--glow-x) 100%, rgb(${light} / 0.35), transparent 70%)` }} />
        <div aria-hidden className="pointer-events-none absolute inset-0 hidden bg-gradient-to-r from-black/90 via-black/55 to-transparent md:block rtl:bg-gradient-to-l" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-2/3 bg-gradient-to-t from-black/85 to-transparent md:block" />

        <div className="relative p-5 sm:p-7 md:absolute md:inset-y-0 md:start-0 md:flex md:w-[min(600px,58%)] md:flex-col md:justify-end md:p-10 lg:p-12">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-white/70">
            {(fresh || ramadan) && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.1] px-2.5 py-1 font-semibold text-white">
                {fresh && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                {ramadan ? t('ttv.hero.ramadan') : t('ttv.hero.new')}
              </span>
            )}
            {channel && (
              <Link href={`/tunisian/tv/${channel.slug}`} className="pressable inline-flex items-center gap-2 rounded-full outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-red-500">
                <ChannelAvatar channel={channel} size={24} />
                <bdi>{channelName(channel, arabic)}</bdi>
              </Link>
            )}
          </p>
          <h2 dir="auto" className="mt-4 text-balance font-display text-[clamp(34px,4.6vw,68px)] font-extrabold leading-[0.95] text-white">
            {name}
          </h2>
          {(episode || cadence) && (
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-white/80">
              {episode && <span className="font-semibold text-white">{episode}</span>}
              {latest?.subtitle && <bdi className="text-white/70">{latest.subtitle}</bdi>}
              {cadence && <span className="text-white/60">{cadence}</span>}
            </p>
          )}
          {series.description && (
            <p dir="auto" className="mt-3 line-clamp-2 max-w-[56ch] text-[15px] leading-relaxed text-white/70 md:line-clamp-3">{series.description}</p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {latest && latest.blocked ? (
              <Button asChild size="lg" className="px-7">
                <a href={youtubeWatchUrl(latest.id)} target="_blank" rel="noopener noreferrer">
                  <ExternalLink aria-hidden className="h-5 w-5" />
                  {latest.episode ? t('ttv.hero.play', { n: latest.episode }) : t('ttv.hero.playLatest')}
                </a>
              </Button>
            ) : latest && (
              <Button size="lg" className="px-7" onClick={() => play(list, at)}>
                <Play aria-hidden className="h-5 w-5 fill-current rtl:-scale-x-100" />
                {latest.episode ? t('ttv.hero.play', { n: latest.episode }) : t('ttv.hero.playLatest')}
              </Button>
            )}
            <Button asChild size="lg" variant="secondary">
              <Link href={tvSeriesHref(series.channel, series.id)}>
                <ListVideo aria-hidden className="h-5 w-5" />
                {series.complete ? t('ttv.hero.allEpisodes') : t('ttv.hero.latestEpisodes')}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
