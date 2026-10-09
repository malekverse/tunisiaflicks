"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, m } from 'framer-motion'
import { Check, ChevronDown, Heart, Info, Play, Plus, Share2, Star, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/src/lib/utils'
import { spring } from '@/src/lib/motion'
import { genreNames } from '@/src/lib/genres'
import TmdbImage from '@/src/components/TmdbImage'
import YouTubeBackdrop from '@/src/components/media/YouTubeBackdrop'
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from '@/src/components/ui/drawer'
import { Button } from '@/src/components/ui/button'
import { useI18n } from '@/src/components/I18nProvider'
import { useCanAutoplay } from '@/src/hooks/use-autoplay'
import { fetchTrailerKey } from '@/src/hooks/use-hover-trailer'
import { useLibraryToggle } from '@/src/hooks/use-library-toggle'
import { cancelClose, scheduleClose } from '@/src/hooks/use-peek-trigger'
import { openShare } from '@/src/store/share-sheet'
import { useInLibrary } from '@/src/store/library'
import { usePeek, type PeekItem } from '@/src/store/peek'

const TRAILER_DELAY_MS = 650
/** How long the quick-view sheet takes to slide away (vaul), before the ShareSheet opens. */
const SHEET_CLOSE_MS = 320

const detailHref = (item: PeekItem) => `/${item.kind}/${item.id}`
const playHref = (item: PeekItem) => item.kind === 'tv' ? `/tv/${item.id}?s=1&e=1` : `/movie/${item.id}#streamSection`
const libraryItem = (item: PeekItem) => ({ id: item.id, title: item.title, poster_path: item.poster, media_type: item.kind })

function Meta({ item, className }: { item: PeekItem, className?: string }) {
    const { t, locale } = useI18n()
    const genres = genreNames(item.genreIds, locale)
    return (
        <div className={className}>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-white/75">
                {!!item.rating && item.rating > 0 && (
                    <span className="inline-flex items-center gap-1 font-semibold text-white">
                        <Star aria-hidden className="h-3.5 w-3.5 fill-star text-star" />{item.rating.toFixed(1)}
                    </span>
                )}
                {item.date && <span>{item.date.slice(0, 4)}</span>}
                <span className="rounded-md border border-white/20 px-1.5 py-px text-[11px] leading-4 text-white/70">{item.kind === 'tv' ? t('common.tvShow') : t('common.movie')}</span>
            </p>
            {genres.length > 0 && <p className="mt-1.5 truncate text-[12.5px] text-white/55">{genres.join(' / ')}</p>}
        </div>
    )
}

function RoundAction({ label, active, onClick, children, href }: { label: string, active?: boolean, onClick?: () => void, children: React.ReactNode, href?: string }) {
    const className = cn(
        'pressable grid h-10 w-10 shrink-0 place-items-center rounded-full border outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-red-500',
        active ? 'border-white bg-white text-black' : 'border-white/30 text-white hover:border-white hover:bg-white/10',
    )
    if (href) return <Link href={href} aria-label={label} title={label} className={className}>{children}</Link>
    return <button type="button" aria-label={label} title={label} aria-pressed={active} onClick={onClick} className={className}>{children}</button>
}

function useLibraryActions(item: PeekItem) {
    const toggle = useLibraryToggle()
    const media = { id: item.id, media_type: item.kind }
    const saved = useInLibrary('saved', media)
    const favorite = useInLibrary('favorites', media)
    return {
        saved, favorite,
        toggleSaved: () => toggle('saved', libraryItem(item)),
        toggleFavorite: () => toggle('favorites', libraryItem(item)),
    }
}

/**
 * Desktop: a larger card that grows out of the hovered poster (from its centre), with the
 * backdrop, then the trailer playing muted, and the main actions. Positioned in the viewport and
 * kept inside it; it closes when the pointer leaves it or the page scrolls.
 */
function HoverPreview({ item, rect }: { item: PeekItem, rect: DOMRect }) {
    const { t } = useI18n()
    const autoplay = useCanAutoplay()
    const [trailer, setTrailer] = useState<string | null>(null)
    const [playing, setPlaying] = useState(false)
    const [muted, setMuted] = useState(true)
    const actions = useLibraryActions(item)

    useEffect(() => {
        if (!autoplay) return
        let cancelled = false
        const timer = setTimeout(() => {
            fetchTrailerKey(item.kind, item.id).then((key) => { if (!cancelled) setTrailer(key) })
        }, TRAILER_DELAY_MS)
        return () => {
            cancelled = true
            clearTimeout(timer)
        }
    }, [autoplay, item.kind, item.id])

    const margin = 16
    // Stay clear of the desktop rail (on the start side: left, or right in Arabic).
    const rail = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--rail')) || 0
    const rtl = document.documentElement.dir === 'rtl'
    const minLeft = margin + (rtl ? 0 : rail)
    const maxRight = window.innerWidth - margin - (rtl ? rail : 0)
    const width = Math.min(Math.max(rect.width * 2.05, 300), 380)
    const mediaHeight = (width * 9) / 16
    const estimatedHeight = mediaHeight + 168
    const left = Math.min(Math.max(rect.left + rect.width / 2 - width / 2, minLeft), maxRight - width)
    const top = Math.min(Math.max(rect.top + rect.height * 0.38 - mediaHeight / 2, 76), window.innerHeight - estimatedHeight - margin)
    const origin = `${rect.left + rect.width / 2 - left}px ${rect.top + rect.height / 2 - top}px`

    return (
        <m.div
            role="dialog"
            aria-label={t('peek.preview', { title: item.title })}
            initial={{ opacity: 0, scale: 0.82 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.14 } }}
            transition={spring.ui}
            onPointerEnter={cancelClose}
            onPointerLeave={() => scheduleClose(120)}
            style={{ position: 'fixed', left, top, width, transformOrigin: origin }}
            className="z-[55] overflow-hidden rounded-[18px] bg-[#141416] text-white shadow-[0_30px_80px_-10px_rgb(0_0_0/0.95)] ring-1 ring-white/10"
        >
            <div className="relative aspect-video overflow-hidden bg-white/5">
                <TmdbImage kind="backdrop" path={item.backdrop || item.poster} alt="" fill sizes={`${Math.round(width)}px`} className="object-cover" />
                {trailer && <YouTubeBackdrop videoKey={trailer} loop muted={muted} zoom={1.3} onState={(state) => setPlaying(state === 'playing')} />}
                <div aria-hidden className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#141416] via-[#141416]/40 to-transparent" />
                <p className="absolute bottom-2.5 start-4 end-14 line-clamp-2 font-display text-[22px] font-bold leading-tight drop-shadow-[0_2px_12px_rgb(0_0_0/0.8)]"><bdi>{item.title}</bdi></p>
                <Link href={detailHref(item)} tabIndex={-1} aria-hidden className="absolute inset-0" />
                {playing && (
                    <button
                        type="button"
                        onClick={() => setMuted((value) => !value)}
                        aria-label={muted ? t('billboard.soundOn') : t('billboard.soundOff')}
                        className="pressable absolute bottom-3 end-3 grid h-9 w-9 place-items-center rounded-full border border-white/30 bg-black/40 text-white animate-in fade-in"
                    >
                        {muted ? <VolumeX aria-hidden className="h-4 w-4" /> : <Volume2 aria-hidden className="h-4 w-4" />}
                    </button>
                )}
            </div>
            <div className="p-4 pt-3">
                <div className="flex items-center gap-2">
                    <Link
                        href={playHref(item)}
                        aria-label={t('billboard.play')}
                        title={t('billboard.play')}
                        className="pressable grid h-10 w-10 place-items-center rounded-full bg-white text-black outline-none transition-colors hover:bg-white/85 focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                        <Play aria-hidden className="ms-0.5 h-[18px] w-[18px] fill-current rtl:-scale-x-100" />
                    </Link>
                    <RoundAction label={actions.saved ? t('billboard.inMyList') : t('billboard.myList')} active={actions.saved} onClick={actions.toggleSaved}>
                        {actions.saved ? <Check aria-hidden className="h-[18px] w-[18px]" /> : <Plus aria-hidden className="h-[18px] w-[18px]" />}
                    </RoundAction>
                    <RoundAction label={actions.favorite ? t('peek.unfavorite') : t('peek.favorite')} active={actions.favorite} onClick={actions.toggleFavorite}>
                        <Heart aria-hidden className={cn('h-[17px] w-[17px]', actions.favorite && 'fill-current')} />
                    </RoundAction>
                    <span className="flex-1" />
                    <RoundAction label={t('peek.moreInfo')} href={detailHref(item)}>
                        <ChevronDown aria-hidden className="h-5 w-5" />
                    </RoundAction>
                </div>
                <Meta item={item} className="mt-3.5" />
                {item.overview && <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-white/60">{item.overview}</p>}
            </div>
        </m.div>
    )
}

/** Touch screens: the quick-view sheet after a long press. */
function QuickSheet({ item, onClose }: { item: PeekItem | null, onClose: () => void }) {
    const { t } = useI18n()
    const [shown, setShown] = useState<PeekItem | null>(item)
    useEffect(() => { if (item) setShown(item) }, [item])
    const current = item ?? shown
    const actions = useLibraryActions(current ?? { id: '', kind: 'movie', title: '' })

    // One sheet at a time: this one slides away first, then the ShareSheet comes up.
    const share = () => {
        if (!current) return
        const media = { media_type: current.kind, id: current.id, title: current.title, poster_path: current.poster ?? null }
        onClose()
        setTimeout(() => openShare({ kind: 'title', media }), SHEET_CLOSE_MS)
    }

    return (
        <Drawer open={!!item} onOpenChange={(open) => { if (!open) onClose() }}>
            <DrawerContent>
                {current && (
                    <div className="px-5 pb-6 pt-4">
                        <div className="flex gap-4">
                            <div className="relative aspect-[2/3] w-[104px] shrink-0 overflow-hidden rounded-xl bg-white/5 ring-1 ring-white/10">
                                <TmdbImage kind="poster" path={current.poster} alt="" fill sizes="104px" className="object-cover" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <DrawerTitle className="font-display text-[24px] font-bold leading-tight"><bdi>{current.title}</bdi></DrawerTitle>
                                <Meta item={current} className="mt-2" />
                                <DrawerDescription className="mt-2 line-clamp-4 text-[13px] leading-relaxed text-white/65">{current.overview}</DrawerDescription>
                            </div>
                        </div>
                        <Button asChild size="lg" className="mt-5 w-full">
                            <Link href={playHref(current)} onClick={onClose}><Play aria-hidden className="h-5 w-5 fill-current" />{t('billboard.play')}</Link>
                        </Button>
                        <div className="mt-4 grid grid-cols-4 gap-2 text-center text-[11.5px] text-white/70">
                            {[
                                { label: actions.saved ? t('billboard.inMyList') : t('billboard.myList'), icon: actions.saved ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />, onClick: actions.toggleSaved, active: actions.saved },
                                { label: t('peek.favorite'), icon: <Heart className={cn('h-5 w-5', actions.favorite && 'fill-current text-red-500')} />, onClick: actions.toggleFavorite, active: actions.favorite },
                                { label: t('peek.share'), icon: <Share2 className="h-5 w-5" />, onClick: share },
                            ].map((action) => (
                                <button key={action.label} type="button" onClick={action.onClick} aria-pressed={action.active} className="pressable flex flex-col items-center gap-1.5 rounded-2xl py-2">
                                    <span aria-hidden className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.08] text-white">{action.icon}</span>
                                    {action.label}
                                </button>
                            ))}
                            <Link href={detailHref(current)} onClick={onClose} className="pressable flex flex-col items-center gap-1.5 rounded-2xl py-2">
                                <span aria-hidden className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.08] text-white"><Info className="h-5 w-5" /></span>
                                {t('peek.details')}
                            </Link>
                        </div>
                    </div>
                )}
            </DrawerContent>
        </Drawer>
    )
}

/** Renders whichever peek is open. Mounted once in the root layout. */
export default function PeekLayer() {
    const pathname = usePathname()
    const item = usePeek((state) => state.item)
    const rect = usePeek((state) => state.rect)
    const mode = usePeek((state) => state.mode)
    const close = usePeek((state) => state.close)

    // A new page, a scroll, a resize or Escape put the preview card away.
    useEffect(() => { close() }, [pathname, close])
    useEffect(() => {
        if (mode !== 'hover') return
        const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
        window.addEventListener('scroll', close, { passive: true })
        // Rows scroll sideways without scrolling the window.
        window.addEventListener('wheel', close, { passive: true })
        window.addEventListener('resize', close)
        window.addEventListener('keydown', onKey)
        return () => {
            window.removeEventListener('scroll', close)
            window.removeEventListener('wheel', close)
            window.removeEventListener('resize', close)
            window.removeEventListener('keydown', onKey)
        }
    }, [mode, close])

    return (
        <>
            <AnimatePresence>
                {mode === 'hover' && item && rect && <HoverPreview key={`${item.kind}-${item.id}`} item={item} rect={rect} />}
            </AnimatePresence>
            <QuickSheet item={mode === 'sheet' ? item : null} onClose={close} />
        </>
    )
}
