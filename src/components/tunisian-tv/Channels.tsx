import Link from 'next/link'
import { Radio, Tv } from 'lucide-react'
import LiveDot from '@/src/components/ui/live-dot'
import { Row, SectionHeader } from '@/src/components/rows/Row'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { isArabicScript } from '@/src/lib/i18n/locales'
import { channelName, tvChannelHref, type TvChannelView } from '@/src/lib/tunisian-tv/view'
import ChannelAvatar from './ChannelAvatar'

// The channels, two ways: a small stack of their pictures in the hub's header (a link down to
// the strip), and the strip itself at the end of the hub. Server components.

/** Up to six channel pictures overlapping (the same overlap in Arabic), with a live dot when one is on air. */
export function ChannelStack({ channels }: { channels: TvChannelView[] }) {
  if (channels.length === 0) return null
  const t = getT()
  const arabic = isArabicScript(getLocale())
  const live = channels.some((channel) => channel.live)
  const shown = [...channels].sort((a, b) => Number(!!b.live) - Number(!!a.live)).slice(0, 6)
  return (
    <a
      href="#channels"
      aria-label={t('ttv.seeChannels')}
      className="pressable group inline-flex min-h-11 items-center gap-3 rounded-full bg-white/[0.06] py-1.5 pe-4 ps-1.5 outline-none ring-1 ring-inset ring-white/[0.08] transition-colors hover:bg-white/[0.1] focus-visible:ring-2 focus-visible:ring-red-500"
    >
      <span className="flex items-center [&>*+*]:-ms-2">
        {shown.map((channel) => (
          <span key={channel.slug} title={channelName(channel, arabic)} className="rounded-full ring-2 ring-black">
            <ChannelAvatar channel={channel} size={32} />
          </span>
        ))}
      </span>
      <span className="inline-flex items-center gap-2 text-[13.5px] font-medium text-white/80 group-hover:text-white">
        {live && <LiveDot label={t('ttv.door.liveLabel')} />}
        {t('ttv.seeChannels')}
      </span>
    </a>
  )
}

const CARD_WIDTH = 'w-[64vw] max-w-[250px] sm:w-[232px] sm:max-w-none'

/** Every channel as a card: picture, name, what it is, and how it's doing (on air, quiet...). */
export function ChannelStrip({ channels }: { channels: TvChannelView[] }) {
  if (channels.length === 0) return null
  const t = getT()
  const arabic = isArabicScript(getLocale())
  const title = t('ttv.row.channels')
  return (
    <section id="channels" aria-label={title} className="w-full scroll-mt-24">
      <SectionHeader title={title} />
      <Row label={title} itemClassName={CARD_WIDTH}>
        {channels.map((channel) => {
          const note = channel.live
            ? t('ttv.live')
            : channel.status !== 'active'
              ? t(`ttv.status.${channel.status}` as 'ttv.status.quiet')
              : channel.weekCount > 0
                ? t('ttv.channel.thisWeek', { count: channel.weekCount })
                : null
          const KindIcon = channel.kind === 'radio' ? Radio : Tv
          return (
            <Link
              key={channel.slug}
              href={tvChannelHref(channel.slug)}
              className="pressable group/channel relative flex h-full flex-col gap-4 overflow-hidden rounded-[22px] bg-white/[0.04] p-4 outline-none ring-1 ring-inset ring-white/[0.07] transition-[box-shadow] duration-200 hover:ring-white/[0.16] focus-visible:ring-2 focus-visible:ring-red-500 sm:p-5"
            >
              <span aria-hidden className="pointer-events-none absolute -end-10 -top-12 h-32 w-32 rounded-full opacity-50 blur-2xl transition-opacity duration-300 group-hover/channel:opacity-80" style={{ background: `rgb(${channel.color} / 0.45)` }} />
              <span className="relative flex items-start justify-between gap-3">
                <ChannelAvatar channel={channel} size={56} />
                {channel.live && <LiveDot label={t('ttv.live')} className="mt-1" />}
              </span>
              <span className="relative min-w-0">
                <span dir="auto" className="block truncate font-display text-[19px] font-bold leading-tight text-white">{channelName(channel, arabic)}</span>
                <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-white/55">
                  <span className="inline-flex items-center gap-1.5">
                    <KindIcon aria-hidden className="h-3.5 w-3.5" />
                    {channel.kind === 'radio' ? t('ttv.channel.radio') : t('ttv.channel.tv')}
                  </span>
                  {note && <span className={channel.live ? 'font-semibold text-white' : undefined}>{note}</span>}
                </span>
              </span>
            </Link>
          )
        })}
      </Row>
    </section>
  )
}
