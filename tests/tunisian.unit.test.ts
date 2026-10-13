// Unit tests for the Tunisian catalogue's parsing (src/lib/tunisian): the player a post or an
// episode page embeds (YouTube, VK Video, iframely), the episode links that are real (not the
// source's placeholders), which titles have something to watch, and a Tunisian TV series' uploads
// as the seasons of a series the source has no episodes of. No network:
//   npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { episodeLinks, isPlayable, playerIn, toSourceUrl, tvSeasons, youtubeIdIn } from '@/src/lib/tunisian'

test('youtubeIdIn: embeds, watch links, short links; nothing for placeholders', () => {
  assert.equal(youtubeIdIn('<div class="player-container"><iframe src="https://www.youtube.com/embed/OoRz5T7VuvE?si=g1DHx1le_LGD02rc"></iframe></div>'), 'OoRz5T7VuvE')
  assert.equal(youtubeIdIn('<iframe src="https://www.youtube-nocookie.com/embed/fT6DYM0tzaE"></iframe>'), 'fT6DYM0tzaE')
  assert.equal(youtubeIdIn('<a href="https://www.youtube.com/watch?v=NNXJxFrSqEo&t=3">'), 'NNXJxFrSqEo')
  assert.equal(youtubeIdIn('<a href="https://youtu.be/pKlpVpOd4U4">'), 'pKlpVpOd4U4')
  // The source's unfinished films: "put the watch server link here".
  assert.equal(youtubeIdIn('<iframe src="ضع_هنا_رابط_سيرفر_المشاهدة"></iframe>'), null)
  assert.equal(youtubeIdIn('https://www.youtube.com/embed/tooShort'), null)
  assert.equal(youtubeIdIn(null), null)
})

test('episodeLinks: only real links on the source site', () => {
  const html = `
    <div class="season-grid" data-season="1">
      <a class="episode-item" href="https://www.tunigazelle-news.xyz/p/1_01626732853.html">الحلقة 1</a>
      <a href="/p/2-3.html" class="episode-item active">الحلقة 2</a>
      <a class="episode-item" href="ضع_هنا_رابط_الحلقة">الحلقة 3</a>
      <a class="episode-item" href="https://evil.example/p/x.html">الحلقة 4</a>
      <a class="other" href="https://www.tunigazelle-news.xyz/p/not-an-episode.html">x</a>
    </div>`
  assert.deepEqual(episodeLinks(html), [
    'https://www.tunigazelle-news.xyz/p/1_01626732853.html',
    'https://www.tunigazelle-news.xyz/p/2-3.html',
  ])
})

test('isPlayable: a film needs its video, a series at least one real episode', () => {
  assert.equal(isPlayable('movie', '<iframe src="https://www.youtube.com/embed/OoRz5T7VuvE"></iframe>'), true)
  assert.equal(isPlayable('movie', '<iframe src="ضع_هنا_رابط_سيرفر_المشاهدة"></iframe>'), false)
  assert.equal(isPlayable('series', '<a class="episode-item" href="ضع_هنا">1</a>'), false)
  assert.equal(isPlayable('series', '<a class="episode-item" href="/p/1.html">1</a>'), true)
})

test('toSourceUrl: only the source site, never placeholders or other hosts', () => {
  assert.equal(toSourceUrl('/2026/10/film-weekend.html'), 'https://www.tunigazelle-news.xyz/2026/10/film-weekend.html')
  assert.equal(toSourceUrl('ضع_هنا_رابط_الحلقة'), null)
  assert.equal(toSourceUrl('https://evil.example/2026/10/x.html'), null)
  assert.equal(toSourceUrl('javascript:alert(1)'), null)
})

test('playerIn: YouTube, VK Video and iframely players; typos repaired; anything else refused', () => {
  assert.deepEqual(playerIn('<iframe src="https://www.youtube.com/embed/WKv4W3JP4OM?si=x"></iframe>'), { type: 'youtube', id: 'WKv4W3JP4OM' })
  assert.deepEqual(playerIn('<iframe src="https://vkvideo.ru/video_ext.php?oid=-234673217&amp;id=456239025&amp;hash=82073390ff9f2cd2"></iframe>'),
    { type: 'embed', url: 'https://vkvideo.ru/video_ext.php?oid=-234673217&id=456239025&hash=82073390ff9f2cd2' })
  // The source's typo: "ttps://".
  assert.deepEqual(playerIn('<iframe src="ttps://vkvideo.ru/video_ext.php?oid=-1&id=2&hash=3"></iframe>'), { type: 'embed', url: 'https://vkvideo.ru/video_ext.php?oid=-1&id=2&hash=3' })
  assert.deepEqual(playerIn('<iframe src="https://iframely.net/HRKaZmVN?theme=dark"></iframe>'), { type: 'iframely', url: 'https://iframely.net/HRKaZmVN?theme=dark' })
  // Only VK's player page, never another VK page or another site.
  assert.equal(playerIn('<iframe src="https://vk.com/feed"></iframe>'), null)
  assert.equal(playerIn('<iframe src="https://evil.example/video_ext.php"></iframe>'), null)
  assert.equal(playerIn('<iframe src="javascript:alert(1)"></iframe>'), null)
  assert.equal(playerIn('<iframe src="ضع_هنا_رابط_سيرفر_المشاهدة"></iframe>'), null)
})

test('tvSeasons: uploads by season, in episode and part order, each once, all playing here', () => {
  const upload = (id: string, episode: number | null, o: { part?: number, season?: number, at?: string, subtitle?: string } = {}) => ({
    _id: id, title: `Upload ${id}`, episode, part: o.part ?? null, season: o.season ?? null, subtitle: o.subtitle ?? null, publishedAt: o.at ?? '2026-02-20T20:00:00.000Z',
  })
  const seasons = tvSeasons([
    upload('aaaaaaaaaa2', 2),
    upload('aaaaaaaaa1b', 1, { part: 2 }),
    upload('aaaaaaaaa1a', 1, { part: 1 }),
    // The same episode uploaded again: the latest one plays.
    upload('aaaaaaaold2', 2, { at: '2026-02-19T20:00:00.000Z' }),
    upload('bbbbbbbbbb1', 1, { season: 2 }),
    upload('ccccccccccc', null, { subtitle: 'الحلقة الخاصة' }),
  ])
  assert.deepEqual(seasons.map((season) => season.season), [1, 2])
  assert.deepEqual(seasons[0].episodes.map((episode) => episode.label), ['الحلقة 1 · الجزء 1', 'الحلقة 1 · الجزء 2', 'الحلقة 2', 'الحلقة الخاصة'])
  assert.deepEqual(seasons[0].episodes[2], { label: 'الحلقة 2', url: 'https://www.youtube.com/watch?v=aaaaaaaaaa2', media: { type: 'youtube', id: 'aaaaaaaaaa2' } })
  assert.deepEqual(seasons[1].episodes.map((episode) => episode.media), [{ type: 'youtube', id: 'bbbbbbbbbb1' }])
  assert.deepEqual(tvSeasons([]), [])
})
