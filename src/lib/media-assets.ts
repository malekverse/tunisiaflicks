// Picking the right artwork and video from a TMDB title (pure helpers, safe on server and client).

/** YouTube key of the official trailer (or any trailer, or a teaser). */
export function pickTrailer(videos: any[] = []): string | null {
  const youtube = videos.filter((video) => video.site === 'YouTube' && video.key)
  const trailer = youtube.find((video) => video.type === 'Trailer' && video.official)
    ?? youtube.find((video) => video.type === 'Trailer')
    ?? youtube.find((video) => video.type === 'Teaser')
  return trailer?.key ?? null
}

/** The English (or textless) title-treatment logo, with its width/height ratio. */
export function pickLogo(logos: any[] = []): { path: string, ratio: number } | null {
  const logo = logos.find((item) => item.iso_639_1 === 'en') ?? logos[0]
  return logo ? { path: logo.file_path, ratio: logo.aspect_ratio || 3 } : null
}

