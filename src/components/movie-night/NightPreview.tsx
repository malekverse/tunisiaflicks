"use client"
// A night seen from outside: someone holding an invitation link, or waiting for the host's
// approval. Only the date, the host's first name and the posters: never who else is coming,
// where, or the note. With a link: the invitation banner (Join, or Ask to join when the host
// approves joins). Waiting: it checks every 15 seconds and opens up once approved.
import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Clock3 } from 'lucide-react'
import InviteBanner from '@/src/components/share/InviteBanner'
import TmdbImage from '@/src/components/TmdbImage'
import { useI18n } from '@/src/components/I18nProvider'
import { nightDay, nightTime } from '@/src/lib/movie-night-format'
import type { NightPreview as Preview } from '@/src/lib/movie-night'
import { cn } from '@/src/lib/utils'
import DateTile from './DateTile'

/** The films on the ballot (or the film), dealt like a hand of cards. Decorative. */
function Hand({ posters }: { posters: string[] }) {
  const shown = posters.slice(0, 3)
  const spots = shown.length === 1 ? [{ x: 0, r: 0 }] : shown.length === 2 ? [{ x: -24, r: -7 }, { x: 24, r: 7 }] : [{ x: -42, r: -10 }, { x: 0, r: 0 }, { x: 42, r: 10 }]
  return (
    <div aria-hidden className="relative mx-auto aspect-[10/9] w-[min(78vw,400px)]">
      {shown.map((path, index) => (
        <div
          key={`${path}-${index}`}
          style={{ transform: `translateX(${spots[index].x}%) rotate(${spots[index].r}deg)`, zIndex: index === 1 || shown.length < 3 ? 3 : 1 }}
          className="absolute inset-x-0 top-[4%] mx-auto aspect-[2/3] w-[54%]"
        >
          <div className="relative h-full w-full overflow-hidden rounded-[14px] bg-white/[0.06] shadow-[0_28px_60px_-20px_rgb(0_0_0/0.95)] ring-1 ring-white/10">
            <TmdbImage kind="poster" path={path} fill sizes="(min-width: 768px) 220px, 42vw" alt="" className="object-cover" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function NightPreview({ preview, token, signedIn }: { preview: Preview; token: string | null; signedIn: boolean }) {
  const { t, locale } = useI18n()
  const router = useRouter()
  const waiting = preview.role === 'requested'
  const cancelled = preview.status === 'cancelled'

  useEffect(() => {
    if (!waiting) return
    const timer = setInterval(async () => {
      if (document.visibilityState !== 'visible') return
      const response = await fetch(`/api/movie-night/${preview.id}?v=${preview.rev}`, { cache: 'no-store' }).catch(() => null)
      if (!response) return
      if (response.status === 404) return router.refresh()
      const data = await response.json().catch(() => null)
      if (data && !data.same && data.access !== 'preview') router.refresh()
    }, 15_000)
    return () => clearInterval(timer)
  }, [waiting, preview.id, preview.rev, router])

  return (
    <div className="page-top pb-10">
      {token && !waiting && (
        <div className="mb-8">
          <InviteBanner
            token={token}
            inviter={{ name: preview.host.name, color: preview.host.color }}
            sentence={t('movieNight.banner.sentence', { name: preview.host.name })}
            acceptLabel={preview.needsApproval ? t('movieNight.banner.ask') : t('movieNight.banner.join')}
            accept={{ endpoint: `/api/movie-night/${preview.id}`, body: { action: 'join' } }}
            signedIn={signedIn}
            unavailable={cancelled ? t('movieNight.banner.cancelled') : null}
            consent={preview.needsApproval ? t('movieNight.banner.consent') : t('movieNight.banner.consentOpen')}
            onAcceptedHref={`/movie-night/${preview.id}`}
          />
        </div>
      )}

      <div className="page-x">
        {signedIn && (
          <Link href="/movie-night" className="-ms-1 mb-4 inline-flex min-h-11 items-center gap-1 rounded-full pe-3 ps-1 text-[14px] text-white/60 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-red-500">
            <ChevronLeft aria-hidden className="h-4 w-4 rtl:rotate-180" />{t('movieNight.back')}
          </Link>
        )}
        <div className="mx-auto grid max-w-[980px] items-center gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <div className="min-w-0">
            <div className="flex items-start gap-4 sm:gap-6">
              <span className={cn(cancelled && 'opacity-50 grayscale')}><DateTile at={preview.starts_at} tz={preview.tz} size="lg" /></span>
              <div className="min-w-0">
                <h1 className="font-display text-[clamp(32px,5vw,56px)] font-extrabold leading-[0.95]">{t('movieNight.preview.title')}</h1>
                <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span dir="ltr" className="font-display text-[28px] font-bold leading-none tabular-nums">{nightTime(preview.starts_at, preview.tz, locale)}</span>
                  <span suppressHydrationWarning className="text-[15px] text-white/70">{nightDay(preview.starts_at, preview.tz, locale)}</span>
                </p>
                <p className="mt-3 text-[14px] text-white/70">{t('movieNight.card.from', { name: preview.host.name })}</p>
              </div>
            </div>

            {waiting && (
              <div className="mt-8 flex items-start gap-3 rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-inset ring-white/[0.07]">
                <Clock3 aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-white/70" />
                <div>
                  <p className="font-semibold text-white">{t('movieNight.preview.waiting', { name: preview.host.name })}</p>
                  <p className="mt-1 text-[14px] leading-relaxed text-white/60">{t('movieNight.preview.waitingText')}</p>
                </div>
              </div>
            )}
            {cancelled && !token && <p className="mt-6 text-[15px] text-white/65">{t('movieNight.banner.cancelled')}</p>}
          </div>

          {preview.posters.length > 0 && (
            <Hand posters={preview.posters} />
          )}
        </div>
      </div>
    </div>
  )
}
