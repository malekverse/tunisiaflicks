// Every feature's strings, one file per feature so features can be built side by side without
// editing the same dictionary; merged into the dictionaries by ../index.ts.
import { aiSearch } from './ai'
import { social } from './social'
import { movieNight } from './movie-night'
import { sharedLists } from './shared-lists'
import { badges } from './badges'
import { dramaHubs } from './drama-hubs'
import { arabMap } from './arab-map'
import { tunisianTv } from './tunisian-tv'
import { seasons } from './seasons'
import { tvMode } from './tv-mode'
import { detailExtras } from './detail-extras'
import { digest } from './digest'

const FEATURES = [aiSearch, social, movieNight, sharedLists, badges, dramaHubs, arabMap, tunisianTv, seasons, tvMode, detailExtras, digest]

export type FeatureKey =
  | keyof typeof aiSearch.en
  | keyof typeof social.en
  | keyof typeof movieNight.en
  | keyof typeof sharedLists.en
  | keyof typeof badges.en
  | keyof typeof dramaHubs.en
  | keyof typeof arabMap.en
  | keyof typeof tunisianTv.en
  | keyof typeof seasons.en
  | keyof typeof tvMode.en
  | keyof typeof detailExtras.en
  | keyof typeof digest.en

type Language = 'en' | 'ar' | 'tn' | 'fr'

/** The strings of every feature in one language (what a feature leaves out falls back, see ../index.ts). */
export function featureStrings(language: Language): Record<string, string> {
  return Object.assign({}, ...FEATURES.map((feature) => (feature as Partial<Record<Language, Record<string, string>>>)[language] ?? {}))
}
