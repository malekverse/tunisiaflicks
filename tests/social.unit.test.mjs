// Unit tests for the social layer's pure rules (no server, no database):
//   npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  blockFilter, canMergeInto, canSeeWith, checkHandle, cleanDisplayName, cleanNote, cleanUserText, countLabelFor,
  eventKey, foldForReserved, handleIdeas, hasReservedSubstring, ipKey, isBlockedWith, mergeEligible, mergeKeyFor,
  normalizeHandle, pairKey, roundHalf, settingFor, tunisDay,
} from '@/src/lib/social/rules'
import { DEFAULT_PRIVACY, HANDLE_RE, RESERVED_HANDLES } from '@/src/lib/social/types'

// ---------------------------------------------------------------------------------------------
// Notifications

test('eventKey: kind, recipient profile and key (fits the unique {userId, event_key})', () => {
  assert.equal(eventKey('friend_request', 'p1', 'abc'), 'friend_request:p1:abc')
  assert.notEqual(eventKey('title_sent', 'p1', 'k'), eventKey('title_sent', 'p2', 'k'), 'two profiles of one account get two notifications')
  assert.equal(mergeKeyFor('title_sent', { media_type: 'movie', id: '550' }), 'title_sent:movie:550')
})

test('merge eligibility: only when asked, about a title, and without a note', () => {
  const media = { media_type: 'movie', id: '550' }
  assert.equal(mergeEligible({ merge: true, media }), true)
  assert.equal(mergeEligible({ merge: true, media, note: '' }), true)
  assert.equal(mergeEligible({ merge: true, media, note: 'Watch it tonight' }), false, 'a note never merges')
  assert.equal(mergeEligible({ merge: false, media }), false)
  assert.equal(mergeEligible({ merge: true, media: null }), false)
})

test('canMergeInto: same profile and key, unread, under 24 hours', () => {
  const now = Date.parse('2026-10-08T12:00:00Z')
  const base = { profileId: 'p1', merge_key: 'title_sent:movie:550', read: false, created_at: new Date(now - 60 * 60 * 1000) }
  const incoming = { profileId: 'p1', merge_key: 'title_sent:movie:550' }
  assert.equal(canMergeInto(base, incoming, now), true)
  assert.equal(canMergeInto({ ...base, read: true }, incoming, now), false, 'read rows start a new one')
  assert.equal(canMergeInto({ ...base, profileId: 'p2' }, incoming, now), false, 'never across profiles')
  assert.equal(canMergeInto({ ...base, profileId: null }, incoming, now), false)
  assert.equal(canMergeInto({ ...base, merge_key: 'title_sent:tv:550' }, incoming, now), false)
  assert.equal(canMergeInto({ ...base, merge_key: null }, incoming, now), false, 'a row with a note has no merge key')
  assert.equal(canMergeInto({ ...base, created_at: new Date(now - 25 * 60 * 60 * 1000) }, incoming, now), false)
})

// ---------------------------------------------------------------------------------------------
// Handles and names

test('handles: format', () => {
  assert.equal(normalizeHandle('  @Amine_TN '), 'amine_tn')
  assert.equal(normalizeHandle(42), null)
  for (const ok of ['amine', 'amine_tn', 'a_b', 'abc', 'x'.repeat(20), 'sami1994']) assert.equal(checkHandle(ok), null, ok)
  for (const bad of ['ab', 'x'.repeat(21), 'Amine', 'ami ne', 'amine.tn', 'émile', 'سامي', 'a-b', '']) assert.equal(checkHandle(bad), 'invalid', bad)
  assert.ok(HANDLE_RE.test('abc_123'))
})

test('handles: reserved words and substrings, after folding', () => {
  for (const word of RESERVED_HANDLES) if (HANDLE_RE.test(word)) assert.equal(checkHandle(word), 'reserved', word)
  const blocked = ['admin', 'the_admin', 'adm1n', '4dm1n', 'tunisiaflicks_fan', 'tun1s1afl1cks', 'xsupportx', 'supp0rt', 'st4ff', '5taff', 'm0derat0r', 'officia1', 'h3lp', 'l0gin']
  for (const handle of blocked) assert.equal(checkHandle(handle), 'reserved', handle)
  for (const fine of ['helpful', 'amine', 'staffa_no', 'sami']) {
    // 'staffa_no' contains 'staff': reserved; the others are fine.
    assert.equal(checkHandle(fine), fine === 'staffa_no' ? 'reserved' : null, fine)
  }
})

test('folding: NFKC, accents, separators, look-alike digits', () => {
  assert.ok(foldForReserved('Ádmïn').includes('admin'))
  assert.ok(foldForReserved('ＡＤＭＩＮ').includes('admin'), 'full-width letters fold (NFKC)')
  assert.ok(foldForReserved('a.d.m.i.n').includes('admin'))
  assert.deepEqual(foldForReserved('adm1n').sort(), ['admin', 'admln'].sort())
  assert.ok(foldForReserved('7unisia').includes('tunisia'))
  assert.equal(hasReservedSubstring('Tunisia Flicks'), true)
  assert.equal(hasReservedSubstring('Official Sami'), true)
  assert.equal(hasReservedSubstring('Sami'), false)
})

test('handle ideas are all well-formed and unreserved', () => {
  const ideas = handleIdeas('Amine', 'Amine Ben Salah', 7)
  assert.ok(ideas.length >= 3)
  for (const idea of ideas) assert.equal(checkHandle(idea), null, idea)
  assert.ok(handleIdeas('admin', 'admin', 1).every((idea) => checkHandle(idea) === null))
  assert.ok(handleIdeas('', 'سامي', 1).length >= 3, 'Arabic-only names still get ideas')
})

test('names, bios and notes: no control or direction marks, no links, capped', () => {
  assert.equal(cleanUserText('  Sami\u0000  \n Ben‮  ', 40), 'Sami Ben')
  assert.equal(cleanUserText('watch free at https://evil.example/x now', 140), 'watch free at now')
  assert.equal(cleanUserText('go to watch-free.xyz/abc today', 140), 'go to today')
  assert.equal(cleanUserText('www.example.com', 140), '')
  assert.equal(cleanNote('x'.repeat(500)).length, 140)
  assert.equal(Array.from(cleanUserText('🎬'.repeat(50), 40)).length, 40, 'counts characters, not UTF-16 units')
  assert.equal(cleanDisplayName('  Sami  '), 'Sami')
  assert.equal(cleanDisplayName('TunisiaFlicks Support'), null)
  assert.equal(cleanDisplayName('‮⁦'), null)
  assert.equal(cleanDisplayName(42), null)
})

// ---------------------------------------------------------------------------------------------
// Who sees what

const owner = { userId: 'uA', profileId: 'pA' }
const friend = { userId: 'uB', profileId: 'pB' }

/** canSee with the relations injected: friends/blocked answer as given, and count their calls. */
async function see({ viewer = friend, what = 'ratings', privacy = DEFAULT_PRIVACY, keyMatches = false, friends = false, blocked = false } = {}) {
  const calls = { friends: 0, blocked: 0 }
  const result = await canSeeWith(
    { viewer, owner, what, privacy, keyMatches },
    {
      friends: async () => { calls.friends++; return friends },
      blocked: async () => { calls.blocked++; return blocked },
    },
  )
  return { result, calls }
}

test('canSee: the owner always sees, nobody else by default', async () => {
  for (const what of ['activity', 'ratings', 'badges']) {
    assert.equal((await see({ viewer: owner, what, privacy: null })).result, true)
    assert.equal((await see({ what, friends: true })).result, false, `${what} is private by default`)
  }
  assert.equal((await see({ privacy: null, friends: true })).result, false, 'no page, nothing to see')
})

test('canSee: the matrix', async () => {
  const rows = [
    // setting, viewer, friends, key, blocked, paused -> expected
    ['friends', friend, true, false, false, false, true],
    ['friends', friend, false, false, false, false, false],
    ['friends', friend, false, true, false, false, false],
    ['friends', null, false, true, false, false, false],
    ['link', friend, true, false, false, false, true],
    ['link', friend, false, true, false, false, true],
    ['link', null, false, true, false, false, true],
    ['link', null, false, false, false, false, false],
    ['link', friend, false, false, false, false, false],
    ['link', friend, true, true, true, false, false],
    ['friends', friend, true, false, true, false, false],
    ['friends', friend, true, false, false, true, false],
    ['link', null, false, true, false, true, false],
    ['private', friend, true, true, false, false, false],
  ]
  for (const [setting, viewer, friends, keyMatches, blocked, paused, expected] of rows) {
    const privacy = { ...DEFAULT_PRIVACY, ratings: setting, badges: setting, paused }
    for (const what of ['ratings', 'badges']) {
      const { result } = await see({ viewer, what, privacy, friends, keyMatches, blocked })
      assert.equal(result, expected, `${what}=${setting} viewer=${viewer ? 'signed in' : 'guest'} friends=${friends} key=${keyMatches} blocked=${blocked} paused=${paused}`)
    }
  }
})

test('canSee: activity is never shown through the link', async () => {
  const privacy = { ...DEFAULT_PRIVACY, activity: 'link' }
  assert.equal(settingFor(privacy, 'activity'), 'private', 'a stored "link" for activity reads as private')
  assert.equal((await see({ what: 'activity', privacy: { ...DEFAULT_PRIVACY, activity: 'friends' }, keyMatches: true })).result, false)
  assert.equal((await see({ viewer: null, what: 'activity', privacy: { ...DEFAULT_PRIVACY, activity: 'friends' }, keyMatches: true })).result, false)
  assert.equal((await see({ what: 'activity', privacy: { ...DEFAULT_PRIVACY, activity: 'friends' }, friends: true })).result, true)
})

test('canSee: relations are only looked up when they matter', async () => {
  const quiet = await see({ friends: true })
  assert.deepEqual(quiet.calls, { friends: 0, blocked: 0 }, 'private: no lookups at all')
  const guest = await see({ viewer: null, privacy: { ...DEFAULT_PRIVACY, ratings: 'link' }, keyMatches: true })
  assert.equal(guest.calls.blocked, 0, 'a guest has nobody to be blocked by')
})

// ---------------------------------------------------------------------------------------------
// Blocks cover whole accounts

/** A stand-in for the blocks collection: findOne over $or of plain equality clauses. */
function blocksCollection(docs) {
  const matches = (doc, clause) => Object.entries(clause).every(([key, value]) => doc[key] === value)
  return {
    findOne: async (filter) => docs.find((doc) => filter.$or.some((clause) => matches(doc, clause))) ?? null,
  }
}

test('isBlockedEitherWay: profile pairs and account pairs, both directions', async () => {
  const A1 = { userId: 'uA', profileId: 'pA1' }
  const A2 = { userId: 'uA', profileId: 'pA2' }
  const B1 = { userId: 'uB', profileId: 'pB1' }
  const B2 = { userId: 'uB', profileId: 'pB2' }
  const C1 = { userId: 'uC', profileId: 'pC1' }
  // A1 blocked B1.
  const blocks = blocksCollection([{ blockerProfileId: 'pA1', blockerUserId: 'uA', blockedProfileId: 'pB1', blockedUserId: 'uB' }])
  assert.equal(await isBlockedWith(blocks, A1, B1), true)
  assert.equal(await isBlockedWith(blocks, B1, A1), true, 'either way')
  assert.equal(await isBlockedWith(blocks, B2, A1), true, "B's other profile can't reach A")
  assert.equal(await isBlockedWith(blocks, A1, B2), true)
  assert.equal(await isBlockedWith(blocks, A2, B2), true, 'the whole account, both sides')
  assert.equal(await isBlockedWith(blocks, B2, A2), true)
  assert.equal(await isBlockedWith(blocks, A1, C1), false)
  assert.equal(await isBlockedWith(blocks, C1, B1), false)
  assert.equal(await isBlockedWith(blocks, A1, A2), false, 'one account is never blocked from itself')
  assert.equal(blockFilter(A1, B1).$or.length, 4)
})

// ---------------------------------------------------------------------------------------------
// Small things

test('pairs, averages, bands, days and address keys', () => {
  assert.equal(pairKey('b', 'a'), pairKey('a', 'b'))
  assert.equal(roundHalf(3.74), 3.5)
  assert.equal(roundHalf(3.76), 4)
  assert.equal(countLabelFor(19), null)
  assert.equal(countLabelFor(20), '20+')
  assert.equal(countLabelFor(77), '50+')
  assert.equal(countLabelFor(100), '100+')
  assert.equal(countLabelFor(1200), '500+')
  // 23:30 UTC on Oct 8 is already Oct 9 in Tunis (UTC+1).
  assert.equal(tunisDay('2026-10-08T23:30:00Z'), '2026-10-09')
  assert.equal(ipKey('41.226.1.2'), '41.226.1.2')
  assert.equal(ipKey('2001:db8:85a3:0000:0000:8a2e:0370:7334'), '2001:db8:85a3:0::/64')
  assert.equal(ipKey('2001:db8::1'), '2001:db8:0:0::/64')
  assert.equal(ipKey('2001:db8:85a3:12::1'), ipKey('2001:db8:85a3:12:ffff::2'), 'one /64, one key')
})
