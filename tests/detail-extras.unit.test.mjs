// Unit tests for the detail-page extras: the "More like this, but…" variations, the extras and
// trailers, the soundtrack scoring, the listen links, "Where have I seen them?" matching and the
// stream sources' templates.
//   node --import ./tests/register.mjs --test tests/detail-extras.unit.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'

const variations = await import('@/src/lib/variations')
const extras = await import('@/src/lib/extras')
const assets = await import('@/src/lib/media-assets')
const listen = await import('@/src/lib/listen-links')
const seen = await import('@/src/lib/seen-with')
const soundtrack = await import('@/src/lib/soundtrack')

const NOW = new Date('2026-10-09T12:00:00Z')
const fightClub = { kind: 'movie', genreIds: [18, 53], year: 1999, runtime: 139, seasons: null, episodeRuntime: null }
const toyStory = { kind: 'movie', genreIds: [16, 12, 10751, 35], year: 1995, runtime: 81, seasons: null, episodeRuntime: null }
const horror = { kind: 'movie', genreIds: [27], year: 1985, runtime: 95, seasons: null, episodeRuntime: null }
const breakingBad = { kind: 'tv', genreIds: [18, 80], year: 2008, runtime: null, seasons: 5, episodeRuntime: null }

// ---------------------------------------------------------------------------------------------
// Variations

test('tone: comedies and family films are light, horror is dark, a drama-thriller sits between', () => {
  assert.ok(variations.toneOf([35, 10751]) < 1)
  assert.equal(variations.toneOf([27]), 3)
  const drama = variations.toneOf([18, 53])
  assert.ok(drama >= 1.5 && drama < 2.5, String(drama))
})

test('lighter is offered unless the title is already light; darker unless it is already dark, and never to Kids', () => {
  assert.equal(variations.isAvailable('lighter', fightClub, false, NOW), true)
  assert.equal(variations.isAvailable('lighter', toyStory, false, NOW), false)
  assert.equal(variations.isAvailable('darker', fightClub, false, NOW), true)
  assert.equal(variations.isAvailable('darker', horror, false, NOW), false)
  assert.equal(variations.isAvailable('darker', fightClub, true, NOW), false)
})

test('shorter: films from 100 minutes, shows with 2 seasons or 45-minute episodes', () => {
  assert.equal(variations.isAvailable('shorter', fightClub, false, NOW), true)
  assert.equal(variations.isAvailable('shorter', toyStory, false, NOW), false)
  assert.equal(variations.isAvailable('shorter', breakingBad, false, NOW), true)
  assert.equal(variations.isAvailable('shorter', { ...breakingBad, seasons: 1, episodeRuntime: 30 }, false, NOW), false)
  assert.equal(variations.isAvailable('shorter', { ...breakingBad, seasons: 1, episodeRuntime: 50 }, false, NOW), true)
  assert.equal(variations.shorterCap(139), 105)
  assert.equal(variations.shorterCap(100), 80)
  assert.equal(variations.shorterCap(90), 75)
})

test('newer needs 6 years; older needs a release from 1990 on', () => {
  assert.equal(variations.isAvailable('newer', fightClub, false, NOW), true)
  assert.equal(variations.isAvailable('newer', { ...fightClub, year: 2023 }, false, NOW), false)
  assert.equal(variations.isAvailable('older', fightClub, false, NOW), true)
  assert.equal(variations.isAvailable('older', { ...fightClub, year: 1989 }, false, NOW), false)
  assert.equal(variations.newerSince(1999, NOW), 2018)
  assert.equal(variations.newerSince(2017, NOW), 2022)
  assert.equal(variations.olderBefore(1999), 1984)
})

test('order: Closest, Lighter, Darker, Shorter, Older, Newer, As a series, Arab world; Arab world second in ar and tn', () => {
  assert.deepEqual(variations.availableVariations(fightClub, false, 'en', NOW), ['lighter', 'darker', 'shorter', 'older', 'newer', 'kind', 'arab'])
  assert.deepEqual(variations.availableVariations(fightClub, false, 'ar', NOW), ['arab', 'lighter', 'darker', 'shorter', 'older', 'newer', 'kind'])
  assert.deepEqual(variations.availableVariations(fightClub, false, 'tn', NOW)[0], 'arab')
  const tabs = variations.similarTabs(10, fightClub, false, 'fr', NOW).map((tab) => tab.id)
  assert.deepEqual(tabs, ['closest', 'lighter', 'darker', 'shorter', 'older', 'newer', 'kind', 'arab'])
})

test('the section renders when Closest has titles or two variations exist', () => {
  assert.equal(variations.showsSimilar(0, 1), false)
  assert.equal(variations.showsSimilar(0, 2), true)
  assert.equal(variations.showsSimilar(3, 0), true)
  const noClosest = variations.similarTabs(0, fightClub, false, 'en', NOW)
  assert.equal(noClosest[0].id, 'lighter')
})

test('hints: minutes for shorter films, the year for newer and older', () => {
  assert.deepEqual(variations.variationHint('shorter', fightClub, NOW), { key: 'more.hint.shorterFilm', vars: { minutes: 105 } })
  assert.deepEqual(variations.variationHint('shorter', breakingBad, NOW), { key: 'more.hint.shorterSeries' })
  assert.deepEqual(variations.variationHint('newer', fightClub, NOW), { key: 'more.hint.newer', vars: { year: 2018 } })
  assert.deepEqual(variations.variationHint('older', fightClub, NOW), { key: 'more.hint.older', vars: { year: 1984 } })
  assert.equal(variations.variationTitle('kind', 'movie'), 'more.title.asSeries')
  assert.equal(variations.variationTitle('kind', 'tv'), 'more.title.asFilm')
})

test('discover attempts: at most three, adult content off, sorted by votes', () => {
  for (const variation of variations.VARIATIONS) {
    const attempts = variations.discoverAttempts(variation, fightClub, [851, 3927, 1541, 1721], NOW)
    assert.ok(attempts.length >= 1 && attempts.length <= 3, `${variation}: ${attempts.length}`)
    for (const attempt of attempts) {
      assert.equal(attempt.params.include_adult, false)
      assert.equal(attempt.params.sort_by, 'vote_count.desc')
    }
  }
})

test('lighter and darker: their own genres, the other side left out', () => {
  const [lighter] = variations.discoverAttempts('lighter', fightClub, [851, 3927], NOW)
  assert.equal(lighter.params.with_genres, '35|10751|16')
  assert.equal(lighter.params.without_genres, '27,53')
  assert.equal(lighter.params.with_keywords, '851|3927')
  const [darker] = variations.discoverAttempts('darker', fightClub, [851, 3927], NOW)
  assert.equal(darker.params.with_genres, '53|80|9648|27')
  assert.equal(darker.params.without_genres, '35,10751,16')
})

test('shorter, newer and older ask for runtime and dates; older needs 200 votes', () => {
  const shorter = variations.discoverAttempts('shorter', fightClub, [], NOW)
  assert.ok(shorter.every((attempt) => attempt.params['with_runtime.lte'] === 105 && attempt.params['with_runtime.gte'] === 60))
  assert.ok(variations.discoverAttempts('shorter', breakingBad, [], NOW).every((attempt) => attempt.params.with_type === 2))
  assert.ok(variations.discoverAttempts('newer', fightClub, [], NOW).every((attempt) => attempt.params['primary_release_date.gte'] === '2018-01-01'))
  const older = variations.discoverAttempts('older', fightClub, [], NOW)
  assert.ok(older.every((attempt) => attempt.params['primary_release_date.lte'] === '1983-12-31' && attempt.params['vote_count.gte'] === 200))
  assert.ok(variations.discoverAttempts('newer', breakingBad, [], NOW).every((attempt) => 'first_air_date.gte' in attempt.params))
})

test('as a series / as a film: the other kind, with mapped genres', () => {
  const attempts = variations.discoverAttempts('kind', { ...fightClub, genreIds: [28, 878] }, [], NOW)
  assert.ok(attempts.every((attempt) => attempt.kind === 'tv'))
  assert.equal(attempts[0].params.with_genres, '10759,10765')
  assert.deepEqual(variations.mapGenres([10759, 10765], 'tv'), [28, 878])
})

test('Arab world: the 22 countries with the genres, then films in Arabic', () => {
  const attempts = variations.discoverAttempts('arab', fightClub, [], NOW)
  assert.equal(attempts[0].params.with_genres, '18,53')
  assert.match(String(attempts[0].params.with_origin_country), /^DZ\|.*\|TN\|.*YE$/)
  assert.equal(String(attempts[0].params.with_origin_country).split('|').length, 22)
  assert.equal(attempts[1].params.with_genres, '18|53')
  assert.equal(attempts.at(-1).params.with_original_language, 'ar')
})

test('ranking: genre Jaccard, then votes; the title itself and duplicates left out', () => {
  const items = [
    { id: 1, genre_ids: [18], vote_count: 9000 },
    { id: 2, genre_ids: [18, 53], vote_count: 100 },
    { id: 550, genre_ids: [18, 53], vote_count: 99999 },
    { id: 3, genre_ids: [18, 53], vote_count: 500 },
    { id: 2, genre_ids: [18, 53], vote_count: 100 },
  ]
  const ranked = variations.rankResults(items, [18, 53], { kind: 'movie', id: '550' }, 'movie').map((item) => item.id)
  assert.deepEqual(ranked, [3, 2, 1])
  assert.equal(variations.jaccard([18, 53], [18]), 0.5)
  assert.equal(variations.jaccard([], []), 0)
})

test('generic keywords are skipped', () => {
  assert.deepEqual(variations.topKeywords([{ id: 818 }, { id: 851 }, { id: 179431 }, { id: 3927 }, { id: 1541 }, { id: 1721 }, { id: 825 }]), [851, 3927, 1541, 1721])
})

// ---------------------------------------------------------------------------------------------
// Videos

const video = (key, type, extra = {}) => ({ site: 'YouTube', key, type, name: `${type} ${key}`, official: true, iso_639_1: 'en', published_at: '2020-01-01T00:00:00.000Z', ...extra })

test('extras: YouTube only, each video once, grouped, the viewer’s language first', () => {
  const groups = extras.extrasFromVideos([
    video('aaaaaaaaaa1', 'Trailer'),
    video('aaaaaaaaaa1', 'Trailer'),
    video('bbbbbbbbbb2', 'Featurette'),
    video('cccccccccc3', 'Behind the Scenes', { iso_639_1: 'fr' }),
    video('dddddddddd4', 'Clip'),
    { site: 'Vimeo', key: '123', type: 'Clip' },
    video('not a key!', 'Clip'),
    video('eeeeeeeeee5', 'Bloopers'),
    video('ffffffffff6', 'Recap'),
  ], { prefer: ['fr', 'en'] })
  assert.deepEqual(groups.map((group) => group.id), ['trailers', 'behind', 'clips', 'bloopers', 'recaps'])
  assert.deepEqual(groups[1].videos.map((item) => item.key), ['cccccccccc3', 'bbbbbbbbbb2'])
  assert.equal(groups[0].videos.length, 1)
  assert.equal(groups[2].videos.length, 1)
})

test('extras: at most 24 a group; the hero’s trailer is skipped', () => {
  const many = Array.from({ length: 30 }, (_, index) => video(`clip${String(index).padStart(7, '0')}`, 'Clip'))
  assert.equal(extras.extrasFromVideos(many)[0].videos.length, 24)
  const groups = extras.extrasFromVideos([video('aaaaaaaaaa1', 'Trailer'), video('bbbbbbbbbb2', 'Clip')], { skip: 'aaaaaaaaaa1' })
  assert.deepEqual(groups.map((group) => group.id), ['clips'])
})

test('pickTrailer: the default stays as before; prefer finds Arabic or French first', () => {
  const list = [video('enenenenen1', 'Trailer'), video('ararararar1', 'Trailer', { iso_639_1: 'ar' }), video('frfrfrfrfr1', 'Teaser', { iso_639_1: 'fr' })]
  assert.equal(assets.pickTrailer(list), 'enenenenen1')
  assert.equal(assets.pickTrailer(list, assets.trailerLanguages('ar')), 'ararararar1')
  assert.equal(assets.pickTrailer(list, assets.trailerLanguages('tn')), 'ararararar1')
  assert.equal(assets.pickTrailer(list, assets.trailerLanguages('fr')), 'frfrfrfrfr1')
  assert.equal(assets.pickTrailer(list, assets.trailerLanguages('en')), 'enenenenen1')
  assert.equal(assets.pickTrailer([]), null)
})

test('videoExtras: the main trailer leads the dialog and leaves the row', () => {
  const { trailers, groups } = extras.videoExtras([video('enenenenen1', 'Trailer'), video('teaserteas1', 'Teaser'), video('clipclipcl1', 'Clip')], ['en'])
  assert.deepEqual(trailers.map((item) => item.key), ['enenenenen1', 'teaserteas1'])
  assert.deepEqual(groups.find((group) => group.id === 'trailers').videos.map((item) => item.key), ['teaserteas1'])
})

// ---------------------------------------------------------------------------------------------
// Stream sources

test('STREAM_PROVIDERS on the server changes the sources, and the player fills in the episode', async () => {
  const providers = await import('@/src/lib/stream-providers')
  const before = providers.getProviderTemplates()
  assert.ok(before.length >= 3)
  const saved = process.env.STREAM_PROVIDERS
  try {
    process.env.STREAM_PROVIDERS = JSON.stringify([{ name: 'Test', movie: 'https://example.test/m/{id}', tv: 'https://example.test/t/{id}?s={season}&e={episode}' }, { name: 'Bad', movie: 'http://x/{id}', tv: 'http://x' }])
    const templates = providers.getProviderTemplates()
    assert.deepEqual(templates.map((item) => item.name), ['Test'])
    assert.deepEqual(assets.fillProviders(templates, 'movie', '550'), [{ name: 'Test', url: 'https://example.test/m/550' }])
    assert.deepEqual(assets.fillProviders(templates, 'tv', '1396', 2, 5), [{ name: 'Test', url: 'https://example.test/t/1396?s=2&e=5' }])
    process.env.STREAM_PROVIDERS = 'not json'
    assert.deepEqual(providers.getProviderTemplates().map((item) => item.name), before.map((item) => item.name))
  } finally {
    if (saved === undefined) delete process.env.STREAM_PROVIDERS
    else process.env.STREAM_PROVIDERS = saved
  }
})

// ---------------------------------------------------------------------------------------------
// Soundtrack

const inception = { title: 'Inception', originalTitle: 'Inception', year: 2010, composers: [{ id: 947, name: 'Hans Zimmer' }] }

test('soundtrack titles: the film named with a soundtrack marker scores high; covers and plain albums low', () => {
  assert.equal(soundtrack.titleScore('Inception (Music from the Motion Picture)', ['Inception']), 1)
  assert.ok(soundtrack.titleScore('Inception', ['Inception']) <= 0.6)
  assert.ok(soundtrack.titleScore('Inception Soundtrack Dream Is Collapsing (Piano Orchestra)', ['Inception']) < 0.4)
  assert.ok(soundtrack.hasSoundtrackMarker('الموسيقى التصويرية لفيلم الرسالة'))
  assert.ok(soundtrack.hasSoundtrackMarker('Amélie (Bande originale du film)'))
  assert.equal(soundtrack.coreTitle('Inception (Music from the Motion Picture) [Deluxe Edition]'), 'inception')
})

test('soundtrack composers: the composer counts fully, Various Artists half', () => {
  assert.equal(soundtrack.composerScore('Hans Zimmer', [], inception.composers), 1)
  assert.equal(soundtrack.composerScore('Various Artists', [], inception.composers), 0.5)
  assert.equal(soundtrack.composerScore('Soundtrack Orchestra', ['Hans Zimmer'], inception.composers), 1)
  assert.equal(soundtrack.composerScore('Someone Else', [], inception.composers), 0)
  assert.equal(soundtrack.yearScore('2010-07-09', 2010), 1)
  assert.equal(soundtrack.yearScore('2011-01-01', 2010), 1)
  assert.equal(soundtrack.yearScore('2014-01-01', 2010), 0)
})

const album = (id, title, artist, releaseDate, nbTracks = 12) => ({ id, title, artist: { id: 1, name: artist }, releaseDate, contributors: [artist], nbTracks })

test('soundtrack match: Inception picks Hans Zimmer’s album, from 0.75', () => {
  const candidates = [
    album(601778, 'Inception (Music from the Motion Picture)', 'Hans Zimmer', '2010-07-09'),
    album(90648502, 'Inception Soundtrack Dream Is Collapsing (Piano Orchestra)', 'Soundtrack Orchestra', '2010-08-01', 1),
    album(1001393971, 'Inception', 'Aquabeat', '2015-01-01', 5),
  ].map((item) => ({ album: item, score: soundtrack.scoreAlbum(item, inception) }))
  assert.equal(candidates[0].score, 1)
  const match = soundtrack.pickMatch(candidates)
  assert.equal(match.album.id, 601778)
  assert.match(match.album.artist.name, /Zimmer/)
})

test('soundtrack match: nothing below 0.75, and nothing when a different work also reaches it', () => {
  assert.equal(soundtrack.pickMatch([{ album: album(1, 'Inception', 'Aquabeat', '2015-01-01'), score: 0.4 }]), null)
  const twoWorks = [
    { album: album(1, 'Up (Original Motion Picture Soundtrack)', 'Michael Giacchino', '2009-05-26'), score: 0.8 },
    { album: album(2, 'Up in Smoke (Original Soundtrack)', 'Someone', '2009-01-01'), score: 0.76 },
  ]
  assert.equal(soundtrack.pickMatch(twoWorks), null)
  const sameWork = [
    { album: album(1, 'Up (Original Motion Picture Soundtrack)', 'Michael Giacchino', '2009-05-26'), score: 1 },
    { album: album(3, 'Up (Original Motion Picture Soundtrack) [Deluxe Edition]', 'Michael Giacchino', '2009-05-26', 30), score: 1 },
  ]
  assert.ok(soundtrack.pickMatch(sameWork))
})

test('soundtrack cache: found 60 days, none 30 (3 when recent), errors an hour', () => {
  const day = 86_400_000
  assert.equal(soundtrack.staleAfter('found', false), 60 * day)
  assert.equal(soundtrack.staleAfter('none', false), 30 * day)
  assert.equal(soundtrack.staleAfter('none', true), 3 * day)
  assert.equal(soundtrack.staleAfter('error', false), 3_600_000)
  assert.deepEqual(soundtrack.composersOf({ crew: [{ id: 947, name: 'Hans Zimmer', job: 'Original Music Composer' }, { id: 947, name: 'Hans Zimmer', job: 'Music' }, { id: 1, name: 'X', job: 'Director' }] }), [{ id: 947, name: 'Hans Zimmer' }])
})

// ---------------------------------------------------------------------------------------------
// Listen links

test('listen on: Deezer first, Anghami first in Arabic and Derja, the last used before all', () => {
  assert.deepEqual(listen.listenOrder('en'), ['deezer', 'anghami', 'spotify', 'ytmusic'])
  assert.deepEqual(listen.listenOrder('ar'), ['anghami', 'deezer', 'spotify', 'ytmusic'])
  assert.deepEqual(listen.listenOrder('tn').slice(0, 1), ['anghami'])
  assert.deepEqual(listen.listenOrder('fr', 'spotify'), ['spotify', 'deezer', 'anghami', 'ytmusic'])
  assert.deepEqual(listen.listenOrder('fr', 'nonsense'), ['deezer', 'anghami', 'spotify', 'ytmusic'])
  assert.equal(listen.listenUrl('deezer', 'x', 'https://www.deezer.com/album/601778'), 'https://www.deezer.com/album/601778')
  assert.equal(listen.listenUrl('deezer', 'Inception Hans Zimmer', 'javascript:alert(1)'), 'https://www.deezer.com/search/Inception%20Hans%20Zimmer')
  assert.equal(listen.listenUrl('ytmusic', 'a b'), 'https://music.youtube.com/search?q=a%20b')
  assert.equal(listen.soundtrackQuery('Inception', 'Hans Zimmer'), 'Inception soundtrack Hans Zimmer')
})

// ---------------------------------------------------------------------------------------------
// Where have I seen them?

test('seen with: the credits in the history, newest first, without the title being looked at', () => {
  const watched = seen.historyMap([
    { id: '603', media_type: 'movie', title: 'The Matrix', watched_at: '2026-10-01' },
    { id: 245891, media_type: 'movie', title: 'John Wick', watched_at: '2026-10-05' },
    { id: '1637', media_type: 'movie', title: 'Speed', watched_at: '2026-10-03' },
    { id: 'bad', media_type: 'movie' },
    { id: '1', media_type: 'person' },
  ])
  assert.equal(watched.size, 3)
  const keanu = [
    { media_type: 'movie', id: 603, title: 'The Matrix', poster_path: '/m.jpg', release_date: '1999-03-31' },
    { media_type: 'movie', id: 1637, title: 'Speed', poster_path: '/s.jpg', release_date: '1994-06-09' },
    { media_type: 'movie', id: 245891, title: 'John Wick', poster_path: '/j.jpg', release_date: '2014-10-22' },
    { media_type: 'movie', id: 245891, title: 'John Wick', poster_path: '/j.jpg', release_date: '2014-10-22' },
    { media_type: 'movie', id: 9999, title: 'Not watched' },
  ]
  const titles = seen.seenInCredits(keanu, watched, 'movie:603')
  assert.deepEqual(titles.map((item) => item.id), ['245891', '1637'])
  assert.equal(titles[0].year, '2014')
  assert.equal(seen.seenInCredits(keanu, watched).length, 3)
})

test('seen with: people and exclude are checked', () => {
  assert.deepEqual(seen.parsePeople('6384,6384, 2975'), [6384, 2975])
  assert.equal(seen.parsePeople('abc'), null)
  assert.equal(seen.parsePeople(''), null)
  assert.equal(seen.parsePeople(Array.from({ length: 31 }, (_, index) => index + 1).join(',')), null)
  assert.equal(seen.parseExclude('movie:603'), 'movie:603')
  assert.equal(seen.parseExclude('person:1'), null)
})
