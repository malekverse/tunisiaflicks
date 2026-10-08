import SwipeLobby from '@/src/components/swipe/SwipeLobby'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { tmdbFetchSafe, tmdbLanguage } from '@/src/lib/tmdb'
import { getKidsMode } from '@/src/lib/profiles'
import { isGrownUpGenre, kidsDiscoverParams } from '@/src/lib/kids'

export const dynamic = 'force-dynamic'

export function generateMetadata() {
  const t = getT()
  return { title: `${t('swipe.title')} | TunisiaFlicks`, description: t('swipe.subtitle') }
}

export default async function SwipePage() {
  const kids = await getKidsMode()
  const language = tmdbLanguage(getLocale())
  // Three well-known posters for the fan at the top (Kids profiles get kid-safe ones).
  const popular = { sort_by: 'popularity.desc', 'vote_count.gte': 2000, language }
  const [data, discover] = await Promise.all([
    tmdbFetchSafe<{ genres: { id: number, name: string }[] }>('genre/movie/list', { language }, 86400),
    tmdbFetchSafe<{ results: { poster_path: string | null }[] }>('discover/movie', kids ? kidsDiscoverParams('movie', popular) : popular, 86400),
  ])
  const genres = (data?.genres ?? []).filter((genre) => !kids || !isGrownUpGenre(genre.id))
  const posters = (discover?.results ?? []).map((item) => item.poster_path).filter((path): path is string => !!path).slice(0, 3)
  return <SwipeLobby genres={genres} posters={posters} />
}
