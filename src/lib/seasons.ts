// The calendar, made visible without decorating the shell: the seasonal nav slot (Ramadan, the
// Eids, "Your year"), the one seasonal home banner, and the season's light (the room light's
// default colour on Ramadan, the Eids, New Year and the national days). Pure; never throws.
// `today` is a YYYY-MM-DD date in Africa/Tunis (defaults to today there).
//
// Built on the same rules as src/lib/moments.ts (ids, weights, accents and who sees what), but
// with the exact days each surface needs: the nav waits for the Eid itself, a national day's
// banner stops on the day. Only lib/hijri is imported, so client components can use the cookie
// helpers below without pulling TMDB into their bundle (tests/seasons.unit.test.mjs checks that
// the two files agree).
import type { TKey } from '@/src/lib/i18n'
import { dateLocale, type Locale } from '@/src/lib/i18n/locales'
import { addDays, daysBetween, DHU_AL_HIJJAH, hijriPeriod, nextHijriPeriod, ramadanOf, SHAWWAL, tunisDate } from '@/src/lib/hijri'

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

/** Dismissed banners: 'id:occurrence|id:occurrence' (at most 4). A cookie, so a dismissed banner never flashes. */
export const SEASON_DISMISS_COOKIE = 'tf-season-dismissed'

/** The season's light ('r g b' colours), set on <html> by the root layout as data-season and --season-light. */
export type SeasonSkin = { id: string; light: string; glow?: string }

// ---------------------------------------------------------------------------------------------
// The calendar.

/** Lantern gold (Ramadan and the Eids), as in moments.ts and the /ramadan hub. */
export const LANTERN = '245 190 80'
/** Champagne (New Year, "Your year"). */
export const CHAMPAGNE = '255 210 120'
/** The flag's red (#E70013): the national days. */
export const FLAG = '231 0 19'
/** The flag's red at low strength, for the room light (on a black page, darker reads as dimmer). */
const FLAG_GLOW = '150 0 12'

const HOUR = 3600000
const DAY = 24 * HOUR
/** A countdown goes live (ticking tiles) within 48 hours of its moment. */
const EVE_MS = 2 * DAY
/** The New Year's countdown is for New Year's Eve only. */
const NEW_YEAR_EVE_MS = DAY
/** Ramadan's banner and nav slot appear 45 days before it (as ramadanStatus and BANNER_DAYS_BEFORE). */
const RAMADAN_LEAD_DAYS = 45

/** The ids of moments.ts this file knows about, with the parts of their rules it relies on. */
export const SEASON_MOMENTS = {
  'ramadan': { weight: 100, kids: true, accent: LANTERN, href: '/ramadan' },
  'eid-al-fitr': { weight: 95, kids: true, accent: LANTERN, href: '/moments/eid-al-fitr' },
  'eid-al-adha': { weight: 95, kids: true, accent: LANTERN, href: '/moments/eid-al-adha' },
  'independence-day': { weight: 80, kids: false, accent: FLAG, href: '/moments/independence-day' },
  'republic-day': { weight: 80, kids: false, accent: FLAG, href: '/moments/republic-day' },
  'womens-day': { weight: 80, kids: false, accent: FLAG, href: '/moments/womens-day' },
  'new-year': { weight: 70, kids: true, accent: CHAMPAGNE, href: '/moments/new-year' },
} as const

export type SeasonMomentId = keyof typeof SEASON_MOMENTS

/** "Your year" (the /wrapped recap): December for the banner, December to mid-January for the nav. */
const YOUR_YEAR = { id: 'your-year', weight: 50, accent: CHAMPAGNE, href: '/wrapped' } as const

/** Tunisia's national days, fixed by law, and the year each one counts from. */
const NATIONAL_DAYS = [
  { id: 'independence-day', day: '03-20', since: 1956, years: 'seasons.independence.years' },
  { id: 'republic-day', day: '07-25', since: 1957, years: 'seasons.republic.years' },
  { id: 'womens-day', day: '08-13', since: 1956, years: 'seasons.womens.years' },
] as const satisfies readonly { id: SeasonMomentId, day: string, since: number, years: TKey }[]

const eidAlFitr = (hijriYear: number) => hijriPeriod(hijriYear, SHAWWAL, 1, 3)
/** The days of Eid al-Adha, 10 to 13 Dhu al-Hijjah. */
const eidAlAdha = (hijriYear: number) => hijriPeriod(hijriYear, DHU_AL_HIJJAH, 10, 4)

const within = (today: string, period: { start: string, end: string }) => today >= period.start && today <= period.end

/** Midnight in Tunis (UTC+1 all year) at the start of a day, as the ISO string countdowns aim at. */
const midnight = (day: string) => `${day}T00:00:00+01:00`

// ---------------------------------------------------------------------------------------------
// Today, and previewing another day in development.

/** A real calendar day written YYYY-MM-DD. */
export function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const time = Date.parse(`${value}T00:00:00Z`)
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value
}

/** Dev only: a cookie that previews the season of another day in this browser (see seasonClock). */
export const SEASONS_TODAY_COOKIE = 'tf-seasons-today'

/**
 * Today in Tunis and the time, or, outside production, another day to preview: the
 * SEASONS_TODAY_COOKIE value when given, else the SEASONS_TODAY environment variable (both
 * YYYY-MM-DD; anything else is ignored). A preview keeps the time of day and moves the date, and
 * `skewMs` says by how much, so a live countdown in the browser can run on the same clock.
 */
export function seasonClock(preview?: string | null, realNow = new Date()): { today: string, now: Date, skewMs: number } {
  const real = tunisDate(realNow)
  let day: string | undefined
  if (process.env.NODE_ENV !== 'production') {
    if (isDay(preview)) day = preview
    else if (isDay(process.env.SEASONS_TODAY)) day = process.env.SEASONS_TODAY
  }
  if (!day || day === real) return { today: real, now: realNow, skewMs: 0 }
  const skewMs = daysBetween(real, day) * DAY
  return { today: day, now: new Date(realNow.getTime() + skewMs), skewMs }
}

/** `today` as given (when valid), else the clock's day; `now` as given, else noon of a given day, else the clock. */
function resolveDay(today?: string, now?: Date): { today: string, now: Date } {
  if (isDay(today)) return { today, now: now ?? new Date(`${today}T12:00:00+01:00`) }
  if (now) return { today: tunisDate(now), now }
  const clock = seasonClock()
  return { today: clock.today, now: clock.now }
}

// ---------------------------------------------------------------------------------------------
// The nav slot.

/** The seasonal item of the nav (WORLD group's last slot), or null out of season. */
export function getSeasonalNav(kids: boolean, today?: string): SeasonalNav | null {
  try {
    const day = resolveDay(today).today
    const found: { weight: number, kids: boolean, nav: SeasonalNav }[] = []

    // Ramadan, from 45 days before (inclusive) until its last day.
    const ramadan = nextHijriPeriod(day, ramadanOf)
    if (daysBetween(day, ramadan.start) <= RAMADAN_LEAD_DAYS && day <= ramadan.end) {
      const { weight, kids: forKids, accent, href } = SEASON_MOMENTS.ramadan
      found.push({ weight, kids: forKids, nav: { href, label: 'nav.ramadan', icon: 'moon', accent } })
    }
    // The Eids themselves: 1 to 3 Shawwal, and from the day of Arafah (9 Dhu al-Hijjah) to 13.
    if (within(day, nextHijriPeriod(day, eidAlFitr))) {
      const { weight, kids: forKids, accent, href } = SEASON_MOMENTS['eid-al-fitr']
      found.push({ weight, kids: forKids, nav: { href, label: 'seasons.nav.eidFitr', icon: 'moon', accent } })
    }
    const adha = nextHijriPeriod(day, eidAlAdha)
    if (within(day, { start: addDays(adha.start, -1), end: adha.end })) {
      const { weight, kids: forKids, accent, href } = SEASON_MOMENTS['eid-al-adha']
      found.push({ weight, kids: forKids, nav: { href, label: 'seasons.nav.eidAdha', icon: 'moon', accent } })
    }
    // "Your year", from 1 December to 15 January (signed-in people only; Kids too).
    const monthDay = day.slice(5)
    if (monthDay >= '12-01' || monthDay <= '01-15') {
      found.push({ weight: YOUR_YEAR.weight, kids: true, nav: { href: YOUR_YEAR.href, label: 'nav.myYear', icon: 'year', accent: YOUR_YEAR.accent, signedInOnly: true } })
    }

    const best = found.filter((entry) => !kids || entry.kids).sort((a, b) => b.weight - a.weight)[0]
    return best?.nav ?? null
  } catch (error) {
    console.error('Seasonal nav failed:', error)
    return null
  }
}

// ---------------------------------------------------------------------------------------------
// The home banner.

type Candidate = { model: SeasonalBannerModel, weight: number, kids: boolean, live: boolean, signedIn?: boolean }

/** A countdown to midnight of `day`, when it is less than `liveWithinMs` away. */
function countdownTo(day: string, now: Date, liveWithinMs: number, zeroTitle: TKey, zeroVars?: Record<string, string | number>): SeasonalBannerModel['countdown'] {
  const left = Date.parse(midnight(day)) - now.getTime()
  return left > 0 && left <= liveWithinMs ? { at: midnight(day), liveWithinMs, zeroTitle, ...(zeroVars ? { zeroVars } : {}) } : null
}

function ramadanCandidate(today: string, now: Date): Candidate | null {
  const ramadan = nextHijriPeriod(today, ramadanOf)
  const daysUntil = daysBetween(today, ramadan.start)
  if (daysUntil > RAMADAN_LEAD_DAYS || today > ramadan.end) return null
  const { weight, kids, accent, href } = SEASON_MOMENTS.ramadan
  const base = { id: 'ramadan', href, accent, emblem: 'crescent' as const }

  if (daysUntil > 0) {
    // (b) The eve, within 48 hours: a live countdown. (a) Before that: when, and around which day.
    const countdown = countdownTo(ramadan.start, now, EVE_MS, 'ramadan.mubarak')
    return {
      weight, kids, live: !!countdown,
      model: {
        ...base,
        occurrence: `${ramadan.start}-${countdown ? 'eve' : 'soon'}`,
        title: 'seasons.ramadan.soon',
        titleVars: { whenDays: daysUntil },
        subtitle: 'ramadan.bannerText',
        // 'Around {date}' takes its date from the occurrence (see noteVars).
        note: countdown ? 'seasons.moon' : 'seasons.around',
        countdown,
      },
    }
  }

  // (c) During Ramadan: the day; in its last three days, when Eid al-Fitr is.
  const day = daysBetween(ramadan.start, today) + 1
  const eid = addDays(ramadan.end, 1)
  const lastDays = daysBetween(today, ramadan.end) <= 2
  return {
    weight, kids, live: true,
    model: {
      ...base,
      occurrence: lastDays ? `${ramadan.start}-eid` : ramadan.start,
      title: 'ramadan.bannerDuring',
      titleVars: { day },
      subtitle: lastDays ? 'seasons.ramadan.eidSoon' : 'ramadan.bannerText',
      ...(lastDays ? { subtitleVars: { whenDays: daysBetween(today, eid) }, note: 'seasons.moon' as const } : {}),
      countdown: lastDays ? countdownTo(eid, now, EVE_MS, 'moment.eid-al-fitr.title') : null,
    },
  }
}

function eidCandidates(today: string, now: Date): Candidate[] {
  const found: Candidate[] = []
  // (d) The days of Eid al-Fitr (its eve belongs to Ramadan's banner).
  const fitr = nextHijriPeriod(today, eidAlFitr)
  if (within(today, fitr)) {
    const { weight, kids, accent, href } = SEASON_MOMENTS['eid-al-fitr']
    found.push({
      weight, kids, live: true,
      model: { id: 'eid-al-fitr', occurrence: fitr.start, href, accent, emblem: 'crescent-star', title: 'moment.eid-al-fitr.title', subtitle: 'moment.eid-al-fitr.blurb', countdown: null },
    })
  }
  // (e) Eid al-Adha: its eve (a countdown), then its days.
  const adha = nextHijriPeriod(today, eidAlAdha)
  const daysUntil = daysBetween(today, adha.start)
  const { weight, kids, accent, href } = SEASON_MOMENTS['eid-al-adha']
  if (daysUntil >= 1 && daysUntil <= 2) {
    found.push({
      weight, kids, live: true,
      model: {
        id: 'eid-al-adha', occurrence: `${adha.start}-eve`, href, accent, emblem: 'crescent-star',
        title: 'seasons.adha.soon', titleVars: { whenDays: daysUntil },
        subtitle: 'moment.eid-al-adha.blurb', note: 'seasons.moon',
        countdown: countdownTo(adha.start, now, EVE_MS, 'moment.eid-al-adha.title'),
      },
    })
  } else if (within(today, adha)) {
    found.push({
      weight, kids, live: true,
      model: { id: 'eid-al-adha', occurrence: adha.start, href, accent, emblem: 'crescent-star', title: 'moment.eid-al-adha.title', subtitle: 'moment.eid-al-adha.blurb', countdown: null },
    })
  }
  return found
}

/** (f) The national days: two days before ('… is in 2 days'), then the day ('71 years of …'). */
function nationalCandidates(today: string): Candidate[] {
  const year = Number(today.slice(0, 4))
  return NATIONAL_DAYS.flatMap(({ id, day, since, years }) => {
    const date = `${year}-${day}`
    const daysUntil = daysBetween(today, date)
    if (daysUntil < 0 || daysUntil > 2) return []
    const { weight, kids, accent, href } = SEASON_MOMENTS[id]
    const onTheDay = daysUntil === 0
    return [{
      weight, kids, live: onTheDay,
      model: {
        id, occurrence: onTheDay ? date : `${date}-soon`, href, accent, emblem: 'tunisia' as const,
        title: onTheDay ? years : 'seasons.national.soon',
        titleVars: onTheDay ? { years: year - since } : { nameKey: `moment.${id}.title`, whenDays: daysUntil },
        subtitle: `moment.${id}.blurb` as TKey,
        countdown: null,
      },
    }]
  })
}

/** New Year's Eve (a countdown to midnight in Tunis) and New Year's Day. */
function newYearCandidate(today: string, now: Date): Candidate | null {
  const monthDay = today.slice(5)
  if (monthDay !== '12-31' && monthDay !== '01-01') return null
  const { weight, kids, accent, href } = SEASON_MOMENTS['new-year']
  const base = { id: 'new-year', href, accent, emblem: 'year' as const }
  if (monthDay === '12-31') {
    const next = Number(today.slice(0, 4)) + 1
    const firstDay = `${next}-01-01`
    return {
      weight, kids, live: true,
      model: {
        ...base, occurrence: `${firstDay}-eve`,
        title: 'seasons.newYear.soon', titleVars: { year: next },
        subtitle: 'moment.new-year.blurb',
        countdown: countdownTo(firstDay, now, NEW_YEAR_EVE_MS, 'seasons.newYear.happy', { year: next }),
      },
    }
  }
  const year = Number(today.slice(0, 4))
  return {
    weight, kids, live: true,
    model: { ...base, occurrence: today, title: 'seasons.newYear.happy', titleVars: { year }, subtitle: 'seasons.newYear.text', countdown: null },
  }
}

/** (g) "Your year", all December, for signed-in people. */
function yourYearCandidate(today: string): Candidate | null {
  if (today.slice(5, 7) !== '12') return null
  return {
    weight: YOUR_YEAR.weight, kids: true, live: false, signedIn: true,
    model: {
      id: YOUR_YEAR.id, occurrence: today.slice(0, 4), href: YOUR_YEAR.href, accent: YOUR_YEAR.accent, emblem: 'year',
      title: 'seasons.year.title', subtitle: 'seasons.year.text', countdown: null,
    },
  }
}

/**
 * The one seasonal banner of the home page (slot 3), or null. Moments of weight 80 and more
 * (Ramadan, the Eids, the national days), New Year's Eve and Day, and "Your year" in December for
 * signed-in people; what is happening now comes before what is coming, then the heavier moment.
 */
export function getSeasonalBanner(o: { kids: boolean; signedIn: boolean; today?: string; now?: Date }): SeasonalBannerModel | null {
  try {
    const { today, now } = resolveDay(o.today, o.now)
    const candidates = [
      ramadanCandidate(today, now),
      ...eidCandidates(today, now),
      ...nationalCandidates(today),
      newYearCandidate(today, now),
      yourYearCandidate(today),
    ].filter((entry): entry is Candidate => entry !== null)
      .filter((entry) => (!o.kids || entry.kids) && (!entry.signedIn || o.signedIn))
      .sort((a, b) => Number(b.live) - Number(a.live) || b.weight - a.weight)
    return candidates[0]?.model ?? null
  } catch (error) {
    console.error('Seasonal banner failed:', error)
    return null
  }
}

/**
 * A moment page's countdown (its eve, like the banner's), or null: Eid al-Fitr and Eid al-Adha
 * within 48 hours, the New Year on New Year's Eve.
 */
export function getMomentCountdown(id: string, today?: string, now?: Date): SeasonalBannerModel['countdown'] {
  try {
    const day = resolveDay(today, now)
    if (id === 'eid-al-fitr') return countdownTo(nextHijriPeriod(day.today, eidAlFitr).start, day.now, EVE_MS, 'moment.eid-al-fitr.title')
    if (id === 'eid-al-adha') return countdownTo(nextHijriPeriod(day.today, eidAlAdha).start, day.now, EVE_MS, 'moment.eid-al-adha.title')
    if (id === 'new-year') {
      const next = Number(day.today.slice(0, 4)) + 1
      return countdownTo(`${next}-01-01`, day.now, NEW_YEAR_EVE_MS, 'seasons.newYear.happy', { year: next })
    }
    return null
  } catch {
    return null
  }
}

/** The emblem of a moment's banner and page header, by moments.ts id. */
export function seasonEmblem(id: string): SeasonalBannerModel['emblem'] | null {
  if (id === 'ramadan') return 'crescent'
  if (id === 'eid-al-fitr' || id === 'eid-al-adha') return 'crescent-star'
  if (id === 'independence-day' || id === 'republic-day' || id === 'womens-day') return 'tunisia'
  if (id === 'new-year' || id === YOUR_YEAR.id) return 'year'
  return null
}

// ---------------------------------------------------------------------------------------------
// The season's light.

/**
 * Today's season light (Kids get the same: it is only light), or null out of season: lantern gold
 * through Ramadan (from its first day) and the days of both Eids, champagne on New Year's Eve and
 * Day, and the flag's red, at low strength (`glow`), on the national days.
 */
export function getSeasonSkin(kids: boolean, today?: string): SeasonSkin | null {
  void kids
  try {
    const day = resolveDay(today).today
    const ramadan = nextHijriPeriod(day, ramadanOf)
    if (within(day, ramadan)) return { id: 'ramadan', light: LANTERN }
    if (within(day, nextHijriPeriod(day, eidAlFitr))) return { id: 'eid-al-fitr', light: LANTERN }
    if (within(day, nextHijriPeriod(day, eidAlAdha))) return { id: 'eid-al-adha', light: LANTERN }
    const national = NATIONAL_DAYS.find((entry) => day.slice(5) === entry.day)
    if (national) return { id: national.id, light: FLAG, glow: FLAG_GLOW }
    if (day.slice(5) === '12-31' || day.slice(5) === '01-01') return { id: 'new-year', light: CHAMPAGNE }
    return null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------------------------
// Words and numbers.

/**
 * A banner's placeholders, ready for t(): `whenDays` (a number of days) becomes `when` ('tomorrow',
 * 'in 45 days', in the viewer's language), `date` (YYYY-MM-DD) becomes '8 February', and `nameKey`
 * becomes `name`, translated.
 */
export function seasonVars(
  vars: Record<string, string | number> | undefined,
  o: { locale: Locale, t: (key: TKey) => string },
): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  const language = dateLocale(o.locale)
  for (const [key, value] of Object.entries(vars ?? {})) {
    if (key === 'whenDays' && typeof value === 'number') {
      out.when = new Intl.RelativeTimeFormat(language ?? 'en', { numeric: 'auto' }).format(value, 'day')
    } else if (key === 'date' && isDay(value)) {
      out.date = new Date(`${value}T12:00:00Z`).toLocaleDateString(language ?? 'en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' })
    } else if (key === 'nameKey' && typeof value === 'string') {
      out.name = o.t(value as TKey)
    } else {
      out[key] = value
    }
  }
  return out
}

/** The vars of a banner's note: 'Around {date}' gets the first day of the moment. */
export function noteVars(model: SeasonalBannerModel): Record<string, string | number> | undefined {
  if (model.note !== 'seasons.around') return undefined
  const start = model.occurrence.slice(0, 10)
  return isDay(start) ? { date: start } : undefined
}

export type CountdownParts = { days: number; hours: number; minutes: number; seconds: number }

/**
 * What a countdown shows `ms` before its moment. Without seconds the minutes round up, so the
 * last minute reads '1 min' rather than '0 min'.
 */
export function countdownParts(ms: number, seconds: boolean): CountdownParts {
  const left = Math.max(0, ms)
  if (seconds) {
    const total = Math.ceil(left / 1000)
    return { days: Math.floor(total / 86400), hours: Math.floor((total % 86400) / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60 }
  }
  const total = Math.ceil(left / 60000)
  return { days: Math.floor(total / 1440), hours: Math.floor((total % 1440) / 60), minutes: total % 60, seconds: 0 }
}

// ---------------------------------------------------------------------------------------------
// Dismissing a banner (one occurrence at a time).

const MAX_DISMISSED = 4

/** The dismissed 'id:occurrence' entries of the cookie's value. */
export function parseDismissed(value: string | null | undefined): string[] {
  if (!value) return []
  let raw = value
  try {
    raw = decodeURIComponent(value)
  } catch {
    // Kept as it is.
  }
  return raw.split('|').map((entry) => entry.trim()).filter((entry) => /^[a-z0-9-]+:[A-Za-z0-9-]+$/.test(entry)).slice(-MAX_DISMISSED)
}

export const dismissalOf = (model: Pick<SeasonalBannerModel, 'id' | 'occurrence'>) => `${model.id}:${model.occurrence}`

/** Whether this occurrence of the banner was dismissed. */
export function isDismissed(value: string | null | undefined, model: Pick<SeasonalBannerModel, 'id' | 'occurrence'>): boolean {
  return parseDismissed(value).includes(dismissalOf(model))
}

/** The cookie's next value: the entry appended (once), the last 4 kept. */
export function withDismissal(value: string | null | undefined, entry: string): string {
  return [...parseDismissed(value).filter((item) => item !== entry), entry].slice(-MAX_DISMISSED).join('|')
}

