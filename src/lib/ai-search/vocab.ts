// The fixed vocabulary of a search plan: genre keys (the model picks from these, never TMDB ids),
// regions, sorts, and their TMDB meaning. Client-safe and dependency-light: the palette and the
// search page decode plans with it.
import { ARAB_TMDB_COUNTRIES } from '@/src/lib/arab-countries'

/** Genre keys and their TMDB genre ids, per kind (null: TMDB has no such genre for that kind). */
export const GENRES = {
  action: { movie: 28, tv: 10759 },
  adventure: { movie: 12, tv: 10759 },
  animation: { movie: 16, tv: 16 },
  comedy: { movie: 35, tv: 35 },
  crime: { movie: 80, tv: 80 },
  documentary: { movie: 99, tv: 99 },
  drama: { movie: 18, tv: 18 },
  family: { movie: 10751, tv: 10751 },
  fantasy: { movie: 14, tv: 10765 },
  history: { movie: 36, tv: null },
  horror: { movie: 27, tv: null },
  music: { movie: 10402, tv: null },
  mystery: { movie: 9648, tv: 9648 },
  romance: { movie: 10749, tv: null },
  scifi: { movie: 878, tv: 10765 },
  thriller: { movie: 53, tv: null },
  war: { movie: 10752, tv: 10768 },
  western: { movie: 37, tv: 37 },
  kids: { movie: null, tv: 10762 },
  reality: { movie: null, tv: 10764 },
  soap: { movie: null, tv: 10766 },
  talk: { movie: null, tv: 10767 },
  news: { movie: null, tv: 10763 },
} as const satisfies Record<string, { movie: number | null, tv: number | null }>

export type GenreKey = keyof typeof GENRES
export const GENRE_KEYS = Object.keys(GENRES) as GenreKey[]
export const isGenreKey = (value: unknown): value is GenreKey => typeof value === 'string' && Object.prototype.hasOwnProperty.call(GENRES, value)

/** The TMDB genre id that names a genre key (for its label): the film one, else the series one. */
export const genreLabelId = (key: GenreKey): number => (GENRES[key].movie ?? GENRES[key].tv) as number

/** Regions a request can name ("Arab films", "Nordic noir"), as TMDB origin countries. */
export const REGIONS = {
  arab: ARAB_TMDB_COUNTRIES,
  maghreb: ['DZ', 'LY', 'MA', 'MR', 'TN'],
  gulf: ['AE', 'BH', 'KW', 'OM', 'QA', 'SA'],
  levant: ['JO', 'LB', 'PS', 'SY'],
  nordic: ['DK', 'FI', 'IS', 'NO', 'SE'],
  latin_america: ['AR', 'BO', 'BR', 'CL', 'CO', 'CR', 'CU', 'DO', 'EC', 'GT', 'MX', 'PE', 'PY', 'UY', 'VE'],
} as const satisfies Record<string, readonly string[]>

export type RegionKey = keyof typeof REGIONS
export const REGION_KEYS = Object.keys(REGIONS) as RegionKey[]
export const isRegionKey = (value: unknown): value is RegionKey => typeof value === 'string' && Object.prototype.hasOwnProperty.call(REGIONS, value)

/** Regions whose films are Arab films (the lower vote floor applies to them). */
export const ARAB_REGIONS: readonly RegionKey[] = ['arab', 'maghreb', 'gulf', 'levant']
const ARAB = new Set<string>(ARAB_TMDB_COUNTRIES)
export const isArabCountryCode = (code: string) => ARAB.has(code.toUpperCase())

/** How results are ordered: relevance (default), best rated, popular, newest, oldest. */
export const SORTS = ['rel', 'top', 'pop', 'new', 'old'] as const
export type SortKey = (typeof SORTS)[number]
export const isSortKey = (value: unknown): value is SortKey => typeof value === 'string' && (SORTS as readonly string[]).includes(value)

/** The model's names for the sorts (clearer in a prompt) and ours. */
export const MODEL_SORTS = { relevance: 'rel', top: 'top', popular: 'pop', new: 'new', old: 'old' } as const satisfies Record<string, SortKey>

/** Hard limits on a plan (the schema, the codec and the prompt all use them). */
export const CAPS = { genres: 3, without: 3, keywords: 4, places: 3, countries: 12, regions: 3, languages: 3, people: 2 } as const

/** Years a plan may name: 1900 to next year. */
export const yearBounds = (now = new Date()) => ({ min: 1900, max: now.getUTCFullYear() + 1 })
export const RUNTIME_BOUNDS = { min: 20, max: 400 } as const
export const RATING_BOUNDS = { min: 5, max: 9 } as const

/**
 * Translations for the TMDB keywords people ask for most, so a chip reads in the viewer's language
 * (the label is chosen by the keyword's TMDB name, which is English). Others show TMDB's name.
 */
export const KEYWORD_LABELS: Record<string, { ar: string, fr: string }> = {
  'time travel': { ar: 'السفر عبر الزمن', fr: 'Voyage dans le temps' },
  'heist': { ar: 'سرقة', fr: 'Casse' },
  'zombie': { ar: 'زومبي', fr: 'Zombies' },
  'vampire': { ar: 'مصاصو دماء', fr: 'Vampires' },
  'superhero': { ar: 'أبطال خارقون', fr: 'Super-héros' },
  'space': { ar: 'الفضاء', fr: 'Espace' },
  'robot': { ar: 'روبوتات', fr: 'Robots' },
  'alien': { ar: 'كائنات فضائية', fr: 'Extraterrestres' },
  'dinosaur': { ar: 'ديناصورات', fr: 'Dinosaures' },
  'serial killer': { ar: 'قاتل متسلسل', fr: 'Tueur en série' },
  'revenge': { ar: 'انتقام', fr: 'Vengeance' },
  'based on true story': { ar: 'مقتبس من قصة حقيقية', fr: 'Inspiré d’une histoire vraie' },
  'based on novel or book': { ar: 'مقتبس من رواية', fr: 'Adapté d’un roman' },
  'world war ii': { ar: 'الحرب العالمية الثانية', fr: 'Seconde Guerre mondiale' },
  'mafia': { ar: 'مافيا', fr: 'Mafia' },
  'christmas': { ar: 'عيد الميلاد', fr: 'Noël' },
  'prison': { ar: 'سجن', fr: 'Prison' },
  'dystopia': { ar: 'ديستوبيا', fr: 'Dystopie' },
  'high school': { ar: 'مدرسة ثانوية', fr: 'Lycée' },
  'coming of age': { ar: 'قصة نضوج', fr: 'Passage à l’âge adulte' },
  'road trip': { ar: 'رحلة برية', fr: 'Road trip' },
  'spy': { ar: 'جواسيس', fr: 'Espionnage' },
  'pirate': { ar: 'قراصنة', fr: 'Pirates' },
  'magic': { ar: 'سحر', fr: 'Magie' },
  'witch': { ar: 'ساحرات', fr: 'Sorcières' },
  'ghost': { ar: 'أشباح', fr: 'Fantômes' },
  'twist ending': { ar: 'نهاية غير متوقعة', fr: 'Fin inattendue' },
  'sports': { ar: 'رياضة', fr: 'Sport' },
  'football (soccer)': { ar: 'كرة القدم', fr: 'Football' },
  'boxing': { ar: 'ملاكمة', fr: 'Boxe' },
  'friendship': { ar: 'صداقة', fr: 'Amitié' },
  'family relationships': { ar: 'علاقات عائلية', fr: 'Relations familiales' },
  'martial arts': { ar: 'فنون قتالية', fr: 'Arts martiaux' },
  'artificial intelligence (a.i.)': { ar: 'ذكاء اصطناعي', fr: 'Intelligence artificielle' },
  'post-apocalyptic future': { ar: 'ما بعد نهاية العالم', fr: 'Post-apocalyptique' },
  'survival': { ar: 'نجاة', fr: 'Survie' },
  'shark': { ar: 'أسماك القرش', fr: 'Requins' },
  'courtroom': { ar: 'قاعة المحكمة', fr: 'Procès' },
  'biography': { ar: 'سيرة ذاتية', fr: 'Biographie' },
  'ramadan': { ar: 'رمضان', fr: 'Ramadan' },
  'desert': { ar: 'الصحراء', fr: 'Désert' },
  'paris, france': { ar: 'باريس', fr: 'Paris' },
  'new york city': { ar: 'نيويورك', fr: 'New York' },
  'london, england': { ar: 'لندن', fr: 'Londres' },
  'tunisia': { ar: 'تونس', fr: 'Tunisie' },
  'europe': { ar: 'أوروبا', fr: 'Europe' },
  'cairo, egypt': { ar: 'القاهرة', fr: 'Le Caire' },
}
