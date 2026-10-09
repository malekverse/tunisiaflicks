"use client"
// The soundtrack block of the Extras section: the album (its cover, with a record peeking out
// from behind it), where to listen to it in full, and its tracks with 30-second previews from
// Deezer (one at a time, a ring for the progress). "Wrong album?" tells us when the match is off.
import { useState } from 'react'
import Link from 'next/link'
import { Pause, Play } from 'lucide-react'
import { Button } from '@/src/components/ui/button'
import { Skeleton } from '@/src/components/ui/skeleton'
import { useI18n } from '@/src/components/I18nProvider'
import { toast } from '@/src/hooks/use-toast'
import { usePreviewPlayer, type SoundtrackAlbum, type SoundtrackTrack } from '@/src/hooks/use-soundtrack'
import { cn } from '@/src/lib/utils'
import ListenLinks from './ListenLinks'

const duration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

const RING = 2 * Math.PI * 19

/** The play button's face: the icon in a disc, and the preview's progress around it. */
function PlayFace({ playing, active, progress, disabled }: { playing: boolean, active: boolean, progress: number, disabled: boolean }) {
  return (
    <span className="relative grid h-11 w-11 shrink-0 place-items-center">
      <svg aria-hidden viewBox="0 0 44 44" className="absolute inset-0 h-11 w-11 -rotate-90 rtl:scale-y-[-1]">
        <circle cx="22" cy="22" r="19" fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth="2" />
        {active && (
          <circle cx="22" cy="22" r="19" fill="none" stroke="rgb(255 36 20)" strokeWidth="2" strokeLinecap="round" strokeDasharray={RING} strokeDashoffset={RING * (1 - progress)} />
        )}
      </svg>
      <span className={cn(
        'grid h-8 w-8 place-items-center rounded-full transition-[background-color,color,transform] duration-150 ease-out group-active/track:scale-95',
        disabled ? 'text-white/25' : active ? 'bg-white text-black' : 'bg-white/[0.08] text-white group-hover/track:bg-white/[0.16]',
      )}>
        {playing ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="ms-0.5 h-3.5 w-3.5 fill-current rtl:-scale-x-100" />}
      </span>
    </span>
  )
}

function TrackRow({ track, index, albumArtist, state, onToggle, hiddenClass }: {
  track: SoundtrackTrack
  index: number
  albumArtist: string
  state: { active: boolean, playing: boolean, progress: number, failed: boolean }
  onToggle: () => void
  hiddenClass: string
}) {
  const { t } = useI18n()
  const label = !track.preview ? t('soundtrack.noPreview') : state.playing ? t('soundtrack.pause', { title: track.title }) : t('soundtrack.play', { title: track.title })
  return (
    <li className={hiddenClass}>
      <button
        type="button"
        onClick={onToggle}
        disabled={!track.preview}
        aria-label={label}
        title={!track.preview ? label : undefined}
        className="group/track flex w-full select-none items-center gap-3 rounded-2xl py-1 pe-3 ps-1 text-start outline-none transition-colors duration-150 hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-default disabled:hover:bg-transparent"
      >
        <PlayFace playing={state.playing} active={state.active} progress={state.progress} disabled={!track.preview} />
        <span className="w-5 shrink-0 text-center text-[12.5px] tabular-nums text-white/50">{index + 1}</span>
        <span className="min-w-0 flex-1">
          <span dir="auto" className={cn('block truncate text-[14.5px] font-medium', state.active ? 'text-white' : 'text-white/90')}>{track.title}</span>
          {(track.artist && track.artist !== albumArtist) || state.failed ? (
            <span className={cn('block truncate text-[12.5px]', state.failed ? 'text-red-400' : 'text-white/50')}>
              {state.failed ? t('soundtrack.previewFailed') : <bdi>{track.artist}</bdi>}
            </span>
          ) : null}
        </span>
        {track.explicit && (
          <span title={t('soundtrack.explicit')} className="grid h-5 w-5 shrink-0 place-items-center rounded bg-white/[0.12] text-[11px] font-semibold text-white/70">
            <span aria-hidden>E</span>
            <span className="sr-only">{t('soundtrack.explicit')}</span>
          </span>
        )}
        <span className="shrink-0 text-[13px] tabular-nums text-white/50">{duration(track.duration)}</span>
      </button>
    </li>
  )
}

/** The album cover with a record peeking out from behind it (further out under a mouse). */
function Cover({ album, spinning }: { album: SoundtrackAlbum, spinning: boolean }) {
  const { t, dir } = useI18n()
  const rtl = dir === 'rtl'
  return (
    <div className="relative isolate w-[124px] shrink-0 sm:w-[152px]">
      <div
        aria-hidden
        className={cn(
          'absolute inset-y-[5%] start-[5%] -z-10 aspect-square rounded-full shadow-[0_10px_30px_-10px_rgb(0_0_0/0.9)] transition-transform duration-500 ease-out',
          rtl
            ? '-translate-x-[24%] motion-safe:[@media(pointer:fine)]:group-hover/sound:-translate-x-[42%]'
            : 'translate-x-[24%] motion-safe:[@media(pointer:fine)]:group-hover/sound:translate-x-[42%]',
        )}
      >
        <div
          className={cn('h-full w-full rounded-full', spinning && 'motion-safe:animate-[spin_5s_linear_infinite]')}
          style={{
            background: 'radial-gradient(circle at 50% 50%, transparent 0 33%, rgb(0 0 0 / 0.0) 33%), repeating-radial-gradient(circle at 50% 50%, #0b0b0b 0 1.2px, #1c1c1c 1.2px 2.6px)',
          }}
        >
          {/* The label: the cover itself, and the spindle hole. */}
          <span
            className="absolute inset-[33%] rounded-full bg-cover bg-center ring-1 ring-black/60"
            style={album.cover ? { backgroundImage: `url(${album.cover})` } : { background: 'rgb(229 15 5)' }}
          />
          <span className="absolute inset-[48%] rounded-full bg-black" />
          {/* A sheen across the grooves. */}
          <span className="absolute inset-0 rounded-full bg-[conic-gradient(from_200deg,transparent_0deg,rgb(255_255_255/0.08)_40deg,transparent_80deg,transparent_180deg,rgb(255_255_255/0.06)_220deg,transparent_260deg)]" />
        </div>
      </div>
      <div className="relative aspect-square overflow-hidden rounded-[10px] bg-white/[0.06] shadow-[0_18px_40px_-16px_rgb(0_0_0/0.95)] ring-1 ring-white/10">
        {album.cover && (
          // Deezer's CDN, not TMDB: a plain image (next/image would need its host configured).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={album.cover} alt={t('soundtrack.coverAlt', { title: album.title })} width={300} height={300} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        )}
      </div>
    </div>
  )
}

export default function SoundtrackSection({ type, id, kids, album, tracks, failed }: {
  type: 'movie' | 'tv'
  id: string
  kids: boolean
  album: SoundtrackAlbum
  /** null while they load. */
  tracks: SoundtrackTrack[] | null
  failed: boolean
}) {
  const { t } = useI18n()
  const player = usePreviewPlayer()
  const [all, setAll] = useState(false)
  const [reported, setReported] = useState(false)
  const [reporting, setReporting] = useState(false)

  const report = async () => {
    if (reported || reporting) return
    setReporting(true)
    try {
      const response = await fetch('/api/soundtrack/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id, albumId: album.albumId }),
      })
      if (response.status === 429) {
        setReported(true)
        toast({ title: t('soundtrack.alreadyReported') })
        return
      }
      if (!response.ok) throw new Error(String(response.status))
      setReported(true)
      toast({ title: t('soundtrack.reported'), description: t('soundtrack.reportedText') })
    } catch {
      toast({ variant: 'destructive', title: t('soundtrack.reportFailed') })
    } finally {
      setReporting(false)
    }
  }

  const count = tracks?.length ?? album.trackCount
  const list = tracks ?? []
  // 3 rows on phones, 8 from md up; "Show all" opens the rest.
  const hiddenClass = (index: number) => (all ? '' : index >= 8 ? 'hidden' : index >= 3 ? 'hidden md:block' : '')
  // The button shows on phones from 4 tracks, and from md up from 9.
  const more = all || list.length <= 3 ? null : list.length > 8 ? '' : 'md:hidden'

  return (
    <div className="page-x">
      <h3 className="mb-3 font-display text-[18px] font-bold text-white sm:text-[20px]">{t('soundtrack.title')}</h3>
      <div className="group/sound grid gap-6 rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-white/[0.07] sm:p-6 lg:grid-cols-[minmax(0,380px)_1fr] lg:gap-10">
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-4 lg:flex-col lg:items-start lg:gap-5">
            {/* Room on the end side for the record peeking out. */}
            <div className="pe-10 sm:pe-14">
              <Cover album={album} spinning={player.playing} />
            </div>
          <div className="min-w-0 flex-1">
            <p dir="auto" className="line-clamp-3 text-balance font-display text-[19px] font-bold leading-tight text-white sm:text-[24px]">{album.title}</p>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-white/70">
              {album.artist && (album.composerId ? (
                <Link href={`/person/${album.composerId}`} className="rounded-sm font-medium text-white/90 underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-red-500"><bdi>{album.artist}</bdi></Link>
              ) : <span className="font-medium text-white/90"><bdi>{album.artist}</bdi></span>)}
              {album.year && <span>{album.year}</span>}
              {count > 0 && <span>{t('soundtrack.tracks', { count })}</span>}
            </p>
          </div>
          </div>
          {!kids && <ListenLinks query={`${album.title} ${album.artist}`.trim()} deezerAlbum={album.link} />}
        </div>

        <div className="min-w-0">
          {tracks === null && !failed ? (
            <div aria-hidden className="space-y-3 pt-1">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex items-center gap-3">
                  <Skeleton className="h-11 w-11 rounded-full" />
                  <Skeleton className="h-3.5 w-1/2 rounded-full" />
                </div>
              ))}
            </div>
          ) : list.length > 0 ? (
            <>
              <ol aria-label={t('soundtrack.tracksLabel')} className="-mx-1 space-y-0.5">
                {list.map((track, index) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    index={index}
                    albumArtist={album.artist}
                    hiddenClass={hiddenClass(index)}
                    onToggle={() => player.toggle(track.id)}
                    state={{
                      active: player.current === track.id,
                      playing: player.current === track.id && player.playing,
                      progress: player.current === track.id ? player.progress : 0,
                      failed: player.failed === track.id,
                    }}
                  />
                ))}
              </ol>
              {more !== null && (
                <Button variant="ghost" size="sm" onClick={() => setAll(true)} className={cn('mt-2 h-11 px-4 text-white/80', more)}>
                  {t('soundtrack.showAll', { count: list.length })}
                </Button>
              )}
            </>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-white/[0.07] pt-4">
            <p className="text-[12.5px] text-white/50">{t('soundtrack.note')}</p>
            {!kids && (
              <Button variant="ghost" size="sm" onClick={report} disabled={reported || reporting} className="-me-3 h-11 px-3 text-[13px] text-white/60 hover:text-white">
                {t('soundtrack.wrong')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
