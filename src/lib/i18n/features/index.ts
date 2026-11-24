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
import { languages } from './languages'
import { accountSecurity } from './account-security'
import { apps } from './apps'
import { desktop } from './desktop'
import { halal } from './halal'
import { mail } from './mail'
import { anime } from './anime'
import { landing } from './landing'
import { welcome } from './welcome'
import { decide } from './decide'
import { guess } from './guess'
import { taste } from './taste'
import { shows } from './shows'
import { blindDate } from './blind-date'
import { play } from './play'
import { rail } from './rail'
import { calendarFeed } from './calendar-feed'
import { plus } from './plus'
import { plusGift } from './plus-gift'
import { plusFamily } from './plus-family'
import { guessMusic } from './guess-music'
import { challenges } from './challenges'
import { party } from './party'
import { franchise } from './franchise'

const FEATURES = [aiSearch, social, movieNight, sharedLists, badges, dramaHubs, arabMap, tunisianTv, seasons, tvMode, detailExtras, digest, languages, accountSecurity, apps, desktop, halal, mail, anime, landing, welcome, decide, guess, taste, shows, blindDate, play, rail, calendarFeed, plus, plusGift, plusFamily, guessMusic, challenges, party, franchise]

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
  | keyof typeof languages.en
  | keyof typeof accountSecurity.en
  | keyof typeof apps.en
  | keyof typeof desktop.en
  | keyof typeof halal.en
  | keyof typeof mail.en
  | keyof typeof anime.en
  | keyof typeof landing.en
  | keyof typeof welcome.en
  | keyof typeof decide.en
  | keyof typeof guess.en
  | keyof typeof taste.en
  | keyof typeof shows.en
  | keyof typeof blindDate.en
  | keyof typeof play.en
  | keyof typeof rail.en
  | keyof typeof calendarFeed.en
  | keyof typeof plus.en
  | keyof typeof plusGift.en
  | keyof typeof plusFamily.en
  | keyof typeof guessMusic.en
  | keyof typeof challenges.en
  | keyof typeof party.en
  | keyof typeof franchise.en

type Language = 'en' | 'ar' | 'tn' | 'fr'

/** The strings of every feature in one language (what a feature leaves out falls back, see ../index.ts). */
export function featureStrings(language: Language): Record<string, string> {
  return Object.assign({}, ...FEATURES.map((feature) => (feature as Partial<Record<Language, Record<string, string>>>)[language] ?? {}))
}
