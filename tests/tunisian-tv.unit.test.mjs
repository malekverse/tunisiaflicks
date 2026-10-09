// Unit tests for Tunisian TV (no server, no database, no network): the feed parser against feeds
// captured live from the channels (tests/fixtures/tunisian-tv), episode titles as the channels
// write them, series keys and kinds, playlists in descriptions, clean descriptions, cadence and
// grouped parts, plus the channel table and its switches.
//   npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  airingCadence, classifySeries, cleanDescription, decodeXml, formatDuration, groupParts, isRamadanStart, looksLiveNow,
  parseEpisodeTitle, parseFeed, parseIsoDuration, playlistIdsIn, seriesKey,
} from '@/src/lib/tunisian-tv/parse'
import { RESERVED_SLUGS, TV_CHANNELS, channelBySlug, enabledChannels, livesPlaylist, tunisianTvOff, uploadsPlaylist } from '@/src/lib/tunisian-tv/channels'
import { tunisianTv } from '@/src/lib/i18n/features/tunisian-tv'

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'tunisian-tv')
const fixture = (name) => readFileSync(path.join(FIXTURES, name), 'utf8')

// ---------------------------------------------------------------------------------------------
// Feeds

test('parseFeed: an uploads feed (UULF), captured from Watania 2', () => {
  const feed = parseFeed(fixture('watania-2-uulf.xml'))
  assert.ok(feed)
  assert.equal(feed.channelId, 'UCJW9gatYczI191TunQxMGbA')
  assert.equal(feed.playlistId, 'UULFJW9gatYczI191TunQxMGbA')
  assert.equal(feed.author, 'Watania2 Replay')
  assert.equal(feed.entries.length, 10)
  const maestro = feed.entries.find((entry) => entry.id === 'g0pPmvRA3o4') ?? feed.entries[1]
  assert.match(maestro.title, /El Maestro/)
  assert.equal(maestro.channelId, 'UCJW9gatYczI191TunQxMGbA')
  assert.match(maestro.publishedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/)
  assert.ok(typeof maestro.views === 'number' && maestro.views >= 0)
  for (const entry of feed.entries) {
    assert.match(entry.id, /^[A-Za-z0-9_-]{11}$/)
    assert.equal(entry.isShort, false, 'the uploads feed has no Shorts')
    assert.ok(!entry.title.includes('&quot;') && !entry.title.includes('&amp;'), 'entities decoded')
  }
  // Descriptions keep their line breaks and links (the playlists are read from them).
  assert.ok(feed.entries.some((entry) => entry.description.includes('list=PL')))
})

test('parseFeed: isShort marks the Shorts a channel feed lists (Nessma)', () => {
  const feed = parseFeed(fixture('nessma-channel.xml'))
  assert.ok(feed)
  assert.equal(feed.channelId, 'UC-48PCT3flS86JkLzxlTA9g')
  const shorts = feed.entries.filter((entry) => entry.isShort)
  assert.ok(shorts.length >= 3, 'Shorts found')
  assert.ok(feed.entries.some((entry) => !entry.isShort), 'and regular videos')
  assert.ok(shorts.every((entry) => /^[A-Za-z0-9_-]{11}$/.test(entry.id)))
})

test('parseFeed: a playlist feed names its playlist and its channel', () => {
  const feed = parseFeed(fixture('watania-2-playlist.xml'))
  assert.ok(feed)
  assert.equal(feed.playlistId, 'PL6TjelGzBJrVwQi1xHw0y1TE3lX2Wz-zT')
  assert.equal(feed.title, 'لمة ونجوم')
  assert.equal(feed.channelId, 'UCJW9gatYczI191TunQxMGbA')
  assert.equal(feed.entries.length, 6)
})

test('parseFeed: YouTube\'s HTML error pages and junk are not feeds', () => {
  assert.equal(parseFeed(fixture('error-404.html')), null)
  assert.equal(parseFeed(''), null)
  assert.equal(parseFeed(null), null)
  const broken = parseFeed('<feed><entry><yt:videoId>../../etc</yt:videoId><published>2026-01-01T00:00:00+00:00</published></entry></feed>')
  assert.deepEqual(broken.entries, [])
})

test('decodeXml: named and numeric entities', () => {
  assert.equal(decodeXml('&quot;ديما&quot; &amp; &#39;x&#39; &#x41;&lt;&gt;'), '"ديما" & \'x\' A<>')
})

// ---------------------------------------------------------------------------------------------
// Titles

test('parseEpisodeTitle: the channels\' habits', () => {
  const maestro = parseEpisodeTitle('مسلسل المايسترو | El Maestro - الحلقة 7')
  assert.equal(maestro.series, 'المايسترو')
  assert.equal(maestro.seriesAlt, 'El Maestro')
  assert.equal(maestro.episode, 7)
  assert.equal(maestro.part, null)
  assert.equal(maestro.clip, false)

  const warthet = parseEpisodeTitle('Warthet El Nar EP13 llبعد الشدة يجي الفرج ؟')
  assert.equal(warthet.series, 'Warthet El Nar')
  assert.equal(warthet.episode, 13)
  assert.equal(warthet.subtitle, 'بعد الشدة يجي الفرج ؟')
  assert.equal(parseEpisodeTitle('Warthet El Nar EP13 ll…').episode, 13)
  assert.equal(parseEpisodeTitle('Warthet El Nar EP 12 ll قسوة بلاش حدود').subtitle, 'قسوة بلاش حدود')
  assert.equal(parseEpisodeTitle('Warthet El Nar Ep 10 ll الطمع يعمي القلوب').episode, 10)

  const both = parseEpisodeTitle('Warthet El Nar EP01 ll ورثة النار الحلقة 01 ll خدعة العمر')
  assert.equal(both.series, 'Warthet El Nar')
  assert.equal(both.seriesAlt, 'ورثة النار')
  assert.equal(both.episode, 1)
  assert.equal(both.subtitle, 'خدعة العمر')

  assert.deepEqual(
    (({ series, episode, part, season }) => ({ series, episode, part, season }))(parseEpisodeTitle('Carte Postale EP13 P02')),
    { series: 'Carte Postale', episode: 13, part: 2, season: null },
  )

  const sans = parseEpisodeTitle('Sans Filtres S02 Episode 30 24-07-2026 Partie 03')
  assert.equal(sans.series, 'Sans Filtres')
  assert.equal(sans.season, 2)
  assert.equal(sans.episode, 30)
  assert.equal(sans.part, 3)
  assert.equal(sans.date, '2026-07-24')

  const typo = parseEpisodeTitle('Toujours La Epiosde 36 23-07-2026 Partie 01')
  assert.equal(typo.series, 'Toujours La')
  assert.equal(typo.episode, 36)
  assert.equal(typo.part, 1)
  assert.equal(typo.date, '2026-07-23')

  const khtifa = parseEpisodeTitle('خطيفة الحلقة 22')
  assert.equal(khtifa.series, 'خطيفة')
  assert.equal(khtifa.episode, 22)

  const immo = parseEpisodeTitle('Immo Mag S04  Ep 29  ll Chatt Mariem')
  assert.equal(immo.series, 'Immo Mag')
  assert.equal(immo.season, 4)
  assert.equal(immo.episode, 29)
  assert.equal(immo.subtitle, 'Chatt Mariem')

  const first = parseEpisodeTitle('الحلقة #7 | تفهم كرة؟ |الفنان أنيس اللطيف')
  assert.equal(first.episode, 7)
  assert.equal(first.series, 'تفهم كرة؟')
  assert.equal(first.subtitle, 'الفنان أنيس اللطيف')
})

test('parseEpisodeTitle: dated shows without an episode number', () => {
  const agro = parseEpisodeTitle('AGRO MAG : 8 OCTOBRE 2026| الأسعار.. تكاليف الإنتاج والصيد البحري العشوائي')
  assert.equal(agro.series, 'AGRO MAG')
  assert.equal(agro.date, '2026-10-08')
  assert.equal(agro.episode, null)
  assert.match(agro.subtitle, /الأسعار/)

  const sabah = parseEpisodeTitle('صباح الناس : 9 أكتوبر 2026')
  assert.equal(sabah.series, 'صباح الناس')
  assert.equal(sabah.date, '2026-10-09')

  const lamma = parseEpisodeTitle('برنامج لمة ونجوم : عفيفة العويني  ليوم 11- 10- 2025')
  assert.equal(lamma.series, 'لمة ونجوم')
  assert.equal(lamma.date, '2025-10-11')
  assert.equal(lamma.subtitle, 'عفيفة العويني')
  assert.equal(parseEpisodeTitle('31-02-2026').date, null, 'not a real day')
})

test('parseEpisodeTitle: summaries and promos are clips, filed under their series', () => {
  const recap = parseEpisodeTitle('الصالون يتزين  عرس بيكا 👰 سيتكوم الحجامة -ملخص الحلقة 9')
  assert.equal(recap.clip, true)
  assert.equal(recap.series, 'الحجامة')
  assert.equal(recap.episode, 9)
  assert.equal(parseEpisodeTitle('Warthet El Nar - Promo').clip, true)
  assert.equal(parseEpisodeTitle('Carte Postale EP13 P02').clip, false)
})

test('seriesKey: one key however a channel spells the name', () => {
  assert.equal(seriesKey('Carte Postale'), 'carte-postale')
  assert.equal(seriesKey('CARTE  POSTALE!'), 'carte-postale')
  assert.equal(seriesKey('Sans Filtrés'), seriesKey('sans filtres'))
  assert.equal(seriesKey('مسلسل المايسترو'), seriesKey('المايسترو'))
  assert.equal(seriesKey('الحجامة'), seriesKey('الحجّامة'), 'tashkeel')
  assert.equal(seriesKey('أولاد مفيدة'), seriesKey('اولاد مفيده'), 'alef and ta marbuta')
  assert.equal(seriesKey('Warthet El Nar 🔥'), 'warthet-el-nar')
  assert.equal(seriesKey(''), '')
  assert.ok(seriesKey('x'.repeat(200)).length <= 60)
})

test('classifySeries: drama, show or clips', () => {
  assert.equal(classifySeries({ titles: ['مسلسل المايسترو | El Maestro - الحلقة 7', 'مسلسل المايسترو | El Maestro - الحلقة 8'] }), 'drama')
  assert.equal(classifySeries({ titles: ['Warthet El Nar EP13 ll x', 'Warthet El Nar EP14 ll y', 'Warthet El Nar EP15 ll z'] }), 'drama')
  assert.equal(classifySeries({ titles: ['Sans Filtres S02 Episode 30 24-07-2026 Partie 03', 'Sans Filtres S02 Episode 29 17-07-2026 Partie 01'] }), 'show')
  assert.equal(classifySeries({ titles: ['Immo Mag S04 Ep 30 ll La marsa', 'Immo Mag S04 Ep 29 ll Chatt Mariem'] }), 'show')
  assert.equal(classifySeries({ titles: ['Carte Postale EP13 P02', 'Carte Postale EP13 P01'] }), 'show', 'split into parts: a broadcast, not fiction')
  assert.equal(classifySeries({ titles: ['ملخص الحلقة 9', 'ملخص الحلقة 8', 'Promo'] }), 'clips')
  assert.equal(classifySeries({ titles: ['A EP1', 'A EP2', 'A EP3'], durations: [60, 90, 120] }), 'clips', 'short pieces')
  assert.equal(classifySeries({ titles: ['Mag EP1', 'Mag EP2'], channelKind: 'radio' }), 'show')
  assert.equal(classifySeries({ titles: ['Episode 1', 'Episode 2'], playlistTitle: 'مسلسل خطيفة' }), 'drama')
})

test('playlistIdsIn: the playlists a description links, once each', () => {
  const feed = parseFeed(fixture('watania-2-uulf.xml'))
  const ids = playlistIdsIn(feed.entries[0].description)
  assert.ok(ids.includes('PL6TjelGzBJrUbbF7HkdwEWohyDb20jg2g'))
  assert.ok(ids.includes('PLekykBim9-f4'), 'short playlist ids too')
  assert.equal(new Set(ids).size, ids.length)
  assert.deepEqual(playlistIdsIn('https://www.youtube.com/watch?v=Nl5AwgFqCrI&amp;list=PL6TjelGzBJrUbbF7HkdwEWohyDb20jg2g'), ['PL6TjelGzBJrUbbF7HkdwEWohyDb20jg2g'])
  assert.deepEqual(playlistIdsIn('list=UULFJW9gatYczI191TunQxMGbA list=RDxyz https://x.test/?list=PL<script>'), [])
  assert.deepEqual(playlistIdsIn(''), [])
})

test('cleanDescription: the story, without links, boilerplate or the title again', () => {
  const feed = parseFeed(fixture('watania-2-uulf.xml'))
  const entry = feed.entries[0]
  const clean = cleanDescription(entry.description, { title: entry.title })
  assert.ok(clean.length > 40 && clean.length <= 300, String(clean.length))
  assert.doesNotMatch(clean, /https?:|youtube\.com|Subscribe|bit\.ly|Facebook/i)
  assert.ok(!clean.startsWith(entry.title.trim()), 'the title is not repeated')
  assert.match(clean, /الحجامة/)
  assert.equal(cleanDescription('Follow us on Facebook https://fb.test'), '')
  const long = cleanDescription('word '.repeat(200))
  assert.ok(long.length <= 300 && long.endsWith('…'))
  assert.equal(cleanDescription('Line one\n#tag #other\nhttps://x.test\nLine two'), 'Line one Line two')
})

test('airingCadence: daily, weekdays, some days, weekly, or none', () => {
  // 2026-10-05 is a Monday.
  const at = (day, time = '17:40') => `${day}T${time}:00Z`
  assert.deepEqual(airingCadence(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07'].map((d) => at(d))), { kind: 'daily' })
  assert.deepEqual(airingCadence(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-12'].map((d) => at(d))), { kind: 'weekdays' })
  assert.deepEqual(airingCadence(['2026-09-10', '2026-09-17', '2026-09-24', '2026-10-01'].map((d) => at(d, '18:30'))), { kind: 'weekly', day: 4 })
  assert.equal(airingCadence(['2026-10-01', '2026-10-02', '2026-10-03'].map((d) => at(d))), null, 'fewer than 4 dates')
  assert.equal(airingCadence(['2026-01-01', '2026-03-09', '2026-06-20', '2026-10-01'].map((d) => at(d))), null, 'no rhythm')
  // Tunis days, not UTC: 23:30 UTC on Sunday is already Monday in Tunis.
  assert.deepEqual(airingCadence(['2026-09-13', '2026-09-20', '2026-09-27', '2026-10-04'].map((d) => at(d, '23:30'))), { kind: 'weekly', day: 1 })
})

test('groupParts: one broadcast\'s parts together, in order', () => {
  const items = ['Carte Postale EP13 P02', 'Carte Postale EP13 P01', 'Carte Postale EP12 P02', 'Carte Postale EP12 P01', 'FESTIVIBES EP06 P03', 'Warthet El Nar EP 12 ll x']
    .map((title) => ({ title, ...parseEpisodeTitle(title) }))
  const groups = groupParts(items)
  assert.equal(groups.length, 4)
  assert.deepEqual(groups[0].map((item) => item.part), [1, 2])
  assert.equal(groups[0][0].episode, 13)
  assert.deepEqual(groups[1].map((item) => item.part), [1, 2])
  assert.equal(groups[3].length, 1)
  const dated = groupParts(['Sans Filtres S02 Episode 30 24-07-2026 Partie 03', 'Sans Filtres S02 Episode 30 24-07-2026 Partie 01', 'Sans Filtres S02 Episode 30 24-07-2026 Partie 02'].map(parseEpisodeTitle))
  assert.equal(dated.length, 1)
  assert.deepEqual(dated[0].map((item) => item.part), [1, 2, 3])
})

test('looksLiveNow and isRamadanStart', () => {
  const now = new Date('2026-10-09T05:13:00Z')
  assert.equal(looksLiveNow({ title: 'Diffusion en direct de Watania2 Replay', publishedAt: '2026-10-08T22:54:00Z', updatedAt: '2026-10-09T04:33:00Z' }, now), true)
  assert.equal(looksLiveNow({ title: 'Diffusion en direct de Watania2 Replay', publishedAt: '2026-10-08T10:54:00Z', updatedAt: '2026-10-09T02:33:00Z' }, now), false, 'started too long ago')
  assert.equal(looksLiveNow({ title: 'الثانية مباشر: د كليك', publishedAt: '2026-06-29T13:36:00Z', updatedAt: '2026-10-09T05:04:00Z' }, now), false, 'an old replay')
  assert.equal(looksLiveNow({ title: 'Carte Postale EP13 P02', publishedAt: '2026-10-09T04:00:00Z', updatedAt: '2026-10-09T05:00:00Z' }, now), false)
  // Ramadan 1448 starts around 2027-02-08.
  assert.equal(isRamadanStart('2027-02-06T19:00:00Z', '2027-02-08'), true)
  assert.equal(isRamadanStart('2027-02-18T19:00:00Z', '2027-02-08'), true)
  assert.equal(isRamadanStart('2027-02-19T19:00:00Z', '2027-02-08'), false)
  assert.equal(isRamadanStart('2027-02-04T19:00:00Z', '2027-02-08'), false)
})

test('durations', () => {
  assert.equal(formatDuration(3723), '1:02:03')
  assert.equal(formatDuration(2530), '42:10')
  assert.equal(formatDuration(0), null)
  assert.equal(formatDuration(null), null)
  assert.equal(parseIsoDuration('PT1H2M3S'), 3723)
  assert.equal(parseIsoDuration('PT42M10S'), 2530)
  assert.equal(parseIsoDuration('P0D'), null)
  assert.equal(parseIsoDuration('junk'), null)
})

// ---------------------------------------------------------------------------------------------
// Channels

test('channels: the table, reserved slugs and the switches', () => {
  assert.equal(TV_CHANNELS.length, 10)
  for (const channel of TV_CHANNELS) {
    assert.match(channel.youtubeId, /^UC[A-Za-z0-9_-]{22}$/, channel.slug)
    assert.match(channel.slug, /^[a-z0-9-]+$/)
    assert.ok(!RESERVED_SLUGS.includes(channel.slug))
    assert.match(channel.color, /^\d{1,3} \d{1,3} \d{1,3}$/)
  }
  assert.equal(new Set(TV_CHANNELS.map((channel) => channel.slug)).size, 10)
  assert.equal(uploadsPlaylist('UCJW9gatYczI191TunQxMGbA'), 'UULFJW9gatYczI191TunQxMGbA')
  assert.equal(livesPlaylist('UCJW9gatYczI191TunQxMGbA'), 'UULVJW9gatYczI191TunQxMGbA')

  assert.equal(enabledChannels({}).length, 10)
  assert.deepEqual(enabledChannels({ TUNISIAN_TV_CHANNELS: 'nessma, elhiwar' }).map((c) => c.slug), ['elhiwar', 'nessma'])
  assert.equal(enabledChannels({ TUNISIAN_TV_CHANNELS_OFF: 'nessma' }).some((c) => c.slug === 'nessma'), false)
  assert.equal(enabledChannels({ TUNISIAN_TV_CHANNELS_OFF: '*' }).length, 0)
  assert.equal(tunisianTvOff({ TUNISIAN_TV_CHANNELS_OFF: 'all' }), true)
  assert.equal(channelBySlug('watania-1', {})?.name, 'Watania 1')
  for (const bad of ['series', 'live', 'WATANIA-1', '../x', '', null, 'nope']) assert.equal(channelBySlug(bad, {}), null, String(bad))
  assert.equal(channelBySlug('nessma', { TUNISIAN_TV_CHANNELS_OFF: 'nessma' }), null)
})

// ---------------------------------------------------------------------------------------------
// Strings

test('strings: Arabic, Derja and French follow English\'s keys and placeholders', () => {
  const en = tunisianTv.en
  const keys = Object.keys(en)
  assert.ok(keys.length > 20)
  const vars = (text) => [...String(text).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
  for (const language of ['ar', 'tn', 'fr']) {
    const strings = tunisianTv[language] ?? {}
    for (const [key, value] of Object.entries(strings)) {
      assert.ok(key in en, `${language}: unknown key ${key}`)
      assert.equal(vars(value), vars(en[key]), `${language}: ${key}`)
    }
  }
  for (const key of keys) assert.ok(tunisianTv.ar[key], `ar: ${key}`)
})

// ---------------------------------------------------------------------------------------------
// Series from uploads, and what the tiles may load

test('deriveChannel: series from titles and playlists, clips aside, one-offs alone', async () => {
  const { deriveChannel } = await import('@/src/lib/tunisian-tv/derive')
  const feed = parseFeed(fixture('watania-2-uulf.xml'))
  const videos = feed.entries.map((entry) => {
    const info = parseEpisodeTitle(entry.title)
    return {
      _id: entry.id, title: entry.title, publishedAt: new Date(entry.publishedAt), seriesId: null, playlistIds: [], episode: info.episode, part: info.part,
      season: info.season, date: info.date, clip: info.clip, status: 'ok', duration: null, seriesName: info.series, seriesNameAlt: info.seriesAlt,
      description: cleanDescription(entry.description, { title: entry.title }) || null,
    }
  })
  const { series, assign } = deriveChannel({ channel: 'watania-2', kind: 'tv', videos, existing: [], now: new Date('2026-10-09T06:00:00Z') })
  const maestro = series.find((item) => item.titleAlt === 'El Maestro' || item.title === 'El Maestro')
  assert.ok(maestro, 'El Maestro is a series')
  assert.equal(maestro.kind, 'drama')
  assert.equal(maestro.hidden, false)
  assert.ok(maestro.episodeCount >= 3)
  assert.equal(maestro.complete, false, 'never complete from feeds')
  assert.match(maestro._id, /^watania-2:/)
  const clips = series.filter((item) => item.kind === 'clips')
  assert.ok(clips.every((item) => item.hidden), 'clips are hidden')
  // A one-off upload belongs to no series.
  const oneOff = feed.entries.find((entry) => entry.title.startsWith('دار كاملة'))
  if (oneOff) assert.equal(assign.get(oneOff.id), null)

  // A playlist's series keeps its videos and its name.
  const fromPlaylist = videos.map((video) => ({ ...video, seriesId: 'watania-2:hajjema', playlistIds: ['PLekykBim9-f4'] }))
  const again = deriveChannel({
    channel: 'watania-2', kind: 'tv', videos: fromPlaylist,
    existing: [{ _id: 'watania-2:hajjema', source: 'playlist', playlistId: 'PLekykBim9-f4', title: 'الحجامة', titleAlt: 'Hajjema', complete: true, coverId: null, coverMaxres: false, coverCheckedId: null, color: null, colorOf: null }],
    now: new Date('2026-10-09T06:00:00Z'),
  })
  assert.equal(again.series.length, 1)
  assert.equal(again.series[0].title, 'الحجامة')
  assert.equal(again.series[0].source, 'playlist')
  assert.equal(again.series[0].complete, true)
})

test('tiles: blocked videos open YouTube, thumbnails come from our own route', () => {
  const root = path.resolve(FIXTURES, '..', '..', '..')
  const read = readFileSync(path.join(root, 'src/lib/tunisian-tv/read.ts'), 'utf8')
  assert.match(read, /blocked: lead\.status === 'blocked'/)
  const row = readFileSync(path.join(root, 'src/components/tunisian-tv/TvRow.tsx'), 'utf8')
  assert.match(row, /blocked=\{video\.blocked\}/)
  for (const file of ['src/components/tunisian-tv/TvRow.tsx', 'src/components/tunisian-tv/TvHero.tsx', 'src/components/tunisian-tv/ChannelAvatar.tsx', 'src/components/tunisian-tv/Channels.tsx', 'src/app/tunisian/tv/page.tsx', 'src/app/tunisian/tv/[channel]/page.tsx']) {
    const source = readFileSync(path.join(root, file), 'utf8')
    assert.doesNotMatch(source, /i\.ytimg\.com|ytimg|ggpht|googleusercontent/, `${file} loads a picture from Google`)
    assert.doesNotMatch(source, /referrerPolicy=["']no-referrer["']/, file)
  }
})
