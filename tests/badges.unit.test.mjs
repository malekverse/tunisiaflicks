// Unit tests for badges, streaks and supporters (npm run test:unit). The rules run without a
// server; the database part runs when MONGODB_URI is set, in a database of its own that is dropped
// at the end (TMDB is never called: the title facts are seeded).
import { after, describe, test } from 'node:test'
import assert from 'node:assert/strict'

const HAS_DB = !!process.env.MONGODB_URI
if (HAS_DB) {
  const url = new URL(process.env.MONGODB_URI)
  url.pathname = `/tf_unit_badges_${process.pid}`
  process.env.MONGODB_URI = url.toString()
}

const catalogue = await import('@/src/lib/badges/catalogue')
const { levelFor, nextStep, BADGES, BADGE_IDS, KIDS_BADGES, PRIVATE_BADGES, TIER_RGB, badgeArtPath } = catalogue
const { localDay, hourFlags, safeTimeZone, weeklyStreak, weekIndex, activityExpiry, tunisToday } = await import('@/src/lib/badges/time')
const metrics = await import('@/src/lib/badges/metrics')
const { canonicalGenres, CANONICAL_GENRE_COUNT, decadeOf, marathonOf, ramadanDaysOf, finishedSeasons, playKey, parsePlayKey, computeMetrics, factsFromTmdb } = metrics
const { toView } = await import('@/src/lib/badges/present')
const { badgeSvg } = await import('@/src/lib/badges/art')
const kofi = await import('@/src/lib/badges/kofi')

after(async () => {
  if (!HAS_DB) return
  const client = await (await import('@/src/lib/mongodb')).default
  await client.db().dropDatabase()
  await client.close()
})

// ---------------------------------------------------------------------------------------------
// The catalogue

test('catalogue sanity: ids, thresholds rising, Kids and privacy columns', () => {
  assert.deepEqual(BADGES.map((b) => b.id), [...BADGE_IDS])
  assert.equal(new Set(BADGE_IDS).size, BADGE_IDS.length)
  for (const badge of BADGES) {
    if (badge.thresholds) {
      assert.equal(badge.thresholds.length, 4, badge.id)
      for (let i = 1; i < 4; i++) assert.ok(badge.thresholds[i] > badge.thresholds[i - 1], `${badge.id} rises`)
      assert.ok(badge.thresholds[0] >= 1, badge.id)
    }
  }
  assert.deepEqual([...KIDS_BADGES].sort(), ['decades', 'finisher', 'genres', 'openingNight', 'tunisian', 'world'])
  assert.deepEqual([...PRIVATE_BADGES].sort(), ['earlyBird', 'nightOwl', 'ramadan'])
  assert.ok(!KIDS_BADGES.has('supporter'), 'no money talk on Kids profiles')
  assert.ok(!KIDS_BADGES.has('streakWeeks'))
  assert.equal(catalogue.badgeDef('supporter').hiddenUntilEarned, true)
  assert.equal(catalogue.badgeDef('genres').thresholds[3], CANONICAL_GENRE_COUNT, 'platinum = every genre')
  assert.deepEqual(Object.keys(TIER_RGB), ['bronze', 'silver', 'gold', 'platinum'])
  assert.equal(badgeArtPath('marathon', 2), '/badges/art/marathon-2.svg')
  assert.equal(badgeArtPath('marathon', 9), '/badges/art/marathon-4.svg')
})

test('levelFor: each threshold reached, single-level badges are gold', () => {
  const marathon = catalogue.badgeDef('marathon') // 3/5/8/12
  assert.equal(levelFor(0, marathon), 0)
  assert.equal(levelFor(2, marathon), 0)
  assert.equal(levelFor(3, marathon), 1)
  assert.equal(levelFor(7, marathon), 2)
  assert.equal(levelFor(8, marathon), 3)
  assert.equal(levelFor(500, marathon), 4)
  assert.equal(levelFor(NaN, marathon), 0)
  assert.equal(levelFor(-3, marathon), 0)
  assert.equal(levelFor(1, catalogue.badgeDef('openingNight')), 3)
  assert.equal(levelFor(0, catalogue.badgeDef('openingNight')), 0)
  assert.equal(levelFor(4, catalogue.badgeDef('supporter')), 3)
})

test('nextStep: the next threshold, nothing at the top', () => {
  const world = catalogue.badgeDef('world') // 3/6/10/15
  assert.deepEqual(nextStep(0, world, 0), { target: 3, level: 1 })
  assert.deepEqual(nextStep(4, world, 1), { target: 6, level: 2 })
  // A stored level above what the log still shows (levels never go down) asks for the next one.
  assert.deepEqual(nextStep(2, world, 2), { target: 10, level: 3 })
  assert.equal(nextStep(20, world, 4), null)
  assert.deepEqual(nextStep(0, catalogue.badgeDef('openingNight'), 0), { target: 1, level: 3 })
  assert.equal(nextStep(1, catalogue.badgeDef('openingNight'), 3), null)
})

// ---------------------------------------------------------------------------------------------
// Days, hours, weeks

test('localDay across time zones: the same moment is a different day', () => {
  const at = new Date('2026-03-01T23:30:00Z')
  assert.deepEqual(localDay(at, 'UTC'), { day: '2026-03-01', month: '2026-03', d: 1, hour: 23 })
  assert.deepEqual(localDay(at, 'Africa/Tunis'), { day: '2026-03-02', month: '2026-03', d: 2, hour: 0 })
  assert.deepEqual(localDay(at, 'America/New_York'), { day: '2026-03-01', month: '2026-03', d: 1, hour: 18 })
  assert.equal(localDay(new Date('2026-01-31T22:30:00Z'), 'Asia/Tokyo').month, '2026-02')
  assert.equal(localDay(new Date('2026-06-15T00:00:00Z'), 'Africa/Tunis').hour, 1)
})

test('safeTimeZone: real zones pass, anything else is Tunis', () => {
  assert.equal(safeTimeZone('Europe/Paris'), 'Europe/Paris')
  assert.equal(safeTimeZone('Not/AZone'), 'Africa/Tunis')
  assert.equal(safeTimeZone('../../etc'), 'Africa/Tunis')
  assert.equal(safeTimeZone(42), 'Africa/Tunis')
  assert.equal(safeTimeZone(undefined), 'Africa/Tunis')
  assert.equal(safeTimeZone('x'.repeat(200)), 'Africa/Tunis')
})

test('hours 4 and 5 resolve to the night and early flags', () => {
  assert.deepEqual(hourFlags(0), { n: true })
  assert.deepEqual(hourFlags(4), { n: true })
  assert.deepEqual(hourFlags(5), { e: true })
  assert.deepEqual(hourFlags(8), { e: true })
  assert.deepEqual(hourFlags(9), {})
  assert.deepEqual(hourFlags(23), {})
  // 04:59 and 05:00 in Tunis (UTC+1).
  assert.deepEqual(hourFlags(localDay(new Date('2026-05-10T03:59:00Z'), 'Africa/Tunis').hour), { n: true })
  assert.deepEqual(hourFlags(localDay(new Date('2026-05-10T04:00:00Z'), 'Africa/Tunis').hour), { e: true })
})

test('weeks: Monday starts a week', () => {
  assert.equal(weekIndex('2026-10-05'), weekIndex('2026-10-11'), 'Monday and Sunday of one week')
  assert.equal(weekIndex('2026-10-12'), weekIndex('2026-10-11') + 1)
  assert.equal(weekIndex('2026-01-01'), weekIndex('2025-12-29'), 'across the new year')
})

test('streak gaps: current, best, and this week not over yet', () => {
  const today = '2026-10-08' // a Thursday
  // Three weeks in a row ending this week.
  assert.deepEqual(weeklyStreak(['2026-09-22', '2026-09-30', '2026-10-06'], today), { current: 3, best: 3, thisWeek: true })
  // Nothing yet this week: the run ending last week still counts.
  assert.deepEqual(weeklyStreak(['2026-09-22', '2026-09-30'], today), { current: 2, best: 2, thisWeek: false })
  // A whole week without a play ends it (best remembers).
  assert.deepEqual(weeklyStreak(['2026-09-08', '2026-09-15', '2026-09-22'], today), { current: 0, best: 3, thisWeek: false })
  // A gap in the middle.
  const gap = weeklyStreak(['2026-08-03', '2026-08-10', '2026-08-17', '2026-08-31', '2026-10-01', '2026-10-07'], today)
  assert.equal(gap.best, 3)
  assert.equal(gap.current, 2)
  // Several plays in one week count once.
  assert.deepEqual(weeklyStreak(['2026-10-05', '2026-10-06', '2026-10-07'], today), { current: 1, best: 1, thisWeek: true })
  assert.deepEqual(weeklyStreak([], today), { current: 0, best: 0, thisWeek: false })
})

test('the log expires 13 months after its month starts', () => {
  assert.equal(activityExpiry('2026-10').toISOString(), '2027-11-01T00:00:00.000Z')
  assert.equal(activityExpiry('2026-12').toISOString(), '2028-01-01T00:00:00.000Z')
})

// ---------------------------------------------------------------------------------------------
// Measures

test('play keys round-trip', () => {
  assert.equal(playKey({ media_type: 'movie', id: '550' }), 'm550')
  assert.equal(playKey({ media_type: 'tv', id: '1399', season: 1, episode: 2 }), 't1399:1:2')
  assert.equal(playKey({ media_type: 'tv', id: '1399' }), 't1399')
  assert.deepEqual(parsePlayKey('t1399:1:2'), { media_type: 'tv', id: '1399', season: 1, episode: 2 })
  assert.deepEqual(parsePlayKey('m550'), { media_type: 'movie', id: '550' })
  assert.equal(parsePlayKey('m550:1:2'), null)
  assert.equal(parsePlayKey('x1'), null)
})

test('marathon: distinct episodes of one show or distinct films, deduplicated, best day', () => {
  const days = [
    { day: '2026-10-01', k: ['t1:1:1', 't1:1:2', 't1:1:2', 't1:1:3', 't2:1:1', 't2:1:2'] },
    { day: '2026-10-02', k: ['m10', 'm11', 'm11', 'm12', 'm13', 't1'] },
    { day: '2026-10-03', k: ['t5:1:1', 't5:2:1'] },
  ]
  assert.equal(marathonOf([days[0]]), 3, 'two shows never add up, and a replay counts once')
  assert.equal(marathonOf([days[1]]), 4, 'films; a show without an episode is not one')
  assert.equal(marathonOf(days), 4)
  assert.equal(marathonOf([]), 0)
})

test('the Ramadan window: only days inside one Ramadan, the best one', () => {
  // Ramadan 1447 (Umm al-Qura): 2026-02-18 to 2026-03-19.
  assert.equal(ramadanDaysOf(['2026-02-17', '2026-03-20']), 0, 'the eve and Eid al-Fitr are outside')
  assert.equal(ramadanDaysOf(['2026-02-18', '2026-03-19']), 2, 'the first and the last day count')
  assert.equal(ramadanDaysOf(['2026-02-18', '2026-02-18', '2026-02-19']), 2, 'a day counts once')
  // Two Ramadans: the better one wins, they don't add up.
  assert.equal(ramadanDaysOf(['2025-03-02', '2025-03-03', '2025-03-04', '2026-02-20']), 3)
})

test('canonical genres: TV genres fold into the 18', () => {
  assert.deepEqual([...canonicalGenres([10765])].sort(), ['fantasy', 'scifi'])
  assert.deepEqual([...canonicalGenres([10759, 28, 12])].sort(), ['action', 'adventure'])
  assert.deepEqual([...canonicalGenres([10762, 10751])], ['family'])
  assert.equal(canonicalGenres([10763, 10764, 10767, 10770]).size, 0, 'news, reality, talk and TV movie do not count')
  const all = canonicalGenres([28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 53, 10752, 37])
  assert.equal(all.size, CANONICAL_GENRE_COUNT)
})

test('decades', () => {
  assert.equal(decadeOf(1994), 1990)
  assert.equal(decadeOf(2000), 2000)
  assert.equal(decadeOf(1869), null)
  assert.equal(decadeOf(null), null)
  assert.equal(decadeOf(1999.5), null)
})

test('finisher: every episode TMDB lists for a season, specials aside', () => {
  const facts = new Map([['tv:1', { g: [], l: 'en', y: 2020, tn: false, s: { 1: 3, 2: 2 } }], ['tv:2', { g: [], l: 'en', y: 2020, tn: false, s: { 1: 2 } }]])
  const days = [
    { day: '2026-10-01', k: ['t1:1:1', 't1:1:2'] },
    { day: '2026-10-02', k: ['t1:1:3', 't1:2:1', 't1:0:1', 't2:1:1', 't2:1:4'] },
    { day: '2026-10-03', k: ['t3:1:1'] },
  ]
  assert.equal(finishedSeasons(days, facts), 1, 'season 1 of show 1 only (show 2 misses episode 2, show 3 has no facts)')
  days.push({ day: '2026-10-04', k: ['t1:2:2', 't2:1:2'] })
  assert.equal(finishedSeasons(days, facts), 3)
})

test('computeMetrics: titles from history and log, languages, Tunisian, supporter', () => {
  const facts = new Map([
    ['movie:1', { g: [28, 35], l: 'en', y: 1994, tn: false }],
    ['movie:2', { g: [18], l: 'ar', y: 2018, tn: true }],
    ['tv:3', { g: [10765], l: 'ko', y: 2021, tn: false, s: { 1: 1 } }],
    ['movie:4', { g: [], l: null, y: null, tn: false, missing: true }],
    ['movie:5', { g: [99], l: 'xx', y: 1975, tn: false }],
  ])
  const result = computeMetrics({
    days: [{ day: '2026-10-07', n: true, k: ['m1', 't3:1:1'] }, { day: '2026-10-08', e: true, k: ['m2'] }],
    titles: ['movie:1', 'movie:4', 'movie:5', 'movie:1'],
    facts,
    today: '2026-10-08',
    supporter: true,
    bestStreak: 5,
  })
  const v = result.values
  assert.equal(v.openingNight, 1)
  assert.equal(v.tunisian, 1)
  assert.equal(v.genres, 6, 'action, comedy, drama, scifi, fantasy, documentary')
  assert.equal(v.world, 3, "en, ar, ko ('xx' is no language)")
  assert.equal(v.decades, 4)
  assert.equal(v.finisher, 1)
  assert.equal(v.nightOwl, 1)
  assert.equal(v.earlyBird, 1)
  assert.equal(v.supporter, 1)
  assert.equal(v.streakWeeks, 5, 'the best streak on record is kept')
  assert.equal(computeMetrics({ days: [], titles: [], facts: new Map(), today: '2026-10-08', supporter: false }).values.openingNight, 0)
})

// ---------------------------------------------------------------------------------------------
// The shelf

const doc = {
  earned: {
    openingNight: { level: 3, at: new Date('2026-01-01'), levelAt: new Date('2026-01-01'), seenLevel: 3 },
    nightOwl: { level: 2, at: new Date('2026-02-01'), levelAt: new Date('2026-03-01'), seenLevel: 1 },
    ramadan: { level: 1, at: new Date('2026-03-01'), levelAt: new Date('2026-03-01'), seenLevel: 1 },
    marathon: { level: 1, at: new Date('2026-02-01'), levelAt: new Date('2026-02-01'), seenLevel: 1 },
    world: { level: 1, at: new Date('2026-02-01'), levelAt: new Date('2026-02-01'), seenLevel: 0 },
    supporter: { level: 3, at: new Date('2026-04-01'), levelAt: new Date('2026-04-01'), seenLevel: 3 },
  },
  progress: { openingNight: 1, nightOwl: 12, marathon: 4, world: 5, genres: 2, decades: 0, earlyBird: 0 },
  streak: { current: 3, best: 6, thisWeek: true },
}
const NOT_RAMADAN = new Date('2026-10-08T12:00:00Z')

test('public view: never the time badges, Supporter only when opted in, no progress or dates', () => {
  const view = toView(doc, { view: 'public', kids: false, supporterPublic: false, now: NOT_RAMADAN })
  const ids = view.earned.map((card) => card.id)
  assert.deepEqual(ids, ['openingNight', 'marathon', 'world'])
  assert.ok(!ids.some((id) => PRIVATE_BADGES.has(id)))
  for (const card of view.earned) {
    assert.equal(card.at, undefined)
    assert.equal(card.value, undefined)
    assert.equal(card.next, undefined)
    assert.equal(card.unseen, undefined)
  }
  assert.deepEqual(view.upNext, [])
  assert.equal(view.streak.current, 3, 'the streak number is shown')
  assert.equal(view.streak.thisWeek, false, 'not whether they pressed play this week')
  const opted = toView(doc, { view: 'public', kids: false, supporterPublic: true, now: NOT_RAMADAN })
  assert.ok(opted.earned.some((card) => card.id === 'supporter'))
})

test('owner view: everything, unseen dots, up next closest first', () => {
  const view = toView(doc, { view: 'owner', kids: false, supporterPublic: false, now: NOT_RAMADAN })
  assert.deepEqual(view.earned.map((card) => card.id), ['openingNight', 'marathon', 'nightOwl', 'ramadan', 'world', 'supporter'])
  assert.equal(view.earned.find((card) => card.id === 'nightOwl').unseen, true)
  assert.equal(view.earned.find((card) => card.id === 'nightOwl').onlyYou, true)
  assert.equal(view.earned.find((card) => card.id === 'openingNight').unseen, false)
  assert.ok(view.upNext.length <= 3)
  // marathon 4/5 = 0.8, world 5/6 = 0.83, nightOwl 12/25 = 0.48
  assert.deepEqual(view.upNext.map((card) => card.id), ['world', 'marathon', 'nightOwl'])
  assert.ok(!view.upNext.some((card) => card.id === 'supporter'), 'Supporter is never something to work towards')
})

test('Kids: discovery badges only, no streak', () => {
  const view = toView(doc, { view: 'owner', kids: true, supporterPublic: true, now: NOT_RAMADAN })
  assert.ok(view.earned.every((card) => KIDS_BADGES.has(card.id)))
  assert.ok(view.upNext.every((card) => KIDS_BADGES.has(card.id)))
  assert.equal(view.streak, null)
})

test('the streak chip never says 0, and turned-off badges show nothing', () => {
  const quiet = toView({ ...doc, streak: { current: 1, best: 1, thisWeek: true } }, { view: 'owner', kids: false, supporterPublic: false, now: NOT_RAMADAN })
  assert.equal(quiet.streak, null)
  const off = toView({ ...doc, disabled: true }, { view: 'owner', kids: false, supporterPublic: false })
  assert.equal(off.disabled, true)
  assert.deepEqual(off.earned, [])
})

test('Ramadan is only up next while it runs', () => {
  const fresh = { earned: {}, progress: { ramadan: 0 }, streak: { current: 0, best: 0 } }
  const outside = toView(fresh, { view: 'owner', kids: false, supporterPublic: false, now: NOT_RAMADAN })
  assert.ok(!outside.upNext.some((card) => card.id === 'ramadan'))
})

// ---------------------------------------------------------------------------------------------
// The art

test('art: a medallion per level, locked with an arc, never red', () => {
  for (const id of BADGE_IDS) {
    for (const level of [0, 1, 2, 3, 4]) {
      const svg = badgeSvg({ id, level, standalone: true, progress: 0.4, arcTier: 'gold' })
      assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 64 64"/)
      assert.match(svg, /<\/svg>$/)
      assert.doesNotMatch(svg, /#E5|#FF24|red|229,9|255,36/i, 'no red')
    }
  }
  assert.match(badgeSvg({ id: 'world', level: 0, progress: 0.5, arcTier: 'silver' }), /stroke-dasharray/)
  assert.doesNotMatch(badgeSvg({ id: 'world', level: 0 }), /stroke-dasharray/, 'no arc without progress')
  assert.equal((badgeSvg({ id: 'world', level: 3 }).match(/cy="50.5"/g) ?? []).length, 3, 'three pips for gold')
})

// ---------------------------------------------------------------------------------------------
// Ko-fi

test('Ko-fi: the form body, the token, the code in the message', () => {
  const data = { verification_token: 'tok', kofi_transaction_id: 'abc-123', message: 'Merci ! tf-ab3cd', email: 'A@Example.com' }
  const body = new URLSearchParams({ data: JSON.stringify(data) }).toString()
  assert.deepEqual(kofi.parseKofiBody(body), data)
  assert.equal(kofi.parseKofiBody('data=not-json'), null)
  assert.equal(kofi.parseKofiBody('nothing=here'), null)
  assert.equal(kofi.parseKofiBody(`data=${encodeURIComponent('[1,2]')}`), null)
  assert.equal(kofi.parseKofiBody('data=' + 'a'.repeat(65 * 1024)), null, 'over 64KB')
  assert.equal(kofi.tokenMatches('tok', 'tok'), true)
  assert.equal(kofi.tokenMatches('tok2', 'tok'), false)
  assert.equal(kofi.tokenMatches('tom', 'tok'), false)
  assert.equal(kofi.tokenMatches(undefined, 'tok'), false)
  assert.equal(kofi.tokenMatches('', ''), false)
  assert.equal(kofi.findSupportCode('Merci ! tf-ab3cd'), 'TF-AB3CD')
  assert.equal(kofi.findSupportCode('code TF-AB1CD'), null, '1 is not in the alphabet')
  assert.equal(kofi.findSupportCode('no code'), null)
  assert.match(kofi.newSupportCode(), kofi.SUPPORT_CODE_RE)
})

test('Ko-fi: e-mails are only ever a keyed hash', () => {
  const key = kofi.emailKey(' A@Example.com ', 'secret-1')
  assert.equal(key, kofi.emailKey('a@example.com', 'secret-1'), 'normalized first')
  assert.notEqual(key, kofi.emailKey('a@example.com', 'secret-2'), 'keyed')
  assert.match(key, /^[0-9a-f]{64}$/)
  assert.doesNotMatch(key, /example/)
})

test('credit names: one line, 30 characters at most', () => {
  assert.equal(kofi.cleanListName('  Amine \n Ben  Ali '), 'Amine Ben Ali')
  assert.equal(kofi.cleanListName('سلمى‮'), 'سلمى', 'no direction overrides')
  assert.equal(kofi.cleanListName('x'.repeat(31)), null)
  assert.equal(kofi.cleanListName(''), '')
  assert.equal(kofi.cleanListName(5), null)
})

// ---------------------------------------------------------------------------------------------
// With a database: the log, the computation, the switch, the inbox, Ko-fi

describe('badges with a database', { skip: !HAS_DB && 'no MONGODB_URI' }, () => {
  const USER = '64d4a5d0d0d0d0d0d0d0be01'
  const GROWN = '64d4a5d0d0d0d0d0d0d0be02'
  const KID = '64d4a5d0d0d0d0d0d0d0be03'
  const SECOND = '64d4a5d0d0d0d0d0d0d0be04'

  const setup = async () => {
    const { ObjectId } = await import('mongodb')
    const db = (await (await import('@/src/lib/mongodb')).default).db()
    await db.collection('users').updateOne({ _id: new ObjectId(USER) }, {
      $set: {
        email: 'salma.badges@example.test', emailVerified: new Date(), locale: 'en',
        profiles: [{ id: GROWN, name: 'Salma', kids: false }, { id: KID, name: 'Youssef', kids: true }, { id: SECOND, name: 'Amine', kids: false }],
      },
    }, { upsert: true })
    await db.collection('titleFacts').insertMany([
      { _id: 'movie:550', g: [18, 53], l: 'en', y: 1999, tn: false, expireAt: new Date(Date.now() + 86400000) },
      { _id: 'movie:551', g: [35], l: 'ar', y: 2016, tn: true, expireAt: new Date(Date.now() + 86400000) },
      { _id: 'tv:1399', g: [10765], l: 'en', y: 2011, tn: false, s: { 1: 2 }, expireAt: new Date(Date.now() + 86400000) },
    ]).catch(() => undefined)
    return db
  }

  test('a play is logged by day, with the night flag for grown-ups only', async () => {
    const db = await setup()
    const { recordPlay } = await import('@/src/lib/badges/activity')
    const at = new Date('2026-10-07T02:30:00Z') // 03:30 in Tunis
    await recordPlay({ userId: USER, profileId: GROWN }, { media_type: 'movie', id: '550' }, { timeZone: 'Africa/Tunis', now: at })
    await recordPlay({ userId: USER, profileId: GROWN }, { media_type: 'movie', id: '550' }, { timeZone: 'Africa/Tunis', now: at })
    await recordPlay({ userId: USER, profileId: GROWN }, { media_type: 'tv', id: '1399', season: 1, episode: 1 }, { timeZone: 'Africa/Tunis', now: at })
    await recordPlay({ userId: USER, profileId: KID }, { media_type: 'movie', id: '551' }, { timeZone: 'Africa/Tunis', now: at })
    const month = await db.collection('watchActivity').findOne({ _id: `${GROWN}:2026-10` })
    assert.deepEqual(month.days, [{ d: 7, n: true, k: ['m550', 't1399:1:1'] }])
    assert.ok(month.expireAt instanceof Date)
    assert.equal(month.hours, undefined)
    const kid = await db.collection('watchActivity').findOne({ _id: `${KID}:2026-10` })
    assert.deepEqual(kid.days, [{ d: 7, k: ['m551'] }], 'no time-of-day flags on a Kids profile')
    const badges = await db.collection('badges').findOne({ _id: GROWN })
    assert.ok(badges.dirtyAt instanceof Date)
  })

  test('the computation earns levels (only up), the cron files one inbox row per profile and level', async () => {
    const db = await setup()
    const { recordPlay } = await import('@/src/lib/badges/activity')
    const { runBadgesCron } = await import('@/src/lib/badges/cron')
    await recordPlay({ userId: USER, profileId: SECOND }, { media_type: 'movie', id: '551' }, { timeZone: 'Africa/Tunis', now: new Date('2026-10-07T12:00:00Z') })
    // The plays above carry fixed dates: mark them as just played, so the cron's two-day window
    // holds them whatever day the tests run.
    await db.collection('badges').updateMany({}, { $set: { dirtyAt: new Date() } })
    const result = await runBadgesCron({ deadline: Date.now() + 40000 })
    assert.ok(result.profiles >= 3)
    const rows = await db.collection('notifications').find({ userId: USER, kind: 'badge_earned' }).toArray()
    const grown = rows.filter((row) => row.profileId === GROWN).map((row) => row.event_key).sort()
    assert.ok(grown.includes(`badge_earned:${GROWN}:openingNight:3`))
    assert.ok(rows.some((row) => row.event_key === `badge_earned:${SECOND}:openingNight:3`), 'each profile gets its own row for the same level')
    assert.ok(rows.some((row) => row.event_key === `badge_earned:${SECOND}:tunisian:1`))
    const kid = rows.filter((row) => row.profileId === KID)
    assert.ok(kid.length > 0 && kid.every((row) => row.kidsVisible === true), 'Kids see their kid-safe badges in the bell')
    for (const row of rows) {
      assert.equal(row.href, '/me#badges')
      assert.match(row.image, /^\/badges\/art\/[a-zA-Z]+-[1-4]\.svg$/)
      assert.equal(row.text.key, 'badges.inbox.earned')
    }
    const doc = await db.collection('badges').findOne({ _id: GROWN })
    assert.equal(doc.earned.openingNight.announcedLevel, 3)
    assert.equal(doc.pendingAnnounce, undefined)
    // A second run announces nothing new.
    await db.collection('badges').updateMany({}, { $set: { dirtyAt: new Date() } })
    const again = await runBadgesCron({ deadline: Date.now() + 40000 })
    assert.equal(again.announced, 0)
    // Levels never go down, even when the log forgets.
    const { forgetTitle } = await import('@/src/lib/badges/activity')
    await forgetTitle({ userId: USER, profileId: GROWN }, '550')
    const { getBadgesView } = await import('@/src/lib/badges/view')
    const view = await getBadgesView({ userId: USER, profileId: GROWN }, { refresh: 'force' })
    assert.ok(view.earned.some((card) => card.id === 'openingNight'))
    const month = await db.collection('watchActivity').findOne({ _id: `${GROWN}:2026-10` })
    assert.deepEqual(month.days[0].k, ['t1399:1:1'], 'the title left the log')
  })

  test('public view never shows the time badges', async () => {
    const db = await setup()
    await db.collection('badges').updateOne({ _id: GROWN }, { $set: { 'earned.nightOwl': { level: 1, at: new Date(), levelAt: new Date(), seenLevel: 0, announcedLevel: 1 } } })
    const { getBadgesView } = await import('@/src/lib/badges/view')
    const owner = await getBadgesView({ userId: USER, profileId: GROWN }, { refresh: 'never' })
    assert.ok(owner.earned.some((card) => card.id === 'nightOwl'))
    const seen = await getBadgesView({ userId: USER, profileId: GROWN }, { refresh: 'never', view: 'public' })
    assert.ok(!seen.earned.some((card) => PRIVATE_BADGES.has(card.id)))
  })

  test('turning badges off deletes the log and stops it; on starts fresh', async () => {
    const db = await setup()
    const { setBadgesEnabled, getBadgesView } = await import('@/src/lib/badges/view')
    const { recordPlay } = await import('@/src/lib/badges/activity')
    const ref = { userId: USER, profileId: GROWN }
    assert.ok(await db.collection('watchActivity').countDocuments({ profileId: GROWN }) > 0)
    await setBadgesEnabled(ref, false)
    assert.equal(await db.collection('watchActivity').countDocuments({ profileId: GROWN }), 0)
    await recordPlay(ref, { media_type: 'movie', id: '550' }, { timeZone: 'Africa/Tunis' })
    assert.equal(await db.collection('watchActivity').countDocuments({ profileId: GROWN }), 0, 'nothing is logged while off')
    assert.equal((await getBadgesView(ref, { refresh: 'auto' })).disabled, true)
    await setBadgesEnabled(ref, true)
    await recordPlay(ref, { media_type: 'movie', id: '550' }, { timeZone: 'Africa/Tunis' })
    assert.equal(await db.collection('watchActivity').countDocuments({ profileId: GROWN }), 1)
    assert.equal((await getBadgesView(ref, { refresh: 'auto' })).disabled, false)
  })

  test('Ko-fi: a supporters document, and no plaintext e-mail anywhere', async () => {
    const db = await setup()
    process.env.SUPPORT_HASH_SECRET = 'unit-test-support-hash-secret-0123456789'
    process.env.KOFI_VERIFICATION_TOKEN = 'unit-test-kofi-token'
    const support = await import('@/src/lib/support')
    const secret = process.env.SUPPORT_HASH_SECRET
    // Matched by the confirmed e-mail.
    const first = await support.processKofi({ kofi_transaction_id: 'tx-1', email: 'Salma.Badges@example.test', message: 'Bravo', timestamp: '2026-10-01T10:00:00Z' }, secret)
    assert.equal(first, 'linked')
    assert.equal(await support.processKofi({ kofi_transaction_id: 'tx-1', email: 'salma.badges@example.test' }, secret), 'duplicate')
    // Matched by code, whatever the e-mail.
    const code = await support.ensureSupportCode(USER)
    assert.match(code, support.SUPPORT_CODE_RE)
    assert.equal(await support.ensureSupportCode(USER), code, 'one code per account')
    assert.equal(await support.processKofi({ kofi_transaction_id: 'tx-2', email: 'someone@else.test', message: `for ${code.toLowerCase()}` }, secret), 'linked')
    // Unknown: kept hashed until claimed.
    assert.equal(await support.processKofi({ kofi_transaction_id: 'tx-3', email: 'nobody@example.test' }, secret), 'pending')
    const supporter = await db.collection('supporters').findOne({ _id: USER })
    assert.equal(supporter.count, 2)
    assert.equal(supporter.since.toISOString(), '2026-10-01T10:00:00.000Z')
    assert.deepEqual(Object.keys(supporter).sort(), ['_id', 'badgePublic', 'count', 'lastAt', 'listName', 'listed', 'since'])
    const everything = JSON.stringify([
      await db.collection('supporters').find().toArray(),
      await db.collection('supportEvents').find().toArray(),
      await db.collection('badges').find().toArray(),
      await db.collection('notifications').find({ kind: 'badge_earned' }).toArray(),
    ]).toLowerCase()
    for (const leak of ['salma.badges@', 'someone@else', 'nobody@example', 'bravo']) assert.ok(!everything.includes(leak), `no ${leak}`)
    // The badge lands on the first grown-up profile.
    const row = await db.collection('notifications').findOne({ event_key: `badge_earned:${GROWN}:supporter:3` })
    assert.ok(row, 'announced right away')
    assert.equal(row.kidsVisible, false)
  })
})

test('facts from a TMDB answer', () => {
  const movie = factsFromTmdb('movie', { genres: [{ id: 18 }], original_language: 'ar', release_date: '2016-05-01', production_countries: [{ iso_3166_1: 'TN' }] })
  assert.deepEqual(movie, { g: [18], l: 'ar', y: 2016, tn: true })
  const tv = factsFromTmdb('tv', { genres: [], original_language: 'en', first_air_date: '2011-04-17', origin_country: ['US'], seasons: [{ season_number: 0, episode_count: 5 }, { season_number: 1, episode_count: 10 }] })
  assert.deepEqual(tv, { g: [], l: 'en', y: 2011, tn: false, s: { 1: 10 } })
})

void tunisToday
