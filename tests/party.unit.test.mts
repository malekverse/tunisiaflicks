// Unit tests for lib/party-rules: watch parties.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  cleanPartyMedia, cleanSdp, isPartyCode, normalizePartyCode, partyCodeFrom, partyPath, readPartyMessage, SDP_MAX,
} from '@/src/lib/party-rules'

describe('Party codes', () => {
  test('six letters and digits that can’t be mistaken', () => {
    const code = partyCodeFrom(new Uint8Array([0, 1, 2, 3, 250, 255]))
    assert.ok(isPartyCode(code), code)
    assert.ok(!isPartyCode('ABC12O'))   // no O
    assert.ok(!isPartyCode('abc123'))
  })
  test('typed any old way', () => {
    assert.equal(normalizePartyCode(' abc-234 '), 'ABC234')
    assert.equal(normalizePartyCode('XYZ 789'), 'XYZ789')
    assert.equal(normalizePartyCode('ab'), null)
    assert.equal(normalizePartyCode(42), null)
  })
})

describe('What a party watches', () => {
  test('a film, or an episode', () => {
    assert.deepEqual(cleanPartyMedia({ type: 'movie', id: '550' }), { type: 'movie', id: '550' })
    assert.deepEqual(cleanPartyMedia({ type: 'tv', id: 1399, season: 1, episode: 2 }), { type: 'tv', id: '1399', season: 1, episode: 2 })
    assert.equal(cleanPartyMedia({ type: 'tv', id: '1399', season: 1 }), null)
    assert.equal(cleanPartyMedia({ type: 'movie', id: '../x' }), null)
    assert.equal(cleanPartyMedia(null), null)
  })
  test('its page, with the party in the address', () => {
    assert.equal(partyPath({ type: 'movie', id: '550' }, 'ABC234'), '/movie/550?party=ABC234#streamSection')
    assert.equal(partyPath({ type: 'tv', id: '1399', season: 2, episode: 5 }, 'ABC234'), '/tv/1399?s=2&e=5&party=ABC234#streamSection')
  })
  test('a connection offer of a sensible size', () => {
    assert.ok(cleanSdp('v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\n'))
    assert.equal(cleanSdp('hello there, not an sdp at all'), null)
    assert.equal(cleanSdp(`v=0${'a'.repeat(SDP_MAX)}`), null)
  })
})

describe('What the players say', () => {
  const read = (message: unknown) => readPartyMessage(JSON.stringify(message))
  test('states, checked', () => {
    assert.deepEqual(read({ t: 'state', playing: true, pos: 12.5, by: 'Sami' }), { t: 'state', playing: true, pos: 12.5, by: 'Sami' })
    assert.deepEqual(read({ t: 'state', playing: false, pos: 3, by: 'S', beat: true }), { t: 'state', playing: false, pos: 3, by: 'S', beat: true })
    assert.equal(read({ t: 'state', playing: 'yes', pos: 1 }), null)
    assert.equal(read({ t: 'state', playing: true, pos: -4 }), null)
    assert.equal(read({ t: 'state', playing: true, pos: Number.MAX_VALUE }), null)
  })
  test('reactions from the list only, names cleaned', () => {
    assert.deepEqual(read({ t: 'react', e: '😂', name: '  Amine‮ ' }), { t: 'react', e: '😂', name: 'Amine' })
    assert.equal(read({ t: 'react', e: '💩', name: 'x' }), null)
    assert.equal(read({ t: 'people', names: 'x' }), null)
    assert.equal(read({ t: 'people', names: Array(20).fill('a') })?.t, 'people')
  })
  test('nothing else', () => {
    assert.equal(readPartyMessage('not json'), null)
    assert.equal(readPartyMessage({ t: 'sync' }), null)          // not a string
    assert.equal(read({ t: 'eval', code: '1' }), null)
    assert.equal(readPartyMessage(JSON.stringify({ t: 'hello', name: 'x'.repeat(5000) })), null)
    assert.deepEqual(read({ t: 'sync' }), { t: 'sync' })
  })
})
