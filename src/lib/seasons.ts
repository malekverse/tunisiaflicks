// STUB: implemented by seasons in wave 1; keep the signature
// The calendar, made visible without decorating the shell: the seasonal nav slot (Ramadan, the
// Eids, "Your year"), the one seasonal home banner, and the season's light (the room light's
// default colour on Ramadan, the Eids, New Year and the national days). Pure; never throws.
// `today` is a YYYY-MM-DD date in Africa/Tunis (defaults to today there).
import type { TKey } from '@/src/lib/i18n'

/** Server components can't hand icon components to the client: the nav gets a key (SEASONAL_ICONS in nav.tsx). */
export type SeasonalIconKey = 'moon' | 'flag' | 'year'

export type SeasonalNav = {
  href: string
  label: TKey
  icon: SeasonalIconKey
  /** 'r g b' */
  accent: string
  /** Only shown to signed-in people ("Your year"). */
  signedInOnly?: boolean
}

/** The seasonal item of the nav (WORLD group's last slot), or null out of season. */
export function getSeasonalNav(kids: boolean, today?: string): SeasonalNav | null {
  void kids
  void today
  return null
}

export type SeasonalBannerModel = {
  /** = moments.ts id, or 'your-year' */
  id: string
  occurrence: string
  href: string
  accent: string
  emblem: 'crescent' | 'crescent-star' | 'tunisia' | 'year'
  title: TKey
  titleVars?: Record<string, string | number>
  subtitle?: TKey
  subtitleVars?: Record<string, string | number>
  note?: TKey
  countdown: { at: string; liveWithinMs: number; zeroTitle: TKey; zeroVars?: Record<string, string | number> } | null
}

/** The one seasonal banner of the home page (slot 3), or null. */
export function getSeasonalBanner(o: { kids: boolean; signedIn: boolean; today?: string; now?: Date }): SeasonalBannerModel | null {
  void o
  return null
}

/** Dismissed banners: 'id:occurrence|id:occurrence' (at most 4). A cookie, so a dismissed banner never flashes. */
export const SEASON_DISMISS_COOKIE = 'tf-season-dismissed'

/** The season's light ('r g b' colours), set on <html> by the root layout as data-season and --season-light. */
export type SeasonSkin = { id: string; light: string; glow?: string }

/** Today's season light (Kids get the same: it is only light), or null out of season. */
export function getSeasonSkin(kids: boolean, today?: string): SeasonSkin | null {
  void kids
  void today
  return null
}
