const routes = {
    home: '/',
    movie: (id: string) => (`/movie/${id}`),
    tvShow: (id: string) => (`/tv/${id}`),
}

export default routes