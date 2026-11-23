// Unit tests for lib/guess-music: Guess the film from its music.
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CLIPS, clipFor, isPlayableMusicDay, musicArchiveDays, musicHeading, musicNumber, MUSIC_EPOCH, pickTrack, type TrackChoice,
} from '@/src/lib/guess-music'
import { shareText, type Entry } from '@/src/lib/guess'

const track = (id: number, title: string, extra: Partial<TrackChoice> = {}): TrackChoice => ({ id, title, explicit: false, hasPreview: true, duration: 180, ...extra })

describe('Music game days', () => {
  test('numbered from its own first day', () => {
    assert.equal(musicNumber(MUSIC_EPOCH), 1)
    assert.equal(musicNumber('2026-12-01'), 9)
    assert.ok(isPlayableMusicDay(MUSIC_EPOCH, MUSIC_EPOCH))
    assert.ok(!isPlayableMusicDay('2026-11-22', '2026-12-01'))
    assert.ok(!isPlayableMusicDay('2026-12-02', '2026-12-01'))
  })
  test('the archive goes back to #1, newest first', () => {
    assert.deepEqual(musicArchiveDays('2026-11-25'), ['2026-11-25', '2026-11-24', '2026-11-23'])
    assert.equal(musicArchiveDays('2027-06-01').length, 60)
  })
  test('more of the track with every stage', () => {
    assert.deepEqual(CLIPS, [1, 2, 4, 8, 15, 30])
    assert.equal(clipFor(1), 1)
    assert.equal(clipFor(6), 30)
  })
  test('the share says which game it was', () => {
    const entries: Entry[] = [{ kind: 'skip' }, { kind: 'guess', id: 1, title: 'x', year: null, poster_path: null, right: true, hint: null }]
    const text = shareText(MUSIC_EPOCH, entries, 'https://tunisiaflicks.app/guess/music', musicHeading(MUSIC_EPOCH))
    assert.ok(text.startsWith('TunisiaFlicks 🎵 #1 2/6'))
    assert.ok(text.endsWith('/guess/music'))
  })
})

describe('Which track a day plays', () => {
  test('the main theme first', () => {
    const tracks = [track(1, 'Arrival'), track(2, 'Main Title'), track(3, 'The Chase')]
    assert.equal(pickTrack(tracks, ['Jaws'])?.id, 2)
  })
  test('else a track named after the film', () => {
    const tracks = [track(1, 'Arrival'), track(2, 'Interstellar'), track(3, 'Docking')]
    assert.equal(pickTrack(tracks, ['Interstellar'])?.id, 2)
  })
  test('else the first good one', () => {
    assert.equal(pickTrack([track(1, 'Arrival'), track(2, 'Docking')], ['Up'])?.id, 1)
  })
  test('never explicit lyrics, dialogue, a sting or a track without a preview', () => {
    const tracks = [
      track(1, 'Main Title', { explicit: true }),
      track(2, 'Theme (Dialogue)'),
      track(3, 'Theme', { hasPreview: false }),
      track(4, 'Opening', { duration: 12 }),
      track(5, 'Night Drive'),
    ]
    assert.equal(pickTrack(tracks, ['Drive'])?.id, 5)
  })
  test('a short track still beats nothing', () => {
    assert.equal(pickTrack([track(1, 'Sting', { duration: 20 })], ['X'])?.id, 1)
  })
  test('none worth playing', () => {
    assert.equal(pickTrack([track(1, 'Theme', { hasPreview: false })], ['X']), null)
    assert.equal(pickTrack([], ['X']), null)
  })
})
