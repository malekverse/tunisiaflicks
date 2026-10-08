"use client"
import React from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import TmdbImage from '@/src/components/TmdbImage'
import { Row, SectionHeader } from '@/src/components/rows/Row'
import { useI18n } from '@/src/components/I18nProvider'
import type { TKey } from '@/src/lib/i18n'
import { formatDate, languageName, regionName } from '@/src/lib/i18n/format'

/** The cast as a row of portraits, with the character each one plays. */
export function CastRow({ cast, id }: { cast: any[], id: string }) {
    const { t } = useI18n()
    const people = cast.slice(0, 24)
    if (people.length === 0) return null
    return (
        <section id={id} aria-label={t('detail.cast')} className="scroll-mt-[calc(var(--topbar)+72px)]">
            <SectionHeader title={t('detail.cast')} />
            <Row itemClassName="w-[96px] sm:w-[118px]" gap="gap-3 sm:gap-5">
                {people.map((person) => (
                    <Link key={person.credit_id ?? person.id} href={`/person/${person.id}`} className="group/person block text-center outline-none">
                        <span className="relative mx-auto block aspect-square w-full overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/10 transition-[transform,box-shadow] duration-300 ease-out group-hover/person:-translate-y-1 group-hover/person:ring-white/40 group-focus-visible/person:ring-2 group-focus-visible/person:ring-red-500 group-active/person:scale-[0.97]">
                            <TmdbImage kind="profile" path={person.profile_path} fallback="/actor.png" alt="" fill sizes="118px" className="object-cover object-[50%_25%]" />
                        </span>
                        <span className="mt-2.5 block truncate text-[13px] font-medium text-white/90"><bdi>{person.name}</bdi></span>
                        {person.character && <span className="block truncate text-[12px] text-white/50"><bdi>{person.character}</bdi></span>}
                    </Link>
                ))}
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

/** The facts: dates, people, places, money. The poster sits beside them on wide screens. */
export function DetailsGrid({ kind, data, id }: { kind: 'movie' | 'tv', data: any, id: string }) {
    const { t, locale } = useI18n()
    // An explicit locale (never the runtime default): this renders on the server and in the browser.
    const longDate = (value?: string) => value ? formatDate(value, locale, { day: 'numeric', month: 'long', year: 'numeric' }) : ''
    // Countries and languages named in the viewer's language ('Tunisie', 'الفرنسية'), TMDB's English as a fallback.
    const countries = (data.production_countries ?? []).map((country: any) => regionName(country.iso_3166_1, locale) || country.name)
    const languages = (data.spoken_languages ?? []).map((language: any) => languageName(language.iso_639_1, locale) || language.english_name || language.name)
    const crew: any[] = data.credits?.crew ?? []
    const names = (list: any[], limit = 3) => Array.from(new Set(list.map((item) => item.name).filter(Boolean))).slice(0, limit).join(', ')
    const title = data.title || data.name
    const original = data.original_title || data.original_name
    const runtime = kind === 'movie' ? data.runtime : data.episode_run_time?.[0]

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
        ['detail.networks', kind === 'tv' ? names(data.networks ?? [], 4) : ''],
        ['detail.studios', names(data.production_companies ?? [], 4)],
        ['detail.countries', Array.from(new Set(countries.filter(Boolean))).slice(0, 4).join(', ')],
        ['detail.languages', Array.from(new Set(languages.filter(Boolean))).slice(0, 4).join(', ')],
        ['detail.budget', kind === 'movie' ? money(data.budget) : ''],
        ['detail.revenue', kind === 'movie' ? money(data.revenue) : ''],
    ]
    const shown = facts.filter(([, value]) => value)
    const imdb = data.imdb_id || data.external_ids?.imdb_id

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
                    {(imdb || data.homepage) && (
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
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
}
