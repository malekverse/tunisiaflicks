// Unit tests for where a Tunisian FILM plays in full (src/lib/tunisian-film): a title reduced to its
// identifying words, a full upload matched on a trusted channel (allowlist + duration + title, never a
// blind search), and the verified legal-platform links. No database or network:
//   npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CURATED_FILM_SOURCES, curatedFilmSource, filmTitleKeys, filmTokens, legalWatchLink, matchFilmUpload,
  normalizeLegalLink, yearIn, MIN_FILM_SECONDS, type CuratedFilmSource, type FilmUploadCandidate,
} from '@/src/lib/tunisian-film'

test('filmTokens: identifying words only; no "film", "complet", "HD", articles, years or numbers', () => {
  assert.deepEqual(filmTokens('فيلم تونسي بسطانجي كامل'), ['بسطانجي'])
  assert.deepEqual(filmTokens('Bastardo Film Complet HD'), ['bastardo'])
  assert.deepEqual(filmTokens('Fleur d’Alep (2016)'), ['fleur', 'alep'])
  assert.deepEqual(filmTokens('مشاهدة فيلم الجزء الأخير 2024'), ['الجزء', 'الاخير'])
  // Nothing identifying left.
  assert.deepEqual(filmTokens('فيلم تونسي كامل HD'), [])
})

test('filmTitleKeys: the identifying words split by script', () => {
  assert.deepEqual(filmTitleKeys('فيلم بسطانجي Bastardo'), { ar: ['بسطانجي'], latin: ['bastardo'] })
  assert.deepEqual(filmTitleKeys('Dachra داشرة'), { ar: ['داشره'], latin: ['dachra'] })
})

test('yearIn: a film year when present', () => {
  assert.equal(yearIn('Bastardo (2013) HD'), 2013)
  assert.equal(yearIn('فيلم 2024'), 2024)
  assert.equal(yearIn('no year here'), null)
})

const upload = (o: Partial<FilmUploadCandidate> & Pick<FilmUploadCandidate, 'id' | 'title'>): FilmUploadCandidate => ({
  channel: 'watania-1', duration: 90 * 60, views: 1000, publishedAt: '2024-01-01T00:00:00.000Z', ...o,
})

test('matchFilmUpload: a full upload whose title matches, in either script', () => {
  const uploads = [
    upload({ id: 'aaaaaaaaaaa', title: 'فيلم بسطانجي | Bastardo HD', duration: 95 * 60 }),
    upload({ id: 'bbbbbbbbbbb', title: 'برنامج الأخبار 2024', duration: 50 * 60 }),
  ]
  assert.equal(matchFilmUpload({ titles: ['Bastardo', 'بسطانجي'] }, uploads)?.id, 'aaaaaaaaaaa')
  assert.equal(matchFilmUpload({ titles: ['بسطانجي'] }, uploads)?.id, 'aaaaaaaaaaa')
})

test('matchFilmUpload: a clip, a short upload or an unknown duration never matches', () => {
  const title = 'فيلم بسطانجي Bastardo'
  // A trailer, even full length.
  assert.equal(matchFilmUpload({ titles: ['Bastardo'] }, [upload({ id: 'aaaaaaaaaaa', title: 'Bastardo | Bande annonce', duration: 90 * 60 })]), null)
  assert.equal(matchFilmUpload({ titles: ['Bastardo'] }, [upload({ id: 'aaaaaaaaaaa', title: 'Bastardo - إعلان الفيلم', duration: 90 * 60 })]), null)
  // Too short to be a film.
  assert.equal(matchFilmUpload({ titles: ['Bastardo'] }, [upload({ id: 'aaaaaaaaaaa', title, duration: MIN_FILM_SECONDS - 1 })]), null)
  // Duration unknown.
  assert.equal(matchFilmUpload({ titles: ['Bastardo'] }, [upload({ id: 'aaaaaaaaaaa', title, duration: null })]), null)
})

test('matchFilmUpload: a numbered episode is never the film, however long', () => {
  // Goubantini's own uploads: the series' episodes run as long as a film.
  const episodes = [
    upload({ id: 'sahbekep001', channel: 'goubantini', title: 'Sahbek Rajel Season 2 | EP1 | Goubantini Cinéma', duration: 51 * 60 }),
    upload({ id: 'babbnetep03', title: 'مسلسل باب البنات - الحلقة 3', duration: 45 * 60 }),
  ]
  assert.equal(matchFilmUpload({ titles: ['Sahbek Rajel'], year: 2020 }, episodes), null)
  assert.equal(matchFilmUpload({ titles: ['باب البنات'] }, episodes), null)
})

test('matchFilmUpload: a producer\'s own full films, as KDH PROD titles them', () => {
  // Live titles from KDH PROD (films); only the two film-length ones can match.
  const kdh = [
    upload({ id: 'maftounsi01', channel: 'kdh-prod', title: 'مافتونسي"  فيلم تونسي كامل" | Film tunisien complet " Maftounsi " (2021) - (2022)', duration: 3893 }),
    upload({ id: 'maftotrail1', channel: 'kdh-prod', title: 'مافتونسي"  فيلم تونسي" | Film tunisien "Maftounsi" | Bande-annonce | (2020) - trailer', duration: 120 }),
    upload({ id: 'zmenghrib01', channel: 'kdh-prod', title: 'زمان غريب"  فيلم تونسي كامل" | Film tunisien complet " ZMEN GHRIB " (2019)', duration: 3274 }),
    upload({ id: 'bouchkara01', channel: 'kdh-prod', title: 'بوشكارة" فيلم تونسي كامل" | Film tunisien complet " Bouchkara " (2021) - (2022)', duration: 2042 }),
  ]
  assert.equal(matchFilmUpload({ titles: ['Maftounsi'], year: 2021 }, kdh)?.id, 'maftounsi01')
  assert.equal(matchFilmUpload({ titles: ['فيلم زمان غريب'] }, kdh)?.id, 'zmenghrib01')
  // 34 minutes: a medium-length film, under the bar.
  assert.equal(matchFilmUpload({ titles: ['Bouchkara'] }, kdh), null)
  // "tunisien", "complet", "film" are filler: the title's own words are what's compared.
  assert.deepEqual(filmTokens('Film tunisien complet " Maftounsi " (2021)'), ['maftounsi'])
})

test('matchFilmUpload: only a confident title; a short one-word name does not match on its own', () => {
  // "باب" (door) is one short word: too little to match a film called that.
  assert.equal(matchFilmUpload({ titles: ['باب'] }, [upload({ id: 'aaaaaaaaaaa', title: 'فيلم باب العرش كامل', duration: 90 * 60 })]), null)
  // A distinctive one-word name (4+ letters) does match.
  assert.equal(matchFilmUpload({ titles: ['داشرة'] }, [upload({ id: 'bbbbbbbbbbb', title: 'فيلم داشرة كامل', duration: 90 * 60 })])?.id, 'bbbbbbbbbbb')
  // Nothing to match against.
  assert.equal(matchFilmUpload({ titles: [] }, [upload({ id: 'aaaaaaaaaaa', title: 'anything', duration: 90 * 60 })]), null)
  assert.equal(matchFilmUpload({ titles: ['Bastardo'] }, []), null)
})

test('matchFilmUpload: a year that is far off rules a same-name film out', () => {
  const uploads = [upload({ id: 'aaaaaaaaaaa', title: 'Jesusia 1995 Film Complet', duration: 90 * 60 })]
  assert.equal(matchFilmUpload({ titles: ['Jesusia'], year: 2023 }, uploads), null)
  assert.equal(matchFilmUpload({ titles: ['Jesusia'], year: 1995 }, uploads)?.id, 'aaaaaaaaaaa')
})

test('matchFilmUpload: among matches, the tightest title then the matching year then the longest', () => {
  const uploads = [
    upload({ id: 'loosematch0', title: 'Dachra et autres histoires du cinéma tunisien', duration: 120 * 60 }),
    upload({ id: 'tightmatch0', title: 'Dachra داشرة 2018', duration: 95 * 60 }),
  ]
  // The tight title wins over a longer upload that merely contains the word.
  assert.equal(matchFilmUpload({ titles: ['Dachra'], year: 2018 }, uploads)?.id, 'tightmatch0')
})

test('normalizeLegalLink: only the platform it names, over https', () => {
  assert.deepEqual(normalizeLegalLink({ platform: 'artify', url: 'https://artify.tn/film/dachra' }), { platform: 'artify', url: 'https://artify.tn/film/dachra' })
  assert.deepEqual(normalizeLegalLink({ platform: 'raksha', url: 'https://www.raksha.tn/w/x' }), { platform: 'raksha', url: 'https://www.raksha.tn/w/x' })
  // Wrong host for the platform, or not https, or junk.
  assert.equal(normalizeLegalLink({ platform: 'artify', url: 'https://evil.example/artify' }), null)
  assert.equal(normalizeLegalLink({ platform: 'artify', url: 'http://artify.tn/x' }), null)
  assert.equal(normalizeLegalLink({ platform: 'raksha', url: 'https://artify.tn/x' }), null)
  assert.equal(normalizeLegalLink(null), null)
})

test('curatedFilmSource / legalWatchLink: exact keys only, validated', () => {
  const map: Record<string, CuratedFilmSource> = {
    'tmdb:123': { youtube: { id: 'aaaaaaaaaaa', channel: 'watania-1' } },
    'slug:2018/10/dachra': { legal: { platform: 'artify', url: 'https://artify.tn/film/dachra' } },
    'tmdb:999': { legal: { platform: 'raksha', url: 'https://evil.example/x' } }, // invalid URL
  }
  assert.equal(curatedFilmSource(['tmdb:123', 'slug:x'], map)?.youtube?.id, 'aaaaaaaaaaa')
  assert.deepEqual(legalWatchLink(['tmdb:000', 'slug:2018/10/dachra'], map), { platform: 'artify', url: 'https://artify.tn/film/dachra' })
  // An invalid curated URL is dropped, not shown.
  assert.equal(legalWatchLink(['tmdb:999'], map), null)
  assert.equal(legalWatchLink(['tmdb:absent'], map), null)
})

test('the shipped curated map holds only valid, hand-verified entries', () => {
  // Fleur d'Alep (TMDB 413928) is pinned to its Artify page.
  assert.deepEqual(legalWatchLink(['tmdb:413928']), { platform: 'artify', url: 'https://artify.tn/media/the-flower-of-aleppo?m=5ed0fd4c6050e36c0b6cd151' })
  // Every entry is usable: a full upload ({ id, channel }) or a legal link that survives validation.
  for (const [key, source] of Object.entries(CURATED_FILM_SOURCES)) {
    assert.match(key, /^(?:tmdb:\d+|slug:\d{4}\/\d{2}\/[^/]+)$/, `${key}: keyed by tmdb id or blog slug`)
    if (source.youtube) assert.match(source.youtube.id, /^[\w-]{11}$/, `${key}: a YouTube id`)
    if (source.legal) assert.ok(normalizeLegalLink(source.legal), `${key}: the legal link validates`)
    assert.ok(source.youtube || source.legal, `${key}: has a source`)
  }
})
