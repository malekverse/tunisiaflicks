"use client"
// "Where have I seen them?" on a title's cast.
// - SeenWithAction: the header action (ScanFace). Signed in, it matches the cast against your own
//   history; for guests it explains itself in a popover with Sign in.
// - SeenFan: on a cast member you've seen elsewhere, a little fan of those posters. It is a button
//   of its own beside the person's link (never inside it). With a mouse, resting on it for a moment
//   shows the titles in a card; on touch, a tap opens them in a sheet.
import { useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Lock, ScanFace } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import { Button } from '@/src/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover'
import { Drawer, DrawerContent, DrawerTitle } from '@/src/components/ui/drawer'
import { useI18n } from '@/src/components/I18nProvider'
import { withCallback } from '@/src/components/auth/links'
import { useMediaQuery } from '@/src/hooks/use-media-query'
import { countKey, type SeenTitle } from '@/src/hooks/use-seen-with'
import { richT } from '@/src/lib/i18n/rich'
import { cn } from '@/src/lib/utils'
import { BrandLoader } from '@/src/components/brand/BrandMark'

const ACTION = 'pressable inline-flex h-11 shrink-0 select-none items-center gap-2 rounded-full px-3 text-[13px] font-medium outline-none transition-[background-color,color,transform] duration-150 ease-out focus-visible:ring-2 focus-visible:ring-red-500'

export function SeenWithAction({ signedIn, status, shown, onToggle }: {
  signedIn: boolean
  status: 'idle' | 'loading' | 'ready' | 'error'
  shown: boolean
  onToggle: () => void
}) {
  const { t } = useI18n()
  const pathname = usePathname()
  const label = shown ? t('seen.hide') : t('seen.button')
  const content = (
    <>
      {status === 'loading' ? <BrandLoader className="h-[18px] w-[18px]" /> : <ScanFace aria-hidden className="h-[18px] w-[18px]" />}
      <span className="hidden sm:inline">{t('seen.button')}</span>
    </>
  )

  if (!signedIn) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" aria-label={t('seen.button')} className={cn(ACTION, 'text-white/70 hover:bg-white/[0.08] hover:text-white')}>{content}</button>
        </PopoverTrigger>
        <PopoverContent role="dialog" aria-label={t('seen.signInTitle')} align="end" className="w-[300px] p-5">
          <p className="font-display text-[18px] font-bold text-white">{t('seen.signInTitle')}</p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-white/70">{t('seen.signInText')}</p>
          <Button asChild className="mt-4 w-full"><Link href={withCallback('/login', `${pathname}#cast`)}>{t('nav.signIn')}</Link></Button>
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={shown}
      aria-label={label}
      aria-busy={status === 'loading'}
      title={label}
      className={cn(ACTION, shown ? 'bg-white/[0.12] text-white' : 'text-white/70 hover:bg-white/[0.08] hover:text-white')}
    >
      {content}
    </button>
  )
}

/** The posters of the titles, spread like a hand of cards (up to three). */
function Fan({ titles }: { titles: SeenTitle[] }) {
  const shown = titles.slice(0, 3)
  const tilt = shown.length === 1 ? [0] : shown.length === 2 ? [-7, 7] : [-10, 0, 10]
  return (
    <span aria-hidden className="flex items-end [&>*+*]:-ms-3">
      {shown.map((title, index) => (
        <span
          key={`${title.media_type}-${title.id}`}
          style={{ transform: `rotate(${tilt[index]}deg)`, zIndex: index }}
          className="relative block h-[33px] w-[22px] overflow-hidden rounded-[4px] bg-white/10 shadow-[0_4px_10px_-2px_rgb(0_0_0/0.8)] ring-2 ring-black transition-transform duration-200 ease-out"
        >
          <TmdbImage kind="poster" path={title.poster_path} alt="" fill sizes="22px" shimmer={false} className="object-cover" />
        </span>
      ))}
    </span>
  )
}

/** The titles (at most four), each a link, and the line saying nobody else sees this. */
function TitleList({ titles, compact }: { titles: SeenTitle[], compact?: boolean }) {
  const { t } = useI18n()
  const rows = titles.slice(0, 4)
  return (
    <>
      <ul className="space-y-1">
        {rows.map((title) => (
          <li key={`${title.media_type}-${title.id}`}>
            <Link href={`/${title.media_type}/${title.id}`} className={cn('flex items-center gap-3 rounded-xl p-1.5 outline-none transition-colors hover:bg-white/[0.07] focus-visible:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-red-500', !compact && 'min-h-[56px]')}>
              <span className="relative h-12 w-8 shrink-0 overflow-hidden rounded-[6px] bg-white/[0.06] ring-1 ring-white/10">
                <TmdbImage kind="poster" path={title.poster_path} alt="" fill sizes="32px" className="object-cover" />
              </span>
              <span className="min-w-0 flex-1">
                <span dir="auto" className="block truncate text-start text-[14px] font-medium text-white">{title.title}</span>
                <span className="mt-0.5 flex gap-3 text-[12.5px] text-white/50">
                  <span>{title.media_type === 'tv' ? t('common.tvShow') : t('common.movie')}</span>
                  {title.year && <span>{title.year}</span>}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {titles.length > rows.length && <p className="mt-1 ps-2 text-[12.5px] text-white/50">{t('seen.moreTitles', { count: titles.length - rows.length })}</p>}
      <p className="mt-3 flex items-center gap-2 border-t border-white/[0.08] pt-3 text-[12.5px] text-white/50">
        <Lock aria-hidden className="h-3.5 w-3.5 shrink-0" />
        {t('seen.lock')}
      </p>
    </>
  )
}

const HOVER_DELAY = 380

export function SeenFan({ name, titles, className }: { name: string, titles: SeenTitle[], className?: string }) {
  const { t, locale } = useI18n()
  const fine = useMediaQuery('(hover: hover) and (pointer: fine)')
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const byHover = useRef(false)
  const label = t(countKey('seen.fan', locale, titles.length), { name, count: titles.length })
  const heading = richT(t, 'seen.in', { name }, { bold: ['name'] })

  const button = (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button
      type="button"
      aria-label={label}
      {...props}
      className={cn('pressable group/fan grid h-11 min-w-11 place-items-center rounded-full px-1 outline-none focus-visible:ring-2 focus-visible:ring-red-500', className)}
    >
      <Fan titles={titles} />
    </button>
  )

  if (!fine) {
    return (
      <>
        {button({ onClick: () => setOpen(true), 'aria-haspopup': 'dialog' })}
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent aria-describedby={undefined}>
            <div className="px-4 pb-5 pt-3">
              <DrawerTitle className="mb-3 px-1.5 text-[16px] font-medium leading-snug text-white/80">{heading}</DrawerTitle>
              <TitleList titles={titles} />
            </div>
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  const enter = () => {
    clearTimeout(timer.current)
    if (open) return
    timer.current = setTimeout(() => {
      byHover.current = true
      setOpen(true)
    }, HOVER_DELAY)
  }
  const leave = () => {
    clearTimeout(timer.current)
    if (!byHover.current) return
    timer.current = setTimeout(() => setOpen(false), 160)
  }

  return (
    <Popover open={open} onOpenChange={(next) => { if (!next) byHover.current = false; setOpen(next) }}>
      <PopoverTrigger asChild>
        {button({
          onPointerEnter: enter,
          onPointerLeave: leave,
          onClick: (event) => {
            clearTimeout(timer.current)
            // Already open from resting the mouse on it: a click pins it open rather than closing it.
            if (open && byHover.current) event.preventDefault()
            byHover.current = false
          },
        })}
      </PopoverTrigger>
      <PopoverContent
        role="dialog"
        aria-label={label}
        side="bottom"
        align="center"
        className="w-[300px] p-3"
        onPointerEnter={() => clearTimeout(timer.current)}
        onPointerLeave={leave}
        // Resting the mouse on it shouldn't move the focus; a click or a key press does.
        onOpenAutoFocus={(event) => { if (byHover.current) event.preventDefault() }}
      >
        <p className="mb-2 px-1.5 text-[13.5px] leading-snug text-white/70">{heading}</p>
        <TitleList titles={titles} compact />
      </PopoverContent>
    </Popover>
  )
}
