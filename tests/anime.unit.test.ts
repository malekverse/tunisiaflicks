// Unit tests for the anime section's rules (src/lib/anime/model): Kids and Halal filtering, seasons,
// how many episodes are out, AniList's descriptions, cards and the players' addresses.
// No server, no database, no network:
//   npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  airedEpisodes, allowedFor, animeSources, cardsFor, excludedGenres, nextSeason, plainDescription, rowVariables, seasonOf, toCard,
} from '@/src/lib/anime/model'

const everyone = { kids: false, halal: false }
const halal = { kids: false, halal: true }
const kids = { kids: true, halal: false }

test('excludedGenres: Hentai always; Halal adds Ecchi and Romance; Kids adds horror and the like', () => {
  assert.deepEqual(excludedGenres(everyone), ['Hentai'])
  assert.deepEqual(excludedGenres(halal).sort(), ['Ecchi', 'Hentai', 'Romance'])
  for (const genre of ['Ecchi', 'Horror', 'Psychological', 'Thriller']) assert.ok(excludedGenres(kids).includes(genre), genre)
})

test('allowedFor: adult never; tags count only when they are a real part of the show', () => {
  assert.equal(allowedFor({ isAdult: true, genres: ['Action'] }, everyone), false)
  assert.equal(allowedFor({ genres: ['Action'], tags: [{ name: 'Heterosexual', rank: 30 }] }, halal), true, 'a minor love subplot')
  assert.equal(allowedFor({ genres: ['Action'], tags: [{ name: 'Heterosexual', rank: 75 }] }, halal), false, 'romance at the heart of it')
  assert.equal(allowedFor({ genres: ['Comedy'], tags: [{ name: 'Female Harem', rank: 80 }] }, halal), false)
  assert.equal(allowedFor({ genres: ['Action'], tags: [{ name: 'Nudity', rank: 30 }] }, halal), false, 'a few nude scenes are enough')
  assert.equal(allowedFor({ genres: ['Romance', 'Drama'] }, halal), false)
  assert.equal(allowedFor({ genres: ['Romance', 'Drama'] }, everyone), true)
  assert.equal(allowedFor({ genres: ['Action'], tags: [{ name: 'Gore', rank: 70 }] }, kids), false)
  assert.equal(allowedFor({ genres: ['Action'], tags: [{ name: 'Gore', rank: 70 }] }, halal), true, 'violence is fine in Halal mode')
})

test('seasons: Winter is January to March; Fall rolls over to next year’s Winter', () => {
  assert.deepEqual(seasonOf(new Date('2026-10-13T12:00:00Z')), { season: 'FALL', year: 2026 })
  assert.deepEqual(seasonOf(new Date('2026-02-01T00:00:00Z')), { season: 'WINTER', year: 2026 })
  assert.deepEqual(nextSeason({ season: 'FALL', year: 2026 }), { season: 'WINTER', year: 2027 })
  assert.deepEqual(nextSeason({ season: 'SPRING', year: 2026 }), { season: 'SUMMER', year: 2026 })
  assert.deepEqual(rowVariables('upcoming', new Date('2026-10-13T00:00:00Z')), { sort: ['POPULARITY_DESC'], season: 'WINTER', year: 2027 })
  assert.deepEqual(rowVariables('movies', new Date()), { sort: ['POPULARITY_DESC'], format: 'MOVIE' })
})

test('airedEpisodes: the ones before the next while airing, all when finished, none before it starts', () => {
  assert.equal(airedEpisodes({ status: 'RELEASING', episodes: 24, next: { episode: 6, airingAt: 0 }, format: 'TV' }), 5)
  assert.equal(airedEpisodes({ status: 'RELEASING', episodes: null, next: { episode: 1181, airingAt: 0 }, format: 'TV' }), 1180)
  assert.equal(airedEpisodes({ status: 'FINISHED', episodes: 28, next: null, format: 'TV' }), 28)
  assert.equal(airedEpisodes({ status: 'FINISHED', episodes: null, next: null, format: 'MOVIE' }), 1)
  assert.equal(airedEpisodes({ status: 'NOT_YET_RELEASED', episodes: 12, next: null, format: 'TV' }), 0)
})

test('plainDescription: no HTML, no source credit', () => {
  assert.equal(plainDescription('The adventure is over.<br><br>But <i>life</i> goes on &amp; on.<br>\n(Source: Crunchyroll)'), 'The adventure is over.\n\nBut life goes on & on.')
  assert.equal(plainDescription(null), null)
  assert.equal(plainDescription('<br>'), null)
})

test('toCard: the title in the viewer’s preference, the score out of 10, a YouTube trailer only', () => {
  const media = {
    id: 154587, idMal: 52991, format: 'TV', status: 'FINISHED', episodes: 28, season: 'FALL', seasonYear: 2023, averageScore: 91, genres: ['Adventure'],
    title: { romaji: 'Sousou no Frieren', english: 'Frieren: Beyond Journey’s End', native: '葬送のフリーレン' },
    coverImage: { extraLarge: 'https://x/cover.jpg', color: '#e4bba1' }, bannerImage: 'https://x/banner.jpg',
    studios: { nodes: [{ name: 'MADHOUSE' }] }, trailer: { id: 'abc', site: 'youtube' }, description: 'A tale.',
  }
  const english = toCard(media, 'english')
  assert.equal(english.title, 'Frieren: Beyond Journey’s End')
  assert.deepEqual(english.altTitles, ['Sousou no Frieren', '葬送のフリーレン'])
  assert.equal(english.score, 9.1)
  assert.equal(english.studio, 'MADHOUSE')
  assert.equal(english.trailer, 'abc')
  assert.equal(toCard(media, 'romaji').title, 'Sousou no Frieren')
  assert.equal(toCard({ ...media, trailer: { id: 'x', site: 'dailymotion' } }).trailer, null)
  assert.equal(toCard({ ...media, title: { romaji: 'Only Romaji' } }, 'english').title, 'Only Romaji')
})

test('cardsFor: filters for the viewer before the limit', () => {
  const list = [
    { id: 1, genres: ['Romance'], title: { romaji: 'A' } },
    { id: 2, genres: ['Action'], title: { romaji: 'B' } },
    { id: 3, genres: ['Action'], isAdult: true, title: { romaji: 'C' } },
  ]
  assert.deepEqual(cardsFor(list, halal, 'english').map((card) => card.id), [2])
  assert.deepEqual(cardsFor(list, everyone, 'english').map((card) => card.id), [1, 2])
})

test('animeSources: AniList id and episode, sub or dub; VidLink only with a MyAnimeList id', () => {
  const sources = animeSources({ id: 154587, idMal: 52991, format: 'TV' }, 3, true)
  assert.deepEqual(sources.map((source) => source.name), ['Videasy', 'VidNest', 'VidLink'])
  assert.equal(sources[0].url, 'https://player.videasy.net/anime/154587/3?color=ff0f00&dub=true')
  assert.equal(sources[1].url, 'https://vidnest.fun/anime/154587/3/dub')
  assert.match(sources[2].url, /^https:\/\/vidlink\.pro\/anime\/52991\/3\/dub\?/)
  assert.deepEqual(animeSources({ id: 1, idMal: null, format: 'TV' }, 1, false).map((source) => source.name), ['Videasy', 'VidNest'])
  assert.equal(animeSources({ id: 199, idMal: null, format: 'MOVIE' }, 1, false)[0].url, 'https://player.videasy.net/anime/199?color=ff0f00')
  assert.match(animeSources({ id: 1, idMal: null, format: 'TV' }, 0, false)[1].url, /\/1\/sub$/, 'episode 0 means the first')
})
