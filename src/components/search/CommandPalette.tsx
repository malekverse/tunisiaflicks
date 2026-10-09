"use client"
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import { ArrowUpRight, Clock, CornerDownLeft, Search, Sparkle, TrendingUp, X } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import { AiMark } from '@/src/components/ai/AiMark'
import { getTrendingSuggestions, searchMovies, type TrendingSuggestion } from '@/src/app/search/actions'
import { aiSearchStatus } from '@/src/app/search/ai-actions'
import { addRecentSearch, clearRecentSearches, getRecentSearches, removeRecentSearch } from '@/src/lib/recent-searches'
import { looksLikeAsk, wordCount } from '@/src/lib/ai-search/normalize'
import { hourlyPrompts } from '@/src/lib/ai-search/prompts'
import { richT } from '@/src/lib/i18n/rich'
import type { TKey } from '@/src/lib/i18n'
import { useI18n } from '@/src/components/I18nProvider'
import { useProfiles } from '@/src/hooks/use-profiles'
import { useTvMode } from '@/src/hooks/use-tv-mode'
import { useSearchPalette } from '@/src/store/search-palette'
import { BrandLoader } from '@/src/components/brand/BrandMark'

const MAX_RESULTS = 8

let trendingCache: Promise<TrendingSuggestion[]> | null = null
/** Whether Ask exists on this site: asked once per page load. */
let askStatus: Promise<{ enabled: boolean }> | null = null

const hrefFor = (item: { media_type: string, id: number | string }) =>
    item.media_type === 'person' ? `/person/${item.id}` : `/${item.media_type === 'tv' ? 'tv' : 'movie'}/${item.id}`

/**
 * The ⌘K / "/" search palette: trending titles and recent searches before typing, then live
 * results (titles and people) as you type. Fully keyboard-driven (cmdk). It opens instantly, with
 * no animation: it's a tool people reach for many times a session.
 *
 * Ask (AI search), when the site has it, for grown-ups, outside TV mode: "Ask: “…”" is the first
 * item when what's typed reads like a description (looksLikeAsk), else the last one from three
 * words (after titles and people, so "the lord of the rings" + Enter still opens the film).
 * Ctrl/⌘ + Enter asks from anywhere; before typing, "Try asking" offers two examples.
 */
export default function CommandPalette() {
    const router = useRouter()
    const { t, dir } = useI18n()
    const open = useSearchPalette((state) => state.open)
    const setOpen = useSearchPalette((state) => state.setOpen)
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [recent, setRecent] = useState<string[]>([])
    const [trending, setTrending] = useState<TrendingSuggestion[]>([])
    const [aiOn, setAiOn] = useState(false)
    const [mac, setMac] = useState(false)
    const trimmed = query.trim()
    const { data: profiles, active } = useProfiles()
    const tv = useTvMode()
    // Kids: the active profile's flag; before one is picked, any Kids profile counts (as on the server).
    const kids = active ? active.kids : !!profiles?.profiles.some((profile) => profile.kids)
    const askOn = aiOn && !kids && !tv

    useEffect(() => {
        if (!open) return
        setRecent(getRecentSearches())
        trendingCache ??= getTrendingSuggestions().catch(() => [])
        trendingCache.then(setTrending)
        askStatus ??= aiSearchStatus().catch(() => ({ enabled: false }))
        askStatus.then((status) => setAiOn(status.enabled))
        setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent))
    }, [open])

    // Debounced search; responses to outdated queries are dropped.
    useEffect(() => {
        if (!trimmed) {
            setResults([])
            setLoading(false)
            return
        }
        let cancelled = false
        setLoading(true)
        const timeout = setTimeout(async () => {
            try {
                const data = await searchMovies(trimmed, false, 1)
                if (cancelled) return
                setResults((data.results ?? [])
                    .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv' || (item.media_type === 'person' && item.profile_path))
                    .slice(0, MAX_RESULTS))
            } catch {
                if (!cancelled) setResults([])
            } finally {
                if (!cancelled) setLoading(false)
            }
        }, 220)
        return () => {
            cancelled = true
            clearTimeout(timeout)
        }
    }, [trimmed])

    const titles = useMemo(() => results.filter((item) => item.media_type !== 'person'), [results])
    const people = useMemo(() => results.filter((item) => item.media_type === 'person'), [results])

    const go = (href: string, remember = trimmed) => {
        if (remember) addRecentSearch(remember)
        setOpen(false)
        setQuery('')
        router.push(href)
    }
    const ask = (question: string) => go(`/search?mode=ask&q=${encodeURIComponent(question)}`, question)

    // Where Ask goes: first when it reads like a description; otherwise last from three words, once
    // the title results are in (so Enter never asks while they load).
    const askFirst = askOn && !!trimmed && looksLikeAsk(trimmed)
    const askLast = askOn && !askFirst && !loading && wordCount(trimmed) >= 3
    const prompts = useMemo(() => (open ? hourlyPrompts(2) : []), [open])

    const row = 'group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 outline-none data-[selected=true]:bg-white/[0.09]'
    const heading = '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-white/50'

    // Same metrics as a title row: a 36x54 slot, the mark centred in it.
    const askItem = (
        <Command.Item value="ask" onSelect={() => ask(trimmed)} className={row}>
            <span className="grid h-[54px] w-9 shrink-0 place-items-center">
                <AiMark size={36} />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block truncate text-start text-[15px]">{richT(t, 'ai.askQuery', { query: trimmed })}</span>
                <span className="block truncate text-xs text-white/50">{t('ai.askQueryHint')}</span>
            </span>
            <CornerDownLeft aria-hidden className="h-4 w-4 shrink-0 text-white/0 transition-colors group-data-[selected=true]:text-white/50 rtl:-scale-x-100" />
        </Command.Item>
    )

    return (
        <Command.Dialog
            open={open}
            onOpenChange={(next) => { setOpen(next); if (!next) setQuery('') }}
            label={t('search.label')}
            shouldFilter={false}
            loop
            overlayClassName="fixed inset-0 z-[70] bg-black/60 backdrop-blur-[2px]"
            contentClassName="fixed inset-x-3 top-[10vh] z-[70] mx-auto max-w-[640px] outline-none"
        >
            <div dir={dir} className="glass-strong overflow-hidden rounded-[22px] text-white shadow-[0_40px_120px_-20px_rgb(0_0_0/0.95)]">
                <div className="flex items-center gap-3 border-b border-white/[0.07] px-4">
                    {loading
                        ? <BrandLoader className="h-5 w-5 shrink-0 text-white/50" />
                        : <Search aria-hidden className="h-5 w-5 shrink-0 text-white/50" />}
                    <Command.Input
                        value={query}
                        onValueChange={setQuery}
                        placeholder={t('search.open')}
                        onKeyDown={(event) => {
                            // Ctrl/⌘ + Enter: ask, whatever is highlighted (cmdk skips a handled key).
                            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                                if (askOn && trimmed && !event.nativeEvent.isComposing) {
                                    event.preventDefault()
                                    ask(trimmed)
                                }
                                return
                            }
                            // Enter with nothing highlighted: open the full results page.
                            if (event.key === 'Enter' && trimmed && !document.querySelector('[cmdk-item][data-selected="true"]')) {
                                go(`/search?q=${encodeURIComponent(trimmed)}`)
                            }
                        }}
                        className="h-16 flex-1 bg-transparent text-lg outline-none placeholder:text-white/50"
                    />
                    <kbd className="hidden rounded-md border border-white/15 px-1.5 py-0.5 font-sans text-[11px] text-white/50 sm:block">esc</kbd>
                </div>

                <Command.List className={`no-scrollbar max-h-[min(60vh,520px)] overflow-y-auto overscroll-contain p-2 ${heading}`}>
                    {trimmed && !loading && results.length === 0 && !askFirst && !askLast && (
                        <Command.Empty className="px-3 py-10 text-center text-sm text-white/55">{t('search.noResultsFor', { query: trimmed })}</Command.Empty>
                    )}

                    {askFirst && askItem}

                    {!trimmed && recent.length > 0 && (
                        <Command.Group heading={t('search.recent')}>
                            {recent.map((entry) => (
                                <Command.Item key={`recent-${entry}`} value={`recent-${entry}`} onSelect={() => setQuery(entry)} className={row}>
                                    <Clock aria-hidden className="h-4 w-4 shrink-0 text-white/45" />
                                    <bdi className="flex-1 truncate text-[15px]">{entry}</bdi>
                                    <button
                                        type="button"
                                        aria-label={t('search.removeRecent', { query: entry })}
                                        onClick={(event) => { event.stopPropagation(); setRecent(removeRecentSearch(entry)) }}
                                        className="grid h-7 w-7 place-items-center rounded-full text-white/40 opacity-0 transition-opacity hover:bg-white/10 hover:text-white group-data-[selected=true]:opacity-100"
                                    >
                                        <X aria-hidden className="h-3.5 w-3.5" />
                                    </button>
                                </Command.Item>
                            ))}
                            <Command.Item value="clear-recent" onSelect={() => setRecent(clearRecentSearches())} className={`${row} text-sm text-white/50`}>
                                <span className="ps-7">{t('search.clearRecent')}</span>
                            </Command.Item>
                        </Command.Group>
                    )}

                    {!trimmed && askOn && prompts.length > 0 && (
                        <Command.Group heading={t('ai.try.title')}>
                            {prompts.map((key) => (
                                <Command.Item key={key} value={key} onSelect={() => ask(t(key as TKey))} className={row}>
                                    <Sparkle aria-hidden className="h-4 w-4 shrink-0 fill-white/50 text-white/50" strokeWidth={1.4} />
                                    <bdi className="flex-1 truncate text-[15px]">{t(key as TKey)}</bdi>
                                </Command.Item>
                            ))}
                        </Command.Group>
                    )}

                    {!trimmed && trending.length > 0 && (
                        <Command.Group heading={t('search.trendingNow')}>
                            {trending.map((item) => (
                                <Command.Item key={`trend-${item.media_type}-${item.id}`} value={`trend-${item.media_type}-${item.id}`} onSelect={() => go(hrefFor(item), '')} className={row}>
                                    <span className="relative h-9 w-16 shrink-0 overflow-hidden rounded-md bg-white/5">
                                        <TmdbImage kind="backdrop" path={item.backdrop_path || item.poster_path} alt="" fill sizes="64px" className="object-cover" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <bdi dir="auto" className="block truncate text-start text-[15px]">{item.title}</bdi>
                                        <span className="flex gap-2 text-xs text-white/50"><span>{item.media_type === 'tv' ? t('common.tvShow') : t('common.movie')}</span>{item.year && <span>{item.year}</span>}</span>
                                    </span>
                                    <TrendingUp aria-hidden className="h-4 w-4 shrink-0 text-white/30" />
                                </Command.Item>
                            ))}
                        </Command.Group>
                    )}

                    {titles.length > 0 && (
                        <Command.Group heading={t('search.titles')}>
                            {titles.map((item) => (
                                <Command.Item key={`${item.media_type}-${item.id}`} value={`${item.media_type}-${item.id}`} onSelect={() => go(hrefFor(item))} className={row}>
                                    <span className="relative h-[54px] w-9 shrink-0 overflow-hidden rounded-md bg-white/5">
                                        <TmdbImage kind="poster" path={item.poster_path || item.backdrop_path} alt="" fill sizes="36px" className="object-cover" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <bdi dir="auto" className="block truncate text-start text-[15px]">{item.title || item.name}</bdi>
                                        <span className="flex gap-2 text-xs text-white/50">
                                            <span>{item.media_type === 'tv' ? t('common.tvShow') : t('common.movie')}</span>
                                            {(item.release_date || item.first_air_date) && <span>{(item.release_date || item.first_air_date).slice(0, 4)}</span>}
                                        </span>
                                    </span>
                                    <CornerDownLeft aria-hidden className="h-4 w-4 shrink-0 text-white/0 transition-colors group-data-[selected=true]:text-white/40 rtl:-scale-x-100" />
                                </Command.Item>
                            ))}
                        </Command.Group>
                    )}

                    {people.length > 0 && (
                        <Command.Group heading={t('search.people')}>
                            {people.map((item) => {
                                const knownFor = (item.known_for ?? []).map((work: any) => work.title || work.name).filter(Boolean).slice(0, 2).join(', ')
                                return (
                                    <Command.Item key={`person-${item.id}`} value={`person-${item.id}`} onSelect={() => go(hrefFor(item))} className={row}>
                                        <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-white/5">
                                            <TmdbImage kind="profile" path={item.profile_path} fallback="/actor.png" alt="" fill sizes="40px" className="object-cover" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <bdi dir="auto" className="block truncate text-start text-[15px]">{item.name}</bdi>
                                            <span className="flex min-w-0 gap-2 text-xs text-white/50">
                                                <span className="shrink-0">{item.known_for_department === 'Directing' ? t('search.director') : t('search.actor')}</span>
                                                {knownFor && <bdi className="truncate">{knownFor}</bdi>}
                                            </span>
                                        </span>
                                    </Command.Item>
                                )
                            })}
                        </Command.Group>
                    )}

                    {askLast && askItem}

                    {trimmed && results.length > 0 && (
                        <Command.Item value="see-all" onSelect={() => go(`/search?q=${encodeURIComponent(trimmed)}`)} className={`${row} mt-1 justify-center text-sm text-white/70`}>
                            {t('search.seeAll', { query: trimmed })}
                            <ArrowUpRight aria-hidden className="h-4 w-4 rtl:-scale-x-100" />
                        </Command.Item>
                    )}
                </Command.List>

                <div className="hidden items-center gap-4 border-t border-white/[0.07] px-4 py-2.5 text-[11px] text-white/50 sm:flex">
                    <span><kbd className="me-1 font-sans">↑↓</kbd>{t('search.navigateHint')}</span>
                    <span><kbd className="me-1 font-sans">↵</kbd>{t('search.selectHint')}</span>
                    <span><kbd className="me-1 font-sans">esc</kbd>{t('search.closeHint')}</span>
                    {askOn && <span className="ms-auto"><kbd className="me-1 font-sans">{mac ? '⌘↵' : 'Ctrl ↵'}</kbd>{t('ai.hint')}</span>}
                </div>
            </div>
        </Command.Dialog>
    )
}
