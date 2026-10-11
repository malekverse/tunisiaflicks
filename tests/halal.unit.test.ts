// Unit tests for Halal mode's rules (src/lib/halal-rules): the decision per title, reading a
// model's grades, which TMDB answers carry titles, and taking hidden titles out of an answer.
// No server, no database, no network:
//   npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ROMANCE_GENRE, fallbackHidden, hiddenByFacts, hiddenByGrades, isHidden, kindOfPath, mayCarryTitles,
  readGrades, titleLists, titleRef, withoutHidden, type Facts,
} from '@/src/lib/halal-rules'

const facts = (over: Partial<Facts> = {}): Facts => ({ adult: false, genres: [], keywords: [], cert: 'PG-13', ...over })

test('grades: any nudity, a real sex scene, or an intimate romance at the centre hides a title', () => {
  // As the model graded them (gpt-oss-120b): Titanic, The Notebook, La La Land, Game of Thrones hidden…
  assert.equal(hiddenByGrades({ sex: 'moderate', nudity: 'moderate', romance: 'central' }), true)
  assert.equal(hiddenByGrades({ sex: 'mild', nudity: 'none', romance: 'central' }), true)
  assert.equal(hiddenByGrades({ sex: 'severe', nudity: 'severe', romance: 'subplot' }), true)
  assert.equal(hiddenByGrades({ sex: 'none', nudity: 'mild', romance: 'none' }), true)
  // …The Matrix, The Dark Knight, Interstellar, Frozen shown.
  assert.equal(hiddenByGrades({ sex: 'mild', nudity: 'none', romance: 'subplot' }), false)
  assert.equal(hiddenByGrades({ sex: 'none', nudity: 'none', romance: 'subplot' }), false)
  assert.equal(hiddenByGrades({ sex: 'none', nudity: 'none', romance: 'central' }), false)
})

test('facts: adult, a sexual keyword or NC-17 settle it; a missing keyword proves nothing', () => {
  assert.equal(hiddenByFacts(facts({ adult: true })), true)
  assert.equal(hiddenByFacts(facts({ keywords: [12, 281741] })), true) // nudity
  assert.equal(hiddenByFacts(facts({ cert: 'NC-17' })), true)
  assert.equal(hiddenByFacts(facts({ cert: 'R' })), false)
  assert.equal(hiddenByFacts(facts({ keywords: [12, 34] })), false)
})

test('fallback (no grades yet): adult ratings and romance-genre titles are hidden', () => {
  assert.equal(fallbackHidden(facts({ cert: 'R' })), true)
  assert.equal(fallbackHidden(facts({ cert: 'TV-MA' })), true)
  assert.equal(fallbackHidden(facts({ genres: [18, ROMANCE_GENRE] })), true)
  assert.equal(fallbackHidden(facts({ cert: 'PG-13', genres: [28, 878] })), false)
  assert.equal(fallbackHidden(facts({ cert: '' })), false)
})

test('the decision: reports, then facts, then grades, then the fallback', () => {
  const okGrades = { sex: 'none', nudity: 'none', romance: 'none' } as const
  assert.equal(isHidden({ reports: 1, facts: facts(), grades: okGrades }), true, 'a report wins')
  assert.equal(isHidden({ facts: facts({ keywords: [354470] }), grades: okGrades }), true, 'a sex-scene keyword beats the grades')
  assert.equal(isHidden({ facts: facts({ cert: 'R' }), grades: okGrades }), false, 'grades clear an R-rated action film')
  assert.equal(isHidden({ facts: facts({ cert: 'R' }), grades: null }), true, 'unknown to the AI: the fallback')
  assert.equal(isHidden({ facts: facts({ cert: 'R' }) }), true, 'not graded yet: the fallback')
  assert.equal(isHidden({ item: { genres: [ROMANCE_GENRE] } }), true, 'no facts: the list item alone')
  assert.equal(isHidden({ item: { genres: [28] } }), false)
})

test('readGrades: well-formed grades, null when unknown, undefined when unreadable', () => {
  assert.deepEqual(readGrades({ id: 'movie:1', sex: 'mild', nudity: 'none', romance: 'subplot', known: true }), { sex: 'mild', nudity: 'none', romance: 'subplot' })
  assert.equal(readGrades({ id: 'movie:1', known: false, sex: null }), null)
  assert.equal(readGrades({ id: 'movie:1', sex: 'lots', nudity: 'none', romance: 'none' }), undefined)
  assert.equal(readGrades(null), undefined)
})

test('mayCarryTitles: lists and appended lists, never keywords, ratings or episodes', () => {
  for (const path of ['discover/movie', 'trending/all/week', 'search/multi', 'movie/popular', 'tv/on_the_air', 'movie/603/recommendations', 'tv/1399/similar', 'person/287/combined_credits', 'collection/10', '/discover/tv']) {
    assert.equal(mayCarryTitles(path), true, path)
  }
  for (const path of ['movie/603', 'movie/603/keywords', 'tv/1399/keywords', 'movie/603/release_dates', 'tv/1399/season/1', 'search/person', 'search/keyword', 'genre/movie/list']) {
    assert.equal(mayCarryTitles(path), false, path)
  }
  assert.equal(mayCarryTitles('movie/603', { append_to_response: 'images,recommendations' }), true)
  assert.equal(mayCarryTitles('person/287', { append_to_response: 'combined_credits' }), true)
  assert.equal(mayCarryTitles('movie/603', { append_to_response: 'images,credits,videos' }), false)
})

test('kindOfPath and titleRef: the kind comes from the item, else from the path', () => {
  assert.equal(kindOfPath('discover/tv'), 'tv')
  assert.equal(kindOfPath('movie/603/similar'), 'movie')
  assert.equal(kindOfPath('trending/all/week'), null)
  assert.equal(kindOfPath('person/1/tv_credits'), 'tv')
  assert.deepEqual(titleRef({ id: 597, title: 'Titanic', release_date: '1997-11-18', genre_ids: [18, 10749] }, 'movie'),
    { kind: 'movie', id: 597, title: 'Titanic', year: '1997', adult: false, genres: [18, 10749] })
  assert.equal(titleRef({ id: 287, media_type: 'person', name: 'Brad Pitt' }, 'movie'), null)
  assert.equal(titleRef({ id: 1399, media_type: 'tv', name: 'Game of Thrones' }, null)?.kind, 'tv')
  assert.equal(titleRef({ name: 'no id' }, 'tv'), null)
})

test('withoutHidden: hidden titles leave every list, people and the rest stay', () => {
  const hidden = new Set(['movie:597', 'tv:1399'])
  const multi = {
    page: 1,
    results: [
      { id: 597, media_type: 'movie', title: 'Titanic' },
      { id: 603, media_type: 'movie', title: 'The Matrix' },
      { id: 6193, media_type: 'person', name: 'Leonardo DiCaprio', known_for: [{ id: 597, media_type: 'movie' }, { id: 27205, media_type: 'movie' }] },
      { id: 1399, media_type: 'tv', name: 'Game of Thrones' },
    ],
  }
  const out = withoutHidden('search/multi', multi, hidden)
  assert.deepEqual(out.results.map((item: any) => item.id), [603, 6193])
  assert.deepEqual(out.results[1].known_for.map((item: any) => item.id), [27205])
  assert.equal(out.page, 1)
  assert.equal(multi.results.length, 4, 'the original answer is not changed')

  const detail = { id: 603, title: 'The Matrix', recommendations: { page: 1, results: [{ id: 597 }, { id: 604 }] }, credits: { cast: [{ id: 6384, name: 'Keanu Reeves' }] } }
  const filtered = withoutHidden('movie/603', detail, hidden)
  assert.deepEqual(filtered.recommendations.results.map((item: any) => item.id), [604])
  assert.equal(filtered.credits.cast.length, 1, 'cast (people) untouched')

  const person = { cast: [{ id: 1399, media_type: 'tv' }, { id: 603, media_type: 'movie' }], crew: [] }
  assert.deepEqual(withoutHidden('person/1/combined_credits', person, hidden).cast.map((item: any) => item.id), [603])

  assert.equal(titleLists('movie/603/keywords', { id: 603, keywords: [{ id: 1 }] }).length, 0)
})
