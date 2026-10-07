// TMDB image URLs. TMDB's CDN resizes and serves WebP itself, so we request the right size
// straight from it (no extra hop through an image optimizer, no optimizer quota).
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'

export type TmdbImageKind = 'poster' | 'backdrop' | 'profile' | 'logo' | 'still'

/** The sizes TMDB actually serves for each image type, smallest first, with their pixel widths. */
const SIZES: Record<TmdbImageKind, [size: string, width: number][]> = {
  poster: [['w92', 92], ['w154', 154], ['w185', 185], ['w342', 342], ['w500', 500], ['w780', 780]],
  backdrop: [['w300', 300], ['w780', 780], ['w1280', 1280]],
  // h632 is height-based: ~421px wide for a 2:3 headshot.
  profile: [['w45', 45], ['w185', 185], ['h632', 421]],
  logo: [['w92', 92], ['w154', 154], ['w185', 185], ['w300', 300], ['w500', 500]],
  still: [['w92', 92], ['w185', 185], ['w300', 300]],
}

/** The smallest TMDB size at least `width` pixels wide (or the largest one). */
export function tmdbSize(kind: TmdbImageKind, width: number) {
  const sizes = SIZES[kind]
  return (sizes.find(([, w]) => w >= width) ?? sizes[sizes.length - 1])[0]
}

export function tmdbImageUrl(path: string, kind: TmdbImageKind, width: number) {
  return `${TMDB_IMAGE_BASE}/${tmdbSize(kind, width)}${path}`
}
