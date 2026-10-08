// TMDB genre ids → names, for places that only get `genre_ids` (cards, previews). Arabic names are
// TMDB's own; Derja uses the Arabic ones. French names are ours, and they win over TMDB's French
// list, which leaves several TV genres in English ('War & Politics', 'Soap', 'Talk'...) and says
// 'Crime' where French says 'Policier'. Kept local so a card never waits on a request.
import { isArabicScript, type Locale } from '@/src/lib/i18n/locales'

const GENRES: Record<number, { en: string, ar: string, fr: string }> = {
  28: { en: 'Action', ar: 'أكشن', fr: 'Action' },
  12: { en: 'Adventure', ar: 'مغامرة', fr: 'Aventure' },
  16: { en: 'Animation', ar: 'رسوم متحركة', fr: 'Animation' },
  35: { en: 'Comedy', ar: 'كوميديا', fr: 'Comédie' },
  80: { en: 'Crime', ar: 'جريمة', fr: 'Policier' },
  99: { en: 'Documentary', ar: 'وثائقي', fr: 'Documentaire' },
  18: { en: 'Drama', ar: 'دراما', fr: 'Drame' },
  10751: { en: 'Family', ar: 'عائلي', fr: 'Familial' },
  14: { en: 'Fantasy', ar: 'فانتازيا', fr: 'Fantastique' },
  36: { en: 'History', ar: 'تاريخ', fr: 'Histoire' },
  27: { en: 'Horror', ar: 'رعب', fr: 'Horreur' },
  10402: { en: 'Music', ar: 'موسيقى', fr: 'Musique' },
  9648: { en: 'Mystery', ar: 'غموض', fr: 'Mystère' },
  10749: { en: 'Romance', ar: 'رومانسية', fr: 'Romance' },
  878: { en: 'Science Fiction', ar: 'خيال علمي', fr: 'Science-fiction' },
  10770: { en: 'TV Movie', ar: 'فيلم تلفزيوني', fr: 'Téléfilm' },
  53: { en: 'Thriller', ar: 'إثارة', fr: 'Thriller' },
  10752: { en: 'War', ar: 'حرب', fr: 'Guerre' },
  37: { en: 'Western', ar: 'غربي', fr: 'Western' },
  10759: { en: 'Action & Adventure', ar: 'أكشن ومغامرة', fr: 'Action et aventure' },
  10762: { en: 'Kids', ar: 'أطفال', fr: 'Enfants' },
  10763: { en: 'News', ar: 'أخبار', fr: 'Actualités' },
  10764: { en: 'Reality', ar: 'واقع', fr: 'Téléréalité' },
  10765: { en: 'Sci-Fi & Fantasy', ar: 'خيال علمي وفانتازيا', fr: 'Science-fiction et fantastique' },
  10766: { en: 'Soap', ar: 'مسلسل طويل', fr: 'Feuilleton' },
  10767: { en: 'Talk', ar: 'حوارات', fr: 'Talk-show' },
  10768: { en: 'War & Politics', ar: 'حرب وسياسة', fr: 'Guerre et politique' },
}

const column = (locale: Locale): 'en' | 'ar' | 'fr' => (locale === 'fr' ? 'fr' : isArabicScript(locale) ? 'ar' : 'en')

export function genreNames(ids: number[] | undefined, locale: Locale, limit = 3): string[] {
  const language = column(locale)
  return (ids ?? []).map((id) => GENRES[id]?.[language]).filter((name): name is string => !!name).slice(0, limit)
}

/**
 * Our own name for a genre when it should replace TMDB's (French only: TMDB's English and Arabic
 * names are kept as they are). Undefined otherwise.
 */
export function localGenreName(id: number, locale: Locale): string | undefined {
  return locale === 'fr' ? GENRES[id]?.fr : undefined
}
