import SwipeLobby from '@/src/components/swipe/SwipeLobby'
import { getLocale, getT } from '@/src/lib/i18n/server'
import { tmdbFetchSafe, tmdbLanguage } from '@/src/lib/tmdb'
import { getKidsMode } from '@/src/lib/profiles'
import { isGrownUpGenre } from '@/src/lib/kids'

export const dynamic = 'force-dynamic'

export function generateMetadata() {
  const t = getT()
  return { title: `${t('swipe.title')} | TunisiaFlicks`, description: t('swipe.subtitle') }
}

export default async function SwipePage() {
  const [kids, data] = await Promise.all([
    getKidsMode(),
    tmdbFetchSafe<{ genres: { id: number, name: string }[] }>('genre/movie/list', { language: tmdbLanguage(getLocale()) }, 86400),
  ])
  const genres = (data?.genres ?? []).filter((genre) => !kids || !isGrownUpGenre(genre.id))
  return <SwipeLobby genres={genres} />
}
