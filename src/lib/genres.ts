// TMDB genre ids → names, for places that only get `genre_ids` (cards, previews). Arabic names are
// TMDB's own; Derja uses the Arabic ones. Kept local so a card never waits on a request.
import type { Locale } from '@/src/lib/i18n'

const GENRES: Record<number, { en: string, ar: string }> = {
  28: { en: 'Action', ar: 'أكشن' },
  12: { en: 'Adventure', ar: 'مغامرة' },
  16: { en: 'Animation', ar: 'رسوم متحركة' },
  35: { en: 'Comedy', ar: 'كوميديا' },
  80: { en: 'Crime', ar: 'جريمة' },
  99: { en: 'Documentary', ar: 'وثائقي' },
  18: { en: 'Drama', ar: 'دراما' },
  10751: { en: 'Family', ar: 'عائلي' },
  14: { en: 'Fantasy', ar: 'فانتازيا' },
  36: { en: 'History', ar: 'تاريخ' },
  27: { en: 'Horror', ar: 'رعب' },
  10402: { en: 'Music', ar: 'موسيقى' },
  9648: { en: 'Mystery', ar: 'غموض' },
  10749: { en: 'Romance', ar: 'رومانسية' },
  878: { en: 'Science Fiction', ar: 'خيال علمي' },
  10770: { en: 'TV Movie', ar: 'فيلم تلفزيوني' },
  53: { en: 'Thriller', ar: 'إثارة' },
  10752: { en: 'War', ar: 'حرب' },
  37: { en: 'Western', ar: 'غربي' },
  10759: { en: 'Action & Adventure', ar: 'أكشن ومغامرة' },
  10762: { en: 'Kids', ar: 'أطفال' },
  10763: { en: 'News', ar: 'أخبار' },
  10764: { en: 'Reality', ar: 'واقع' },
  10765: { en: 'Sci-Fi & Fantasy', ar: 'خيال علمي وفانتازيا' },
  10766: { en: 'Soap', ar: 'مسلسل طويل' },
  10767: { en: 'Talk', ar: 'حوارات' },
  10768: { en: 'War & Politics', ar: 'حرب وسياسة' },
}

export function genreNames(ids: number[] | undefined, locale: Locale, limit = 3): string[] {
  const language = locale === 'en' ? 'en' : 'ar'
  return (ids ?? []).map((id) => GENRES[id]?.[language]).filter((name): name is string => !!name).slice(0, limit)
}
