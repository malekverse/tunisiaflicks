// The sections under an anime's player (server-safe: no hooks). Watch order, characters and their
// Japanese voices, recommendations, where to watch it officially, and the facts.
import { ExternalLink } from 'lucide-react'
import { Row, SectionHeader } from '@/src/components/rows/Row'
import { getT } from '@/src/lib/i18n/server'
import type { TKey } from '@/src/lib/i18n'
import type { AnimeCard as Card } from '@/src/lib/anime/model'
import type { AnimeCharacter, AnimeDetail, AnimeRelation } from '@/src/lib/anime/server'
import { POSTER_WIDTH } from '@/src/components/dramas/widths'
import AnimeCard from './AnimeCard'

/** A row of anime posters under a heading (nothing when empty). */
export function AnimeRow({ title, subtitle, cards, href, badges, priority }: {
  title: string
  subtitle?: string
  cards: Card[]
  href?: string
  /** A label per card (by id), instead of the usual badge. */
  badges?: Map<number, string>
  priority?: boolean
}) {
  if (!cards.length) return null
  return (
    <section>
      <SectionHeader title={title} subtitle={subtitle} href={href} />
      <Row itemClassName={POSTER_WIDTH} label={title}>
        {cards.map((card, index) => <AnimeCard key={card.id} card={card} badge={badges?.get(card.id)} priority={priority && index < 6} />)}
      </Row>
    </section>
  )
}

const RELATION_ORDER = ['PREQUEL', 'PARENT', 'SEQUEL', 'SIDE_STORY', 'SPIN_OFF', 'ALTERNATIVE', 'SUMMARY', 'COMPILATION', 'CONTAINS', 'CHARACTER', 'OTHER']

/** Prequels first, then the main story, sequels, side stories… each labelled. */
export function WatchOrder({ relations }: { relations: AnimeRelation[] }) {
  const t = getT()
  const sorted = [...relations].sort((a, b) =>
    (RELATION_ORDER.indexOf(a.relation) + 1 || 99) - (RELATION_ORDER.indexOf(b.relation) + 1 || 99) || (a.year ?? 9999) - (b.year ?? 9999))
  const label = (relation: string) => t((RELATION_ORDER.includes(relation) ? `anime.relation.${relation}` : 'anime.relation.OTHER') as TKey)
  return (
    <AnimeRow
      title={t('anime.section.watchOrder')}
      cards={sorted}
      badges={new Map(sorted.map((item) => [item.id, label(item.relation)]))}
    />
  )
}

export function Characters({ characters }: { characters: AnimeCharacter[] }) {
  const t = getT()
  if (!characters.length) return null
  return (
    <section className="page-x">
      <h2 className="mb-4 font-display text-[21px] font-bold text-white sm:text-[26px]">{t('anime.section.characters')}</h2>
      <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {characters.map((character) => (
          <li key={character.id} className="flex items-stretch overflow-hidden rounded-[16px] bg-white/[0.04] ring-1 ring-inset ring-white/[0.07]">
            <div className="flex min-w-0 flex-1 items-center gap-3 p-2">
              {character.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={character.image} alt="" loading="lazy" className="h-16 w-12 shrink-0 rounded-[10px] object-cover" />
              )}
              <div className="min-w-0">
                <p dir="auto" className="truncate text-[14px] font-semibold text-white">{character.name}</p>
                <p className="text-[12px] text-white/45">{t(`anime.role.${character.role}` as TKey)}</p>
              </div>
            </div>
            {character.voice && (
              <div className="flex min-w-0 flex-1 flex-row-reverse items-center gap-3 p-2 text-end">
                {character.voice.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={character.voice.image} alt="" loading="lazy" className="h-16 w-12 shrink-0 rounded-[10px] object-cover" />
                )}
                <div className="min-w-0">
                  <p dir="auto" className="truncate text-[14px] text-white/85">{character.voice.name}</p>
                  <p className="text-[12px] text-white/40">日本語</p>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Where it streams officially (Crunchyroll, Netflix…) and its official site. */
export function OfficialLinks({ links }: { links: AnimeDetail['links'] }) {
  const t = getT()
  if (!links.length) return null
  return (
    <section className="page-x">
      <h2 className="mb-4 font-display text-[21px] font-bold text-white sm:text-[26px]">{t('anime.section.official')}</h2>
      <div className="flex flex-wrap gap-2">
        {links.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="pressable inline-flex h-10 items-center gap-2 rounded-full bg-white/[0.06] px-4 text-[13.5px] font-medium text-white/85 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.12] hover:text-white"
          >
            {link.site}<ExternalLink aria-hidden className="h-3.5 w-3.5 opacity-60" />
          </a>
        ))}
      </div>
    </section>
  )
}

const SOURCES = ['ORIGINAL', 'MANGA', 'LIGHT_NOVEL', 'VISUAL_NOVEL', 'VIDEO_GAME', 'NOVEL', 'WEB_NOVEL']

export function AnimeFacts({ detail }: { detail: AnimeDetail }) {
  const t = getT()
  const { card } = detail
  const facts: [string, string | null][] = [
    [t('anime.info.format'), card.format ? t(`anime.format.${card.format}` as TKey) : null],
    [t('anime.info.episodes'), card.episodes ? String(card.episodes) : null],
    [t('anime.info.duration'), detail.duration ? t('anime.info.minutes', { count: detail.duration }) : null],
    [t('anime.info.status'), card.status ? t(`anime.status.${card.status}` as TKey) : null],
    [t('anime.info.season'), card.season && card.year ? `${t(`anime.season.${card.season}` as TKey)} ${card.year}` : null],
    [t('anime.info.aired'), detail.start ? `${detail.start}${detail.end && detail.end !== detail.start ? ` → ${detail.end}` : ''}` : null],
    [t('anime.info.studio'), card.studio],
    [t('anime.info.source'), detail.source ? t(`anime.source.${SOURCES.includes(detail.source) ? detail.source : 'OTHER'}` as TKey) : null],
    [t('anime.info.fans'), detail.favourites ? detail.favourites.toLocaleString() : null],
    [t('anime.info.also'), detail.synonyms.length ? detail.synonyms.slice(0, 4).join(' · ') : null],
  ]
  return (
    <section className="page-x">
      <h2 className="mb-4 font-display text-[21px] font-bold text-white sm:text-[26px]">{t('anime.section.info')}</h2>
      <dl className="grid gap-x-8 gap-y-4 rounded-[22px] bg-white/[0.04] p-5 ring-1 ring-inset ring-white/[0.07] sm:grid-cols-2 sm:p-7 lg:grid-cols-3">
        {facts.filter(([, value]) => value).map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-[12px] uppercase tracking-wide text-white/40">{label}</dt>
            <dd dir="auto" className="mt-1 text-[14.5px] text-white/85">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
