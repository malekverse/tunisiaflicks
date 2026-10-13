// An anime's page: the hero, the player with its episodes (sub or dub), the watch order,
// characters and their voices, recommendations, where to watch it officially, the facts.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import AnimeDetailHero from '@/src/components/anime/AnimeDetailHero'
import AnimeWatch from '@/src/components/anime/AnimeWatch'
import AnimeUnavailable from '@/src/components/anime/AnimeUnavailable'
import { AnimeFacts, AnimeRow, Characters, OfficialLinks, WatchOrder } from '@/src/components/anime/AnimeSections'
import HalalBlocked from '@/src/components/halal/HalalBlocked'
import KidsBlocked from '@/src/components/profiles/KidsBlocked'
import { airedEpisodes } from '@/src/lib/anime/model'
import { animeViewer, getAnimeDetail, type AnimeDetail } from '@/src/lib/anime/server'
import { getT } from '@/src/lib/i18n/server'
import type { TKey } from '@/src/lib/i18n'
import { pageMetadata } from '@/src/lib/seo'

export const dynamic = 'force-dynamic'

type Props = { params: { id: string }, searchParams: { ep?: string } }

const idOf = (value: string) => (/^\d{1,9}$/.test(value) ? Number(value) : null)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = idOf(params.id)
  if (!id) return {}
  const detail = await getAnimeDetail(id, await animeViewer())
  if (!detail || detail.hidden) return {}
  const { card } = detail
  return pageMetadata({
    title: `${card.title}${card.year ? ` (${card.year})` : ''}`,
    description: card.description?.slice(0, 300) ?? undefined,
    path: `/anime/${id}`,
    // The share image comes from ./opengraph-image.tsx.
    card: false,
  })
}

/** "#3 most popular of all time", "#1 highest rated Fall 2026". */
function rankLines(detail: AnimeDetail): string[] {
  const t = getT()
  return detail.ranks
    .filter((rank) => rank.rank <= 100)
    .slice(0, 2)
    .map((rank) => {
      const when = rank.allTime ? t('anime.rank.allTime') : rank.season && rank.year ? `${t(`anime.season.${rank.season}` as TKey)} ${rank.year}` : String(rank.year ?? '')
      return t(/rated/i.test(rank.context) ? 'anime.rank.rated' : 'anime.rank.popular', { rank: rank.rank, when })
    })
}

export default async function AnimePage({ params, searchParams }: Props) {
  const id = idOf(params.id)
  if (!id) notFound()
  const viewer = await animeViewer()
  const detail = await getAnimeDetail(id, viewer)
  if (!detail) return <AnimeUnavailable />
  if (detail.hidden) return viewer.kids ? <KidsBlocked /> : <HalalBlocked />

  const t = getT()
  const { card } = detail
  const aired = airedEpisodes(card)
  const ep = Number(searchParams.ep)
  return (
    <div className="w-full min-w-0 pb-10">
      <AnimeDetailHero card={card} aired={aired} ranks={rankLines(detail)} />
      <div className="space-y-14 pt-10">
        <AnimeWatch card={card} aired={aired} episodeTitles={detail.episodeTitles} initialEpisode={Number.isInteger(ep) && ep > 0 ? ep : null} />
        <WatchOrder relations={detail.relations} />
        <Characters characters={detail.characters} />
        <AnimeRow title={t('anime.section.recs')} cards={detail.recommendations} />
        <OfficialLinks links={detail.links} />
        <AnimeFacts detail={detail} />
      </div>
    </div>
  )
}
