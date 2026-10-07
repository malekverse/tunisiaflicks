import PosterCard from '@/src/components/PosterCard'
import routes from '@/src/routes/client/routes'
import { T } from '@/src/components/I18nProvider'

type Kind = 'movie' | 'tv'

export const GRID_CLASS =
  'grid grid-cols-[repeat(auto-fill,minmax(145px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(167px,1fr))] gap-4'

/** Responsive grid of poster cards for a TMDB results array (movies, TV shows, or mixed search results). */
export default function MediaGrid({ items, kind, showTypeBadge, notify }: { items?: any[], kind?: Kind, showTypeBadge?: boolean, notify?: boolean }) {
  const today = new Date().toISOString().slice(0, 10)
  const list = (items ?? []).filter((item) => item && (kind || item.media_type === 'movie' || item.media_type === 'tv'))

  if (list.length === 0) {
    return <p className='text-gray-400 py-10 text-center'><T k='common.nothingToShow' /></p>
  }

  return (
    <div className={GRID_CLASS}>
      {list.map((item) => {
        const itemKind: Kind = kind ?? item.media_type
        const releaseDate: string | undefined = item.release_date || item.first_air_date
        return (
          <div key={`${itemKind}-${item.id}`} className='transition-transform ease-in-out duration-300 hover:scale-105 hover:z-10'>
            <PosterCard
              posterImg={item.poster_path || item.backdrop_path}
              voteAverage={item.vote_average || 0}
              title={item.title || item.name || item.original_title || item.original_name}
              releaseDate={releaseDate}
              mediaType={itemKind}
              showTypeBadge={showTypeBadge}
              notify={notify && itemKind === 'movie' && (!releaseDate || releaseDate > today)}
              link={itemKind === 'tv' ? routes.tvShow(String(item.id)) : routes.movie(String(item.id))}
            />
          </div>
        )
      })}
    </div>
  )
}
