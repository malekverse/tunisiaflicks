// Unit tests for the seasons track (no server, no database):
//   npm run test:unit
// The calendar of src/lib/seasons.ts (nav slot, home banner, season light), its cookie and
// countdown helpers, and that it agrees with src/lib/moments.ts and src/lib/ramadan.ts.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import {
  SEASON_DISMISS_COOKIE, SEASON_MOMENTS, countdownParts, dismissalOf, getMomentCountdown, getSeasonSkin, getSeasonalBanner,
  getSeasonalNav, isDay, isDismissed, noteVars, parseDismissed, seasonClock, seasonEmblem, seasonVars, withDismissal,
} from '@/src/lib/seasons'

// moments.ts and ramadan.ts reach TMDB through src/lib/tmdb.ts, which Node can't strip (it uses
// TypeScript parameter properties). This test only needs their calendars: stand TMDB in.
const TMDB_STUB = 'export const tmdbFetchSafe = async () => null; export const tmdbFetch = async () => null; export const tmdbLanguage = () => "en-US";'
register(`data:text/javascript,${encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === '@/src/lib/tmdb') return { url: 'data:text/javascript,' + ${JSON.stringify(encodeURIComponent(TMDB_STUB))}, shortCircuit: true }
  return next(specifier, context)
}`)}`)
const { getMoment, momentForKids } = await import('@/src/lib/moments')
const { BANNER_DAYS_BEFORE, ramadanStatus } = await import('@/src/lib/ramadan')

const banner = (today, o = {}) => getSeasonalBanner({ kids: false, signedIn: true, today, ...o })

// ---------------------------------------------------------------------------------------------
// The acceptance table.

test('the table: nav slot and banner through the year', () => {
  const rows = [
    // date, nav href (or null), banner id + occurrence (or null)
    ['2026-10-08', null, null],
    ['2026-12-20', '/wrapped', 'your-year:2026'],
    ['2026-12-25', '/ramadan', 'ramadan:2027-02-08-soon'],
    ['2027-02-07', '/ramadan', 'ramadan:2027-02-08-eve'],
    ['2027-02-20', '/ramadan', 'ramadan:2027-02-08'],
    ['2027-03-07', '/ramadan', 'ramadan:2027-02-08-eid'],
    ['2027-03-09', '/moments/eid-al-fitr', 'eid-al-fitr:2027-03-09'],
    ['2027-03-20', null, 'independence-day:2027-03-20'],
    ['2027-05-15', '/moments/eid-al-adha', 'eid-al-adha:2027-05-16-eve'],
  ]
  for (const [date, nav, expected] of rows) {
    assert.equal(getSeasonalNav(false, date)?.href ?? null, nav, `nav on ${date}`)
    const model = banner(date)
    assert.equal(model ? dismissalOf(model) : null, expected, `banner on ${date}`)
  }
})

test('nav: the items as the shell gets them', () => {
  assert.deepEqual(getSeasonalNav(false, '2026-12-20'), { href: '/wrapped', label: 'nav.myYear', icon: 'year', accent: '255 210 120', signedInOnly: true })
  assert.deepEqual(getSeasonalNav(false, '2026-12-25'), { href: '/ramadan', label: 'nav.ramadan', icon: 'moon', accent: '245 190 80' })
  assert.deepEqual(getSeasonalNav(false, '2027-03-09'), { href: '/moments/eid-al-fitr', label: 'seasons.nav.eidFitr', icon: 'moon', accent: '245 190 80' })
  assert.deepEqual(getSeasonalNav(false, '2027-05-15'), { href: '/moments/eid-al-adha', label: 'seasons.nav.eidAdha', icon: 'moon', accent: '245 190 80' })
})

test('nav: Ramadan from 45 days before (inclusive) to its last day, Eids on their days only', () => {
  // Ramadan 1448: 2027-02-08 to 2027-03-08.
  assert.equal(getSeasonalNav(false, '2026-12-24')?.href, '/wrapped', 'day -46: still Your year')
  assert.equal(getSeasonalNav(false, '2026-12-25')?.href, '/ramadan', 'day -45')
  assert.equal(getSeasonalNav(false, '2027-03-08')?.href, '/ramadan', 'last day of Ramadan')
  assert.equal(getSeasonalNav(false, '2027-03-11')?.href, '/moments/eid-al-fitr', '3 Shawwal')
  assert.equal(getSeasonalNav(false, '2027-03-12'), null, '4 Shawwal')
  assert.equal(getSeasonalNav(false, '2027-05-14'), null, '8 Dhu al-Hijjah: not yet')
  assert.equal(getSeasonalNav(false, '2027-05-19')?.href, '/moments/eid-al-adha', '13 Dhu al-Hijjah')
  assert.equal(getSeasonalNav(false, '2027-05-20'), null, '14 Dhu al-Hijjah')
})

test('nav: Your year runs from 1 December to 15 January, Kids included', () => {
  assert.equal(getSeasonalNav(false, '2026-11-30'), null)
  assert.equal(getSeasonalNav(false, '2026-12-01')?.href, '/wrapped')
  assert.equal(getSeasonalNav(true, '2026-12-01')?.href, '/wrapped')
  assert.equal(getSeasonalNav(false, '2027-01-15')?.href, '/ramadan', 'Ramadan (weight 100) wins in January 2027')
  assert.equal(getSeasonalNav(false, '2028-01-15')?.href, '/ramadan', 'and in January 2028')
  assert.equal(getSeasonalNav(false, '2032-01-15')?.href, '/moments/eid-al-fitr', 'Eid al-Fitr 1453 (weight 95) wins in January 2032')
  assert.equal(getSeasonalNav(false, '2034-01-15')?.href, '/wrapped', 'Ramadan 1455 ended in December 2033: Your year')
  assert.equal(getSeasonalNav(false, '2034-01-16'), null)
})

test('nav: halloween, summer and the national days never take the slot', () => {
  for (const date of ['2026-10-31', '2027-07-25', '2027-08-13', '2027-03-20']) assert.equal(getSeasonalNav(false, date), null, date)
})

test('nav and Kids: the Eids and Ramadan are for everyone', () => {
  assert.equal(getSeasonalNav(true, '2027-02-20')?.href, '/ramadan')
  assert.equal(getSeasonalNav(true, '2027-03-09')?.href, '/moments/eid-al-fitr')
  assert.equal(getSeasonalNav(true, '2027-05-15')?.href, '/moments/eid-al-adha')
})

// ---------------------------------------------------------------------------------------------
// The banner, case by case.

test('banner (a): Ramadan soon, with when and around which day', () => {
  const model = banner('2026-12-25')
  assert.equal(model.title, 'seasons.ramadan.soon')
  assert.deepEqual(model.titleVars, { whenDays: 45 })
  assert.equal(model.subtitle, 'ramadan.bannerText')
  assert.equal(model.note, 'seasons.around')
  assert.deepEqual(noteVars(model), { date: '2027-02-08' })
  assert.equal(model.emblem, 'crescent')
  assert.equal(model.href, '/ramadan')
  assert.equal(model.accent, '245 190 80')
  assert.equal(model.countdown, null)
  assert.equal(banner('2026-12-24', { signedIn: false }), null, '46 days before: nothing')
  assert.equal(banner('2027-02-05').occurrence, '2027-02-08-soon', '3 days before: still soon')
})

test('banner (b): the eve of Ramadan counts down to midnight in Tunis', () => {
  const model = banner('2027-02-07')
  assert.equal(model.title, 'seasons.ramadan.soon')
  assert.deepEqual(model.titleVars, { whenDays: 1 })
  assert.equal(model.note, 'seasons.moon')
  assert.deepEqual(model.countdown, { at: '2027-02-08T00:00:00+01:00', liveWithinMs: 48 * 3600000, zeroTitle: 'ramadan.mubarak' })
  // Two days before, at noon: 36 hours to go, so it is the eve too.
  assert.equal(banner('2027-02-06').occurrence, '2027-02-08-eve')
  // Before midnight two days out, more than 48 hours are left.
  assert.equal(getSeasonalBanner({ kids: false, signedIn: false, now: new Date('2027-02-05T22:00:00Z') }).occurrence, '2027-02-08-soon')
})

test('banner (c): during Ramadan, the day; in its last three days, Eid al-Fitr', () => {
  const day13 = banner('2027-02-20')
  assert.equal(day13.title, 'ramadan.bannerDuring')
  assert.deepEqual(day13.titleVars, { day: 13 })
  assert.equal(day13.subtitle, 'ramadan.bannerText')
  assert.equal(day13.countdown, null)
  assert.equal(banner('2027-02-08').titleVars.day, 1)

  const eidLine = banner('2027-03-07')
  assert.equal(eidLine.title, 'ramadan.bannerDuring')
  assert.deepEqual(eidLine.titleVars, { day: 28 })
  assert.equal(eidLine.subtitle, 'seasons.ramadan.eidSoon')
  assert.deepEqual(eidLine.subtitleVars, { whenDays: 2 })
  assert.equal(eidLine.note, 'seasons.moon')
  assert.deepEqual(eidLine.countdown, { at: '2027-03-09T00:00:00+01:00', liveWithinMs: 48 * 3600000, zeroTitle: 'moment.eid-al-fitr.title' })
  assert.equal(banner('2027-03-06').subtitle, 'seasons.ramadan.eidSoon', 'three days left')
  assert.equal(banner('2027-03-06').countdown, null, 'but more than 48 hours')
  assert.equal(banner('2027-03-05').subtitle, 'ramadan.bannerText', 'four days left')
})

test('banner (d): the days of Eid al-Fitr', () => {
  for (const date of ['2027-03-09', '2027-03-10', '2027-03-11']) {
    const model = banner(date)
    assert.equal(model.id, 'eid-al-fitr', date)
    assert.equal(model.title, 'moment.eid-al-fitr.title')
    assert.equal(model.subtitle, 'moment.eid-al-fitr.blurb')
    assert.equal(model.emblem, 'crescent-star')
    assert.equal(model.href, '/moments/eid-al-fitr')
    assert.equal(model.occurrence, '2027-03-09')
  }
  assert.equal(banner('2027-03-12', { signedIn: false }), null)
})

test('banner (e): Eid al-Adha, its eve then its days', () => {
  const eve = banner('2027-05-15')
  assert.equal(eve.title, 'seasons.adha.soon')
  assert.deepEqual(eve.titleVars, { whenDays: 1 })
  assert.deepEqual(eve.countdown, { at: '2027-05-16T00:00:00+01:00', liveWithinMs: 48 * 3600000, zeroTitle: 'moment.eid-al-adha.title' })
  assert.equal(banner('2027-05-14').occurrence, '2027-05-16-eve', 'two days before')
  assert.equal(banner('2027-05-13', { signedIn: false }), null, 'three days before')
  const day = banner('2027-05-17')
  assert.equal(day.title, 'moment.eid-al-adha.title')
  assert.equal(day.occurrence, '2027-05-16')
  assert.equal(day.countdown, null)
  assert.equal(banner('2027-05-19').id, 'eid-al-adha')
  assert.equal(banner('2027-05-20', { signedIn: false }), null)
})

test('banner (f): the national days, from two days before to the day, never for Kids', () => {
  const soon = banner('2027-03-18')
  assert.equal(soon.id, 'independence-day')
  assert.equal(soon.title, 'seasons.national.soon')
  assert.deepEqual(soon.titleVars, { nameKey: 'moment.independence-day.title', whenDays: 2 })
  assert.equal(soon.occurrence, '2027-03-20-soon')
  assert.equal(soon.emblem, 'tunisia')

  const day = banner('2027-03-20')
  assert.equal(day.title, 'seasons.independence.years')
  assert.deepEqual(day.titleVars, { years: 71 })
  assert.equal(day.subtitle, 'moment.independence-day.blurb')
  assert.equal(day.href, '/moments/independence-day')
  assert.equal(day.accent, '231 0 19')
  assert.equal(banner('2027-03-21', { signedIn: false }), null, 'the day after')
  assert.equal(banner('2027-03-17', { signedIn: false }), null, 'three days before')

  assert.deepEqual(banner('2027-07-25').titleVars, { years: 70 })
  assert.equal(banner('2027-07-25').title, 'seasons.republic.years')
  assert.deepEqual(banner('2027-08-13').titleVars, { years: 71 })
  assert.equal(banner('2027-08-13').title, 'seasons.womens.years')

  for (const date of ['2027-03-18', '2027-03-20', '2027-07-25', '2027-08-13']) {
    assert.equal(getSeasonalBanner({ kids: true, signedIn: true, today: date }), null, `Kids on ${date}`)
  }
})

test('banner (g): Your year, all December, signed in only', () => {
  const model = banner('2026-12-01')
  assert.equal(model.id, 'your-year')
  assert.equal(model.title, 'seasons.year.title')
  assert.equal(model.subtitle, 'seasons.year.text')
  assert.equal(model.href, '/wrapped')
  assert.equal(model.emblem, 'year')
  assert.equal(banner('2026-12-20', { signedIn: false }), null)
  assert.equal(banner('2026-11-30'), null)
  assert.equal(getSeasonalBanner({ kids: true, signedIn: true, today: '2026-12-20' }).id, 'your-year', 'Kids profiles have a year too')
})

test('banner: New Year counts down on the 31st and wishes a happy year on the 1st', () => {
  // 2025-12-31: Ramadan 1447 starts 2026-02-18 (49 days): nothing else but Your year.
  const eve = banner('2025-12-31')
  assert.equal(eve.id, 'new-year')
  assert.equal(eve.title, 'seasons.newYear.soon')
  assert.deepEqual(eve.titleVars, { year: 2026 })
  assert.deepEqual(eve.countdown, { at: '2026-01-01T00:00:00+01:00', liveWithinMs: 24 * 3600000, zeroTitle: 'seasons.newYear.happy', zeroVars: { year: 2026 } })
  assert.equal(eve.occurrence, '2026-01-01-eve')
  const day = banner('2026-01-01')
  assert.equal(day.title, 'seasons.newYear.happy')
  assert.deepEqual(day.titleVars, { year: 2026 })
  assert.equal(day.occurrence, '2026-01-01')
  assert.equal(banner('2026-01-02', { signedIn: false }), null)
  // Happening now beats coming soon: New Year's Eve over "Ramadan in 28 days" (2027-12-31).
  assert.equal(banner('2027-12-31').id, 'new-year')
  assert.equal(getSeasonalBanner({ kids: true, signedIn: false, today: '2025-12-31' }).id, 'new-year', 'Kids too')
})

test('banner: the id is the moments.ts id, and Ramadan outranks Your year in December', () => {
  assert.equal(banner('2026-12-25').id, 'ramadan')
  assert.equal(banner('2026-12-24').id, 'your-year')
})

test('banner and moment pages: the eve countdowns', () => {
  assert.equal(getMomentCountdown('eid-al-fitr', '2027-03-07').at, '2027-03-09T00:00:00+01:00')
  assert.equal(getMomentCountdown('eid-al-fitr', '2027-03-05'), null)
  assert.equal(getMomentCountdown('eid-al-adha', '2027-05-15').at, '2027-05-16T00:00:00+01:00')
  assert.equal(getMomentCountdown('new-year', '2026-12-31').at, '2027-01-01T00:00:00+01:00')
  assert.equal(getMomentCountdown('new-year', '2026-12-30'), null)
  assert.equal(getMomentCountdown('halloween', '2026-10-30'), null)
  assert.equal(seasonEmblem('eid-al-adha'), 'crescent-star')
  assert.equal(seasonEmblem('republic-day'), 'tunisia')
  assert.equal(seasonEmblem('halloween'), null)
})

// ---------------------------------------------------------------------------------------------
// The season's light.

test('skin: Ramadan from its first day, the Eids, New Year and the national days', () => {
  const rows = [
    ['2026-12-25', null],
    ['2027-02-07', null],
    ['2027-02-08', 'ramadan'],
    ['2027-03-08', 'ramadan'],
    ['2027-03-09', 'eid-al-fitr'],
    ['2027-03-12', null],
    ['2027-03-20', 'independence-day'],
    ['2027-05-15', null],
    ['2027-05-16', 'eid-al-adha'],
    ['2027-05-19', 'eid-al-adha'],
    ['2027-07-25', 'republic-day'],
    ['2027-08-13', 'womens-day'],
    ['2026-12-31', 'new-year'],
    ['2027-01-01', 'new-year'],
    ['2027-01-02', null],
    ['2026-10-31', null],
  ]
  for (const [date, id] of rows) assert.equal(getSeasonSkin(false, date)?.id ?? null, id, date)
  assert.deepEqual(getSeasonSkin(false, '2027-02-20'), { id: 'ramadan', light: '245 190 80' })
  assert.deepEqual(getSeasonSkin(false, '2027-01-01'), { id: 'new-year', light: '255 210 120' })
  const flag = getSeasonSkin(false, '2027-03-20')
  assert.equal(flag.light, '231 0 19')
  assert.ok(flag.glow && flag.glow.split(' ').map(Number).every((value, index) => value <= [231, 0, 19][index]), 'the flag glows dimmer than its colour')
  // Kids get the same light.
  assert.deepEqual(getSeasonSkin(true, '2027-03-20'), flag)
  // Eid al-Fitr 1447 fell on Independence Day 2026: the Eid wins.
  assert.equal(getSeasonSkin(false, '2026-03-20').id, 'eid-al-fitr')
})

// ---------------------------------------------------------------------------------------------
// Today, and the dev preview.

test('SEASONS_TODAY previews another day outside production, and only a real day', () => {
  const saved = { today: process.env.SEASONS_TODAY, env: process.env.NODE_ENV }
  try {
    process.env.NODE_ENV = 'development'
    process.env.SEASONS_TODAY = '2027-02-20'
    assert.equal(getSeasonalNav(false)?.href, '/ramadan')
    assert.equal(getSeasonSkin(false)?.id, 'ramadan')
    assert.deepEqual(getSeasonalBanner({ kids: false, signedIn: false }).titleVars, { day: 13 })
    assert.equal(getSeasonalNav(false, '2026-10-08'), null, 'an explicit day wins')

    const real = new Date('2026-10-08T10:30:00Z')
    const clock = seasonClock(undefined, real)
    assert.equal(clock.today, '2027-02-20')
    assert.equal(clock.now.toISOString(), '2027-02-20T10:30:00.000Z', 'same time of day, another date')
    assert.equal(clock.skewMs, clock.now.getTime() - real.getTime())
    assert.equal(seasonClock('2027-05-15', real).today, '2027-05-15', 'the preview cookie wins over the variable')

    process.env.SEASONS_TODAY = '2027-02-30'
    assert.equal(seasonClock(undefined, real).today, '2026-10-08', 'not a real day: ignored')
    assert.equal(seasonClock('soon', real).skewMs, 0)

    process.env.NODE_ENV = 'production'
    process.env.SEASONS_TODAY = '2027-02-20'
    assert.deepEqual(seasonClock('2027-05-15', real), { today: '2026-10-08', now: real, skewMs: 0 }, 'never in production')
  } finally {
    if (saved.today === undefined) delete process.env.SEASONS_TODAY
    else process.env.SEASONS_TODAY = saved.today
    if (saved.env === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = saved.env
  }
})

test('isDay: YYYY-MM-DD and a real date', () => {
  for (const value of ['2027-02-08', '2028-02-29']) assert.equal(isDay(value), true, value)
  for (const value of ['2027-02-29', '2027-13-01', '27-02-08', '2027-2-8', '', null, undefined, 20270208]) assert.equal(isDay(value), false, String(value))
})

// ---------------------------------------------------------------------------------------------
// Dismissal.

test('dismissal: one occurrence at a time, the last four kept', () => {
  assert.equal(SEASON_DISMISS_COOKIE, 'tf-season-dismissed')
  const soon = banner('2026-12-25')
  const day13 = banner('2027-02-20')
  let value = withDismissal(undefined, dismissalOf(soon))
  assert.equal(value, 'ramadan:2027-02-08-soon')
  assert.equal(isDismissed(value, soon), true)
  assert.equal(isDismissed(value, banner('2027-01-10')), true, 'the same occurrence, weeks later')
  assert.equal(isDismissed(value, banner('2027-02-07')), false, 'the eve is a new occurrence')
  assert.equal(isDismissed(value, day13), false, 'and so is Ramadan itself')
  assert.equal(isDismissed(value, banner('2028-01-01')), false, 'and next year')

  value = withDismissal(value, dismissalOf(soon))
  assert.equal(value, 'ramadan:2027-02-08-soon', 'no duplicates')
  for (const entry of ['ramadan:2027-02-08-eve', 'ramadan:2027-02-08', 'ramadan:2027-02-08-eid', 'eid-al-fitr:2027-03-09']) value = withDismissal(value, entry)
  assert.deepEqual(parseDismissed(value), ['ramadan:2027-02-08-eve', 'ramadan:2027-02-08', 'ramadan:2027-02-08-eid', 'eid-al-fitr:2027-03-09'])

  assert.deepEqual(parseDismissed(encodeURIComponent('your-year:2026|new-year:2027-01-01')), ['your-year:2026', 'new-year:2027-01-01'], 'encoded values are read')
  assert.deepEqual(parseDismissed('junk|<script>|your-year:2026|a:b:c'), ['your-year:2026'], 'anything else is dropped')
  assert.deepEqual(parseDismissed(''), [])
  assert.deepEqual(parseDismissed('%E0%A4%A'), [], 'a broken encoding is not an error')
})

// ---------------------------------------------------------------------------------------------
// Words and numbers.

test('seasonVars: relative days, dates and names in the viewer language', () => {
  const t = (key) => `<${key}>`
  assert.deepEqual(seasonVars({ whenDays: 45 }, { locale: 'en', t }), { when: 'in 45 days' })
  assert.deepEqual(seasonVars({ whenDays: 1 }, { locale: 'en', t }), { when: 'tomorrow' })
  assert.deepEqual(seasonVars({ whenDays: 2 }, { locale: 'ar', t }), { when: 'بعد الغد' })
  assert.deepEqual(seasonVars({ whenDays: 45 }, { locale: 'tn', t }), { when: 'خلال 45 يومًا' }, 'Latin digits in Arabic')
  assert.deepEqual(seasonVars({ date: '2027-02-08' }, { locale: 'en', t }), { date: '8 February' })
  assert.deepEqual(seasonVars({ date: '2027-02-08' }, { locale: 'ar', t }), { date: '8 فيفري' })
  assert.deepEqual(seasonVars({ nameKey: 'moment.republic-day.title', whenDays: 2, years: 70 }, { locale: 'en', t }), { name: '<moment.republic-day.title>', when: 'in 2 days', years: 70 })
  assert.deepEqual(seasonVars(undefined, { locale: 'en', t }), {})
})

test('countdownParts: minutes round up, seconds are exact', () => {
  assert.deepEqual(countdownParts(36 * 3600000, false), { days: 1, hours: 12, minutes: 0, seconds: 0 })
  assert.deepEqual(countdownParts(30000, false), { days: 0, hours: 0, minutes: 1, seconds: 0 }, 'the last minute reads 1 min')
  assert.deepEqual(countdownParts(61000, false), { days: 0, hours: 0, minutes: 2, seconds: 0 })
  assert.deepEqual(countdownParts(3 * 3600000 + 5 * 60000 + 9500, true), { days: 0, hours: 3, minutes: 5, seconds: 10 })
  assert.deepEqual(countdownParts(0, true), { days: 0, hours: 0, minutes: 0, seconds: 0 })
  assert.deepEqual(countdownParts(-5000, false), { days: 0, hours: 0, minutes: 0, seconds: 0 })
})

// ---------------------------------------------------------------------------------------------
// Agreement with moments.ts and ramadan.ts.

test('the moments seasons.ts knows have the weights, accents, pages and Kids rules of moments.ts', () => {
  for (const [id, expected] of Object.entries(SEASON_MOMENTS)) {
    const moment = getMoment(id, '2027-01-01')
    assert.equal(moment.weight, expected.weight, `${id} weight`)
    assert.equal(moment.accent, expected.accent, `${id} accent`)
    assert.equal(moment.href, expected.href, `${id} href`)
    assert.equal(momentForKids(id), expected.kids, `${id} for Kids`)
  }
})

test('Ramadan starts showing BANNER_DAYS_BEFORE days ahead, as ramadanStatus counts them', () => {
  assert.equal(BANNER_DAYS_BEFORE, 45)
  for (let offset = -3; offset <= 3; offset++) {
    const now = new Date(Date.parse('2026-12-25T12:00:00+01:00') + offset * 86400000)
    const status = ramadanStatus(now)
    const shown = status.phase === 'during' || status.daysUntil <= BANNER_DAYS_BEFORE
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Tunis' }).format(now)
    assert.equal(getSeasonalNav(false, date)?.href === '/ramadan', shown, `nav on ${date}`)
    assert.equal(getSeasonalBanner({ kids: false, signedIn: false, today: date })?.id === 'ramadan', shown, `banner on ${date}`)
  }
})
