// The share cards of the site's sections (home, Discover, Ramadan...): what a link to one of them
// looks like in WhatsApp or on Facebook. Each card shows a wall of what's on that page today, so
// the preview changes with the trends and the seasons on its own.
import { renderSectionCard, type SectionCard } from '@/src/lib/og'
import { tmdbFetchSafe } from '@/src/lib/tmdb'
import { getTunisianTitles } from '@/src/lib/tunisian'
import { arabRamadanSeries, ramadanSeasons, tunisianRamadanSeries } from '@/src/lib/ramadan'
import { dramaShareSection } from '@/src/lib/dramas'
import { arabCinemaShareSection } from '@/src/lib/arab-cinema'

const posters = (items: any[] | null | undefined, count = 12) =>
  (items ?? []).filter((item) => item.poster_path).slice(0, count).map((item) => `https://image.tmdb.org/t/p/w342${item.poster_path}`)

const list = async (path: string, params: Record<string, string | number> = {}) =>
  posters((await tmdbFetchSafe<{ results: any[] }>(path, params, 21600))?.results)

type Section = Omit<SectionCard, 'posters'> & { posters: () => Promise<string[]> }

export const SHARE_SECTIONS = {
  home: {
    title: 'Your next favourite film',
    subtitle: 'Trending films and shows, Tunisian series, Ramadan hits and trailers, all in one place.',
    cta: 'Start watching',
    posters: () => list('trending/all/day'),
  },
  discover: {
    title: 'Discover',
    subtitle: 'Every movie and show, filtered your way: by genre, year, rating or the time you have tonight.',
    cta: 'Start exploring',
    posters: () => list('movie/popular'),
  },
  tv: {
    title: 'TV shows',
    subtitle: "The shows everyone is watching this week, and the ones worth starting next.",
    cta: 'Browse shows',
    posters: () => list('trending/tv/week'),
  },
  'top-rated': {
    title: 'Top Rated',
    subtitle: 'The highest-rated movies and shows of all time, by thousands of votes.',
    cta: 'See the list',
    posters: () => list('movie/top_rated'),
  },
  upcoming: {
    title: 'Coming soon',
    subtitle: "What reaches cinemas next. Turn on a reminder and we'll tell you when it's out.",
    cta: "See what's next",
    posters: () => list('movie/upcoming', { region: 'US' }),
  },
  clips: {
    title: 'Clips',
    subtitle: "Today's trending trailers, one swipe at a time.",
    cta: 'Watch clips',
    posters: () => list('trending/movie/day'),
  },
  swipe: {
    title: 'Swipe to decide',
    subtitle: "Can't agree on what to watch? Everyone swipes on their own phone, and the first title you all like wins.",
    cta: 'Start a room',
    posters: () => list('movie/popular', { page: 2 }),
  },
  tunisian: {
    title: 'Tunisian Vibes',
    subtitle: 'Series and films made in Tunisia, from Ramadan favourites to the latest releases.',
    cta: 'Watch now',
    emblem: 'tunisia',
    posters: async () => ((await getTunisianTitles()) ?? []).flatMap((title) => (title.poster?.startsWith('http') ? [title.poster] : [])).slice(0, 12),
  },
  'tunisian-tv': {
    title: 'Tunisian TV',
    subtitle: "The official channels' series, shows and live streams, in one place. Free, straight from YouTube.",
    cta: 'Watch now',
    emblem: 'tunisia',
    posters: async () => ((await getTunisianTitles()) ?? []).flatMap((title) => (title.poster?.startsWith('http') ? [title.poster] : [])).slice(12, 24),
  },
  cinema: {
    title: 'Tunisian cinema',
    subtitle: "From the classics of the golden age to today's festival winners: the films, series and faces of Tunisian cinema.",
    cta: 'Explore',
    emblem: 'tunisia',
    posters: () => list('discover/movie', { with_origin_country: 'TN', sort_by: 'popularity.desc' }),
  },
  ramadan: {
    title: 'Ramadan series',
    subtitle: "The biggest TV season of the year: this Ramadan's series, and the Tunisian and Arab hits of past Ramadans.",
    cta: 'Watch now',
    emblem: 'ramadan',
    posters: async () => {
      // This Ramadan's series once it has started, otherwise the last one's.
      const latest = ramadanSeasons(new Date(), 1)[0]
      if (!latest) return []
      const [tunisian, arab] = await Promise.all([tunisianRamadanSeries(latest, 'en', false), arabRamadanSeries(latest, 'en', false)])
      return posters([...tunisian, ...arab])
    },
  },
  wrapped: {
    title: 'Your year in film',
    subtitle: 'Your titles, hours, top genres and watching personality, as a story to share.',
    cta: 'See my year',
    glow: '245 190 80',
    posters: () => list('trending/all/week'),
  },
  'dramas-turkish': dramaShareSection('turkish'),
  'dramas-korean': dramaShareSection('korean'),
  'arab-cinema': arabCinemaShareSection(),
  search: {
    title: 'Find anything',
    subtitle: 'Every movie, show and actor, in English, French and Arabic.',
    cta: 'Search',
    posters: () => list('trending/all/week'),
  },
} satisfies Record<string, Section>

export type ShareSection = keyof typeof SHARE_SECTIONS

export const isShareSection = (value: string): value is ShareSection => Object.prototype.hasOwnProperty.call(SHARE_SECTIONS, value)

export async function renderSection(name: ShareSection) {
  const { posters: load, ...section }: Section = SHARE_SECTIONS[name]
  return renderSectionCard({ ...section, posters: await load().catch(() => []) })
}
