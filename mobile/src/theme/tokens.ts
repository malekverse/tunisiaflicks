// The site's design (docs/DESIGN.md), as the app's tokens: "the screen is the only light in the room".
// True black; pictures are the light; the logo red is the signal light (Play, active, progress), never
// decoration; surfaces are white at low alpha so they take the tint of what's behind them.
import { Platform } from 'react-native'

export const isTV = Platform.isTV

export const colors = {
  black: '#000000',
  /** red-500: accents, rings, the active tab. */
  red: '#FF2414',
  /** red-600: the primary button. */
  redDeep: '#E50F05',
  star: '#FACC15',
  white: '#FFFFFF',
  /** Text: secondary and tertiary. Nothing meant to be read goes below white/50. */
  text2: 'rgba(255,255,255,0.7)',
  text3: 'rgba(255,255,255,0.5)',
  /** Surfaces: card, input/chip, hover/pressed. */
  card: 'rgba(255,255,255,0.04)',
  chip: 'rgba(255,255,255,0.07)',
  pressed: 'rgba(255,255,255,0.12)',
  hairline: 'rgba(255,255,255,0.08)',
  /** Glass chrome (the tab bar, sheets) where blur isn't available. */
  glass: 'rgba(18,18,18,0.82)',
  success: '#6EE7B7',
} as const

/** Radii by hierarchy: posters 10, landscape tiles 14, panels 22, big frames 28; chips and buttons are pills. */
export const radius = { poster: 10, tile: 14, panel: 22, stage: 28, pill: 999 } as const

/** TV screens are read from across the room: everything a size up. */
const tv = (phone: number, tvSize: number) => (isTV ? tvSize : phone)

export const space = {
  /** The page's side gutter. */
  page: tv(16, 48),
  section: tv(30, 40),
  gap: tv(10, 18),
} as const

export const type = {
  pageTitle: tv(34, 52),
  sectionTitle: tv(21, 28),
  body: tv(15, 22),
  small: tv(13, 18),
  tiny: tv(11.5, 16),
} as const

/** Poster widths on rows (the height follows the 2:3 ratio). */
export const sizes = {
  poster: tv(118, 190),
  landscape: tv(250, 360),
  top10: tv(132, 200),
  /** The tab bar's height (phones); pages leave this much room at the bottom. */
  tabBar: 64,
} as const

/** Fonts (loaded in the root layout). Display: the site's condensed Bricolage Grotesque, Alexandria for Arabic. */
export const fonts = {
  text: 'ReadexPro_400Regular',
  textMedium: 'ReadexPro_500Medium',
  textSemibold: 'ReadexPro_600SemiBold',
  textBold: 'ReadexPro_700Bold',
  display: 'TFDisplay-ExtraBold',
  displayBold: 'TFDisplay-Bold',
  displayArabic: 'Alexandria_800ExtraBold',
  displayArabicBold: 'Alexandria_700Bold',
} as const

/** TMDB image sizes for each use. */
export const image = {
  poster: isTV ? 'w342' : 'w342',
  posterLarge: 'w500',
  backdrop: isTV ? 'w1280' : 'w780',
  backdropFull: 'w1280',
  profile: 'w185',
  still: 'w300',
  logo: 'w500',
} as const

export const tmdbImage = (path: string | null | undefined, size: string) => (path ? `https://image.tmdb.org/t/p/${size}${path}` : null)
