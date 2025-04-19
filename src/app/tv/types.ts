export interface TVShow {
  id: number;
  name: string;
  poster_path: string;
  backdrop_path: string;
  vote_average: number;
  first_air_date: string;
  adult: boolean;
}

export interface TVShowsResponse {
  page: number;
  results: TVShow[];
  total_pages: number;
  total_results: number;
}

export interface TVShowsState {
  trendingTVShows: TVShowsResponse;
  popularTVShows: TVShowsResponse;
  topRatedTVShows: TVShowsResponse;
  onTheAirTVShows: TVShowsResponse;
  airingTodayTVShows: TVShowsResponse;
}