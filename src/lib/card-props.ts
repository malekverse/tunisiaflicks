// PosterCard props for a TMDB movie / show object. Shared by server and client components (no
// "use client" here, so server pages can call it too).
import routes from '@/src/routes/client/routes'

type Kind = 'movie' | 'tv'

export const toRoute = (kind: Kind, id: number | string) => (kind === 'tv' ? routes.tvShow(String(id)) : routes.movie(String(id)))

export function cardProps(item: any, kind: Kind) {
  return {
    id: String(item.id),
    posterImg: item.poster_path as string | null,
    backdropImg: item.backdrop_path as string | null,
    voteAverage: item.vote_average,
    title: (item.title || item.name || item.original_title || item.original_name) as string,
    releaseDate: (item.release_date || item.first_air_date) as string | undefined,
    genreIds: (item.genre_ids ?? item.genres?.map((genre: any) => genre.id)) as number[] | undefined,
    overview: item.overview as string | undefined,
    adult: item.adult as boolean | undefined,
    mediaType: kind,
    link: toRoute(kind, item.id),
  }
}
