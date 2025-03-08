export interface Movie {
    id: number
    title: string
    backdrop_path: string
    poster_path: string
    vote_average: number
    release_date: string
    adult: boolean
  }

  export interface MovieResponse {
    results: Movie[]
  }

  export interface MoviesState {
    TrendingMovies?: MovieResponse
    popularMovies?: MovieResponse
    topRatedMovies?: MovieResponse
    nowPlayingMovies?: MovieResponse
    upcomingMovies?: MovieResponse
  }