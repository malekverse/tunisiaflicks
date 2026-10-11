// The native apps' API: the shapes the apps read (src/lib/app-api/shared.ts, lists.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readQuery, toCard, toCards } from '@/src/lib/app-api/shared'
import { isListKey } from '@/src/lib/app-api/lists'

test('a TMDB movie, show or search result becomes a card; people and broken entries do not', () => {
  assert.deepEqual(toCard({ id: 550, title: 'Fight Club', poster_path: '/p.jpg', backdrop_path: '/b.jpg', release_date: '1999-10-15', vote_average: 8.433, vote_count: 30000 }, 'movie'), {
    id: 550, kind: 'movie', title: 'Fight Club', poster: '/p.jpg', backdrop: '/b.jpg', year: '1999', rating: 8.4,
  })
  const show = toCard({ id: 1399, media_type: 'tv', name: 'Game of Thrones', poster_path: '/g.jpg', first_air_date: '2011-04-17', vote_average: 8.5, vote_count: 0 })
  assert.equal(show.kind, 'tv')
  assert.equal(show.year, '2011')
  assert.equal(show.rating, null, 'no votes, no rating')
  assert.equal(toCard({ id: 1, media_type: 'person', name: 'Someone' }), null)
  assert.equal(toCard({ id: 2, media_type: 'movie' }), null, 'no title')
  assert.equal(toCard(null, 'movie'), null)
})

test('cards drop duplicates and titles without any picture', () => {
  const cards = toCards([
    { id: 1, media_type: 'movie', title: 'A', poster_path: '/a.jpg' },
    { id: 1, media_type: 'movie', title: 'A again', poster_path: '/a.jpg' },
    { id: 1, media_type: 'tv', name: 'A, the show', poster_path: '/s.jpg' },
    { id: 2, media_type: 'movie', title: 'No picture' },
  ])
  assert.deepEqual(cards.map((card) => `${card.kind}:${card.id}`), ['movie:1', 'tv:1'])
  assert.deepEqual(toCards(undefined), [])
})

test('the query: any site language (English otherwise), and kids only when asked', () => {
  assert.deepEqual(readQuery(new URL('https://x/api?lang=ar&kids=1')), { locale: 'ar', kids: true })
  assert.deepEqual(readQuery(new URL('https://x/api?lang=de')), { locale: 'en', kids: false })
  assert.deepEqual(readQuery(new URL('https://x/api')), { locale: 'en', kids: false })
})

test('list keys: the fixed lists, Tunisian, and genres; nothing else', () => {
  for (const key of ['trending-movies', 'popular-tv', 'upcoming', 'tunisian-movies', 'tunisian-tv', 'genre-movie-28', 'genre-tv-18']) assert.ok(isListKey(key), key)
  for (const key of ['nope', 'genre-book-1', 'genre-movie-', 'genre-movie-1234567', '../etc']) assert.ok(!isListKey(key), key)
})
