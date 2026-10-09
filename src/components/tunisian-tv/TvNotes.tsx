import Link from 'next/link'
import { CloudOff, MoonStar, Tv, Unplug } from 'lucide-react'
import { FaYoutube } from 'react-icons/fa'
import { Button } from '@/src/components/ui/button'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { dateLocale } from '@/src/lib/i18n/locales'
import { dayLabel } from '@/src/lib/tunisian-tv/labels'
import type { TvChannelView } from '@/src/lib/tunisian-tv/view'

// The quiet parts of Tunisian TV: where the videos come from, the empty state and a channel's
// status. Server components.

/** Where every episode plays from, and when the hub last heard from the channels. */
export function TvFooter({ updatedAt }: { updatedAt: string | null }) {
  const t = getT()
  const locale = dateLocale(getLocale())
  const time = updatedAt
    ? new Date(updatedAt).toLocaleString(locale, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Tunis' })
    : null
  return (
    <footer className="page-x mt-14 sm:mt-16">
      <div className="flex flex-col gap-3 border-t border-white/[0.07] pt-6 text-[13px] leading-relaxed text-white/55 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
        <p className="flex max-w-[70ch] items-start gap-2.5">
          <FaYoutube aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-white/70" />
          <span>{t('ttv.footer.note')}</span>
        </p>
        {time && updatedAt && <p className="shrink-0"><time dateTime={updatedAt}>{t('ttv.footer.updated', { time })}</time></p>}
      </div>
    </footer>
  )
}

/** Nothing to show yet: never a dead end. */
export function TvWarmingUp({ channel = false }: { channel?: boolean }) {
  const t = getT()
  return (
    <div className="page-x">
      <div className="relative isolate mx-auto flex max-w-xl flex-col items-center overflow-hidden rounded-stage bg-white/[0.04] px-6 py-12 text-center ring-1 ring-inset ring-white/[0.07] sm:py-14">
        <div aria-hidden className="absolute -top-24 left-1/2 -z-10 h-48 w-72 -translate-x-1/2 rounded-full bg-red-600/20 blur-3xl" />
        <span className="grid h-14 w-14 place-items-center rounded-full bg-white/[0.07] text-white/80">
          <Tv aria-hidden className="h-6 w-6" />
        </span>
        <h2 className="mt-5 text-balance font-display text-[clamp(24px,3vw,32px)] font-extrabold leading-tight text-white">
          {channel ? t('ttv.channel.empty') : t('ttv.empty.title')}
        </h2>
        <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-white/60">{channel ? t('ttv.channel.emptyText') : t('ttv.empty.text')}</p>
        <Button asChild variant="secondary" className="mt-7">
          <Link href={channel ? '/tunisian/tv' : '/tunisian?type=series'}>{channel ? t('ttv.channel.back') : t('ttv.empty.action')}</Link>
        </Button>
      </div>
    </div>
  )
}

/** A channel that has gone quiet, stopped posting, or that YouTube won't give us. */
export function ChannelStatusNote({ channel }: { channel: TvChannelView }) {
  if (channel.status === 'active') return null
  const t = getT()
  const locale = dateLocale(getLocale())
  const date = channel.lastUploadAt ? dayLabel(channel.lastUploadAt, locale) : null
  const content = channel.status === 'unreachable'
    ? { icon: CloudOff, title: t('ttv.channel.unreachable'), text: t('ttv.channel.unreachableText') }
    : channel.status === 'dormant'
      ? { icon: Unplug, title: t('ttv.channel.dormant'), text: date ? t('ttv.channel.dormantText', { date }) : null }
      : { icon: MoonStar, title: t('ttv.channel.quiet'), text: date ? t('ttv.channel.quietText', { date }) : null }
  const Icon = content.icon
  return (
    <div className="page-x">
      <div role="status" className="flex items-start gap-4 rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-inset ring-white/[0.07] sm:p-6">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/[0.07] text-white/75">
          <Icon aria-hidden className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-[18px] font-bold leading-tight text-white">{content.title}</span>
          {content.text && <span className="mt-1 block text-[14px] text-white/60">{content.text}</span>}
        </span>
      </div>
    </div>
  )
}
