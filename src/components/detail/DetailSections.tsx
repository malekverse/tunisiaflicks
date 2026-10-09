"use client"
import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { m } from 'framer-motion'
import { Disc3, ExternalLink } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import { Row, SectionHeader } from '@/src/components/rows/Row'
import { Popover, PopoverContent, PopoverTrigger } from '@/src/components/ui/popover'
import { Drawer, DrawerContent, DrawerTitle } from '@/src/components/ui/drawer'
import { useI18n } from '@/src/components/I18nProvider'
import { useMediaQuery } from '@/src/hooks/use-media-query'
import { countKey, useSeenWith } from '@/src/hooks/use-seen-with'
import type { TKey } from '@/src/lib/i18n'
import { formatDate, languageName, regionName } from '@/src/lib/i18n/format'
import { arabCountryHref, arabCountryName, isArabCountry } from '@/src/lib/arab-countries'
import { soundtrackQuery } from '@/src/lib/listen-links'
import { tween } from '@/src/lib/motion'
import { SeenFan, SeenWithAction } from './SeenWith'
import ListenLinks from './ListenLinks'

/**
 * The cast as a row of portraits, with the character each one plays. "Where have I seen them?"
 * (the header action) puts a little fan of posters on each person you've already watched in
 * something else: a button of its own beside the person's link, never inside it.
 */
export function CastRow({ cast, id, mediaType, mediaId, signedIn }: { cast: any[], id: string, mediaType: 'movie' | 'tv', mediaId: string, signedIn: boolean }) {
    const { t, locale } = useI18n()
    const people = useMemo(() => cast.slice(0, 24), [cast])
    const ids = useMemo(() => Array.from(new Set(people.map((person) => person.id).filter((value): value is number => typeof value === 'number'))), [people])
    const seen = useSeenWith({ people: ids, exclude: `${mediaType}:${mediaId}` })
    if (people.length === 0) return null

    const matched = seen.status === 'ready' ? ids.filter((person) => seen.people[String(person)]?.length).length : 0
    const subtitle = seen.status === 'error'
        ? <span role="status" className="text-red-400">{t('seen.failed')}</span>
        : seen.status === 'loading'
            ? <span role="status">{t('seen.loading')}</span>
            : seen.status === 'ready' && seen.shown
                ? <span role="status">{t(countKey('seen.subtitle', locale, matched), { count: matched })}</span>
                : undefined

    return (
        <section id={id} aria-label={t('detail.cast')} className="scroll-mt-[calc(var(--topbar)+72px)]">
            <SectionHeader
                title={t('detail.cast')}
                subtitle={subtitle}
                end={<SeenWithAction signedIn={signedIn} status={seen.status} shown={seen.shown} onToggle={seen.toggle} />}
            />
            <Row itemClassName="w-[96px] sm:w-[118px]" gap="gap-3 sm:gap-5">
                {people.map((person) => {
                    const titles = seen.shown ? seen.people[String(person.id)] : undefined
                    return (
                        <div key={person.credit_id ?? person.id} className="group/cast relative">
                            <Link href={`/person/${person.id}`} className="group/person block text-center outline-none">
                                <span className="relative mx-auto block aspect-square w-full overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/10 transition-[transform,box-shadow] duration-300 ease-out group-hover/person:-translate-y-1 group-hover/person:ring-white/40 group-focus-visible/person:ring-2 group-focus-visible/person:ring-red-500 group-active/person:scale-[0.97]">
                                    <TmdbImage kind="profile" path={person.profile_path} fallback="/actor.png" alt="" fill sizes="118px" className="object-cover object-[50%_25%]" />
                                </span>
                                <span className="mt-2.5 block truncate text-[13px] font-medium text-white/90"><bdi>{person.name}</bdi></span>
                                {person.character && <span className="block truncate text-[12px] text-white/50"><bdi>{person.character}</bdi></span>}
                            </Link>
                            {titles && titles.length > 0 && (
                                // On the portrait's lower end edge, a sibling of the link.
                                <m.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={tween.base} className="absolute -end-2 top-[56px] sm:top-[74px]">
                                    <SeenFan name={person.name} titles={titles} />
                                </m.div>
                            )}
                        </div>
                    )
                })}
            </Row>
        </section>
    )
}

/** "$63M", "$1.2B": formatted by hand so server and browser (different ICU data) agree. */
function money(value?: number) {
    if (!value) return ''
    const [divisor, suffix] = value >= 1e9 ? [1e9, 'B'] : value >= 1e6 ? [1e6, 'M'] : [1e3, 'K']
    const amount = value / divisor
    return `$${(amount >= 100 ? Math.round(amount) : Math.round(amount * 10) / 10).toString()}${suffix}`
}

const hostname = (url: string) => {
    try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

const STATUS: Record<string, TKey> = {
    'Released': 'detail.status.Released',
    'Returning Series': 'detail.status.ReturningSeries',
    'Ended': 'detail.status.Ended',
    'Canceled': 'detail.status.Canceled',
    'In Production': 'detail.status.InProduction',
    'Post Production': 'detail.status.PostProduction',
    'Planned': 'detail.status.Planned',
    'Rumored': 'detail.status.Rumored',
    'Pilot': 'detail.status.Pilot',
}

const COMPOSER_JOBS = new Set(['Original Music Composer', 'Music', 'Music Score Composer', 'Main Title Theme Composer'])

/** Items with ', ' between them (React nodes, so a country can be a link). */
const joined = (items: React.ReactNode[]) => items.flatMap((item, index) => (index === 0 ? [item] : [<React.Fragment key={`s${index}`}>, </React.Fragment>, item]))

/**
 * "Find the soundtrack": when no album matched but the music has a composer, four searches for
 * it (Deezer, Anghami, Spotify, YouTube Music). A popover with a mouse, a sheet on touch.
 */
function FindSoundtrack({ title, composer }: { title: string, composer: string }) {
    const { t } = useI18n()
    const fine = useMediaQuery('(hover: hover) and (pointer: fine)')
    const [open, setOpen] = useState(false)
    const query = soundtrackQuery(title, composer)
    const trigger = (
        <button type="button" onClick={fine ? undefined : () => setOpen(true)} className="pressable inline-flex h-9 items-center gap-2 rounded-full bg-white/[0.07] px-4 text-[13px] font-medium outline-none transition-colors hover:bg-white/[0.12] focus-visible:ring-2 focus-visible:ring-red-500">
            <Disc3 aria-hidden className="h-4 w-4 opacity-70" />{t('soundtrack.find')}
        </button>
    )
    const body = (
        <>
            <p className="text-[14px] leading-relaxed text-white/70">{t('soundtrack.findText')}</p>
            <ListenLinks query={query} label="search" className="mt-4" />
        </>
    )
    if (!fine) {
        return (
            <>
                {trigger}
                <Drawer open={open} onOpenChange={setOpen}>
                    <DrawerContent aria-describedby={undefined}>
                        <div className="px-5 pb-6 pt-3">
                            <DrawerTitle className="mb-2 font-display text-[20px] font-bold">{t('soundtrack.find')}</DrawerTitle>
                            {body}
                        </div>
                    </DrawerContent>
                </Drawer>
            </>
        )
    }
    return (
        <Popover>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            <PopoverContent role="dialog" aria-label={t('soundtrack.find')} align="start" className="w-[320px] p-5">
                <p className="mb-1.5 font-display text-[18px] font-bold text-white">{t('soundtrack.find')}</p>
                {body}
            </PopoverContent>
        </Popover>
    )
}

/** The facts: dates, people, places, money. The poster sits beside them on wide screens. */
export function DetailsGrid({ kind, data, id, soundtrack = 'unknown', kids = false }: {
    kind: 'movie' | 'tv'
    data: any
    id: string
    /** Whether a soundtrack album was found: 'none' offers the searches instead (not to Kids). */
    soundtrack?: 'found' | 'none' | 'unknown'
    kids?: boolean
}) {
    const { t, locale } = useI18n()
    // An explicit locale (never the runtime default): this renders on the server and in the browser.
    const longDate = (value?: string) => value ? formatDate(value, locale, { day: 'numeric', month: 'long', year: 'numeric' }) : ''
    // Countries and languages named in the viewer's language ('Tunisie', 'الفرنسية'), TMDB's English as a
    // fallback. An Arab country links to its page on the Arab cinema map.
    const countryCodes: string[] = Array.from(new Set<string>((data.production_countries ?? []).map((country: any) => String(country.iso_3166_1 ?? '')).filter(Boolean))).slice(0, 4)
    const countries = countryCodes.map((code) => {
        const lower = code.toLowerCase()
        if (isArabCountry(lower)) {
            return <Link key={code} href={arabCountryHref(lower)} className="rounded-sm underline decoration-white/30 underline-offset-4 outline-none transition-colors hover:decoration-white focus-visible:ring-2 focus-visible:ring-red-500">{arabCountryName(lower, locale)}</Link>
        }
        const name = regionName(code, locale) || (data.production_countries ?? []).find((country: any) => country.iso_3166_1 === code)?.name || code
        return <React.Fragment key={code}>{name}</React.Fragment>
    })
    const languages = (data.spoken_languages ?? []).map((language: any) => languageName(language.iso_639_1, locale) || language.english_name || language.name)
    const crew: any[] = data.credits?.crew ?? []
    const names = (list: any[], limit = 3) => Array.from(new Set(list.map((item) => item.name).filter(Boolean))).slice(0, limit).join(', ')
    const title = data.title || data.name
    const original = data.original_title || data.original_name
    const runtime = kind === 'movie' ? data.runtime : data.episode_run_time?.[0]
    const composers = Array.from(new Set(crew.filter((person) => COMPOSER_JOBS.has(person.job)).map((person) => person.name as string).filter(Boolean))).slice(0, 3)

    const facts: [TKey, React.ReactNode][] = [
        [`detail.originalTitle`, original && original !== title ? <bdi key="o">{original}</bdi> : ''],
        ['detail.status', data.status ? (STATUS[data.status] ? t(STATUS[data.status]) : data.status) : ''],
        [kind === 'movie' ? 'detail.released' : 'detail.firstAired', longDate(kind === 'movie' ? data.release_date : data.first_air_date)],
        ['detail.lastAired', kind === 'tv' && (data.status === 'Ended' || data.status === 'Canceled') ? longDate(data.last_air_date) : ''],
        ['detail.runtime', runtime ? t('detail.minutes', { count: runtime }) : ''],
        ['detail.seasonsEpisodes', kind === 'tv' && data.number_of_seasons ? t('detail.seasonsEpisodesValue', { seasons: data.number_of_seasons, episodes: data.number_of_episodes ?? 0 }) : ''],
        ['detail.director', kind === 'movie' ? names(crew.filter((person) => person.job === 'Director')) : ''],
        ['detail.createdBy', kind === 'tv' ? names(data.created_by ?? []) : ''],
        ['detail.writers', names(crew.filter((person) => person.department === 'Writing'))],
        ['soundtrack.music', composers.join(', ')],
        ['detail.networks', kind === 'tv' ? names(data.networks ?? [], 4) : ''],
        ['detail.studios', names(data.production_companies ?? [], 4)],
        ['detail.countries', countries.length ? joined(countries) : ''],
        ['detail.languages', Array.from(new Set(languages.filter(Boolean))).slice(0, 4).join(', ')],
        ['detail.budget', kind === 'movie' ? money(data.budget) : ''],
        ['detail.revenue', kind === 'movie' ? money(data.revenue) : ''],
    ]
    const shown = facts.filter(([, value]) => value)
    const imdb = data.imdb_id || data.external_ids?.imdb_id
    const findSoundtrack = soundtrack === 'none' && composers.length > 0 && !kids

    return (
        <section id={id} aria-label={t('detail.details')} className="page-x scroll-mt-[calc(var(--topbar)+72px)]">
            <h2 className="mb-5 font-display text-[21px] font-bold sm:text-[26px]">{t('detail.details')}</h2>
            <div className="grid gap-8 md:grid-cols-[200px_1fr] lg:grid-cols-[240px_1fr]">
                {data.poster_path && (
                    <div className="relative isolate hidden self-start md:block">
                        <div aria-hidden className="tf-ambient-glow absolute inset-3 -z-10 rounded-3xl blur-2xl" style={{ background: 'rgb(var(--tf-ambient) / 0.55)' }} />
                        <div className="relative aspect-[2/3] overflow-hidden rounded-poster ring-1 ring-white/10">
                            <TmdbImage kind="poster" path={data.poster_path} alt={t('hero.posterAlt', { title })} fill sizes="240px" className="object-cover" />
                        </div>
                    </div>
                )}
                <div>
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 xl:grid-cols-4">
                        {shown.map(([label, value]) => (
                            <div key={label} className="min-w-0">
                                <dt className="text-[12.5px] text-white/50">{t(label)}</dt>
                                <dd className="mt-1 text-[14.5px] leading-snug text-white/90">{value}</dd>
                            </div>
                        ))}
                    </dl>
                    {(imdb || data.homepage || findSoundtrack) && (
                        <div className="mt-7 flex flex-wrap gap-2">
                            {imdb && (
                                <a href={`https://www.imdb.com/title/${imdb}`} target="_blank" rel="noopener noreferrer" className="pressable inline-flex h-9 items-center gap-2 rounded-full bg-white/[0.07] px-4 text-[13px] font-medium transition-colors hover:bg-white/[0.12]">
                                    IMDb <ExternalLink aria-hidden className="h-3.5 w-3.5 opacity-60" />
                                </a>
                            )}
                            {data.homepage && (
                                <a href={data.homepage} target="_blank" rel="noopener noreferrer" className="pressable inline-flex h-9 max-w-full items-center gap-2 rounded-full bg-white/[0.07] px-4 text-[13px] font-medium transition-colors hover:bg-white/[0.12]">
                                    <span className="truncate">{hostname(data.homepage)}</span>
                                    <ExternalLink aria-hidden className="h-3.5 w-3.5 shrink-0 opacity-60" />
                                </a>
                            )}
                            {findSoundtrack && <FindSoundtrack title={title} composer={composers[0]} />}
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
}
