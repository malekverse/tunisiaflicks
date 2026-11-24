// Unit tests for lib/tv-send's rules: what may be sent to a TV, and the page it opens.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanSentMedia, sentPath } from '@/src/lib/tv-send-rules'

describe('Play on my TV', () => {
  test('a film or an episode, by its TMDB id', () => {
    assert.deepEqual(cleanSentMedia({ type: 'movie', id: 550 }), { type: 'movie', id: '550' })
    assert.deepEqual(cleanSentMedia({ type: 'tv', id: '1399', season: 1, episode: 2 }), { type: 'tv', id: '1399', season: 1, episode: 2 })
    assert.equal(cleanSentMedia({ type: 'tv', id: '1399' }), null)
    assert.equal(cleanSentMedia({ type: 'movie', id: '../admin' }), null)
    assert.equal(cleanSentMedia({ type: 'person', id: '1' }), null)
    assert.equal(cleanSentMedia(null), null)
  })
  test('opens the player, at the episode', () => {
    assert.equal(sentPath({ type: 'movie', id: '550' }), '/movie/550#streamSection')
    assert.equal(sentPath({ type: 'tv', id: '1399', season: 2, episode: 5 }), '/tv/1399?s=2&e=5#streamSection')
  })
})
