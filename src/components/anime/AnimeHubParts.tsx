"use client"
import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarDays, LayoutGrid } from 'lucide-react'
import { Row, ROW_WIDTH, SectionHeader } from '@/src/components/rows/Row'
import { useI18n } from '@/src/components/I18nProvider'
import { TITLE_COOKIE, type AnimeCard as Card, type TitleLanguage } from '@/src/lib/anime/model'
import { cn } from '@/src/lib/utils'
import AnimeCard from './AnimeCard'
import { useAnimeProgressList } from './use-anime-progress'

/** "Continue watching": the anime in progress on this device, each on the episode they're on. */
export function ContinueAnime() {
  const { t } = useI18n()
  const list = useAnimeProgressList()
  if (!list.length) return null
  return (
    <section>
      <SectionHeader title={t('anime.row.continue')} />
      <Row itemClassName={ROW_WIDTH.poster} label={t('anime.row.continue')}>
        {list.map((item) => {
          const card: Card = {
            id: item.id, idMal: null, title: item.title, altTitles: [], cover: item.cover, color: item.color, banner: null,
            format: item.format, status: null, episodes: null, next: null, season: null, year: item.year, score: null,
            genres: [], studio: null, description: null, trailer: null,
          }
          return <AnimeCard key={item.id} card={card} badge={t('anime.ep', { episode: item.episode })} />
        })}
      </Row>
    </section>
  )
}

/** Browse, the schedule, and English or romaji titles (a cookie the server reads). */
export function AnimeToolbar({ language }: { language: TitleLanguage }) {
  const { t } = useI18n()
  const router = useRouter()
  const [pending, start] = useTransition()
  const choose = (value: TitleLanguage) => {
    if (value === language) return
    document.cookie = `${TITLE_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`
    start(() => router.refresh())
  }
  return (
    <div className="page-x flex flex-wrap items-center gap-2">
      <Link href="/anime/browse" className="pressable inline-flex h-10 items-center gap-2 rounded-full bg-white/[0.07] px-4 text-[13.5px] font-medium text-white ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.13]">
        <LayoutGrid aria-hidden className="h-4 w-4" />{t('anime.browse.title')}
      </Link>
      <Link href="/anime/schedule" className="pressable inline-flex h-10 items-center gap-2 rounded-full bg-white/[0.07] px-4 text-[13.5px] font-medium text-white ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.13]">
        <CalendarDays aria-hidden className="h-4 w-4" />{t('anime.schedule.title')}
      </Link>
      <div role="radiogroup" aria-label={t('anime.titles.label')} className={cn('ms-auto inline-flex items-center gap-1 rounded-full bg-white/[0.06] p-1 text-[12.5px]', pending && 'opacity-60')}>
        <span className="px-2 text-white/45">{t('anime.titles.label')}</span>
        {(['english', 'romaji'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={language === value}
            onClick={() => choose(value)}
            className={cn('h-8 rounded-full px-3 font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-red-500', language === value ? 'bg-white text-black' : 'text-white/70 hover:text-white')}
          >
            {t(value === 'english' ? 'anime.titles.english' : 'anime.titles.romaji')}
          </button>
        ))}
      </div>
    </div>
  )
}
