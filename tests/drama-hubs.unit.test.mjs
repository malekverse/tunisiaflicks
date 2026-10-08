// Unit tests for the drama hubs and the world primitives (no server, no database, no TMDB):
//   npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  FILTER_SHELVES, HUBS, HUB_IDS, LOGO_MIN_LIGHTNESS, REASON_ORDER, airState, belongsToHub, chooseFeatured, chooseKeywordId,
  compareAir, hubLogoCandidates, hubPath, isFilterShelf, isHangulOnly, isHubId, logoLightness, movieBaseParams, pickHubLogo,
  pickHubTrailer, pluralKey, reasonFor, reasonTier, rotate, rotationSeed, rowMinimum, tvBaseParams,
} from '@/src/lib/dramas-config'
import { isYouTubeId, youtubeEmbedUrl, youtubeLiveEmbedUrl, youtubeThumb, youtubeWatchUrl } from '@/src/lib/youtube'
import { ARAB_COUNTRY_CODES, ARAB_TMDB_COUNTRIES, arabCountryHref, arabCountryName, arabCountryOf, isArabCountry } from '@/src/lib/arab-countries'
import { dramaHubs } from '@/src/lib/i18n/features/drama-hubs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TODAY = '2026-10-08'

// ---------------------------------------------------------------------------------------------
// YouTube

test('youtube: ids, first-party thumbnails, privacy-enhanced embeds', () => {
  assert.ok(isYouTubeId('dQw4w9WgXcQ'))
  assert.ok(isYouTubeId('a-b_c-d_e-f'))
  for (const bad of ['', 'dQw4w9WgXc', 'dQw4w9WgXcQQ', 'dQw4w9WgX/Q', '../../etc/pa', null, 42, undefined]) assert.equal(isYouTubeId(bad), false, String(bad))
  assert.equal(youtubeThumb('dQw4w9WgXcQ', 'mq'), '/api/yt-thumb/dQw4w9WgXcQ/mq')
  assert.equal(youtubeThumb('dQw4w9WgXcQ', 'maxres'), '/api/yt-thumb/dQw4w9WgXcQ/maxres')

  const embed = new URL(youtubeEmbedUrl('dQw4w9WgXcQ', { autoplay: true, start: 12.7, hl: 'ar' }))
  assert.equal(embed.origin, 'https://www.youtube-nocookie.com')
  assert.equal(embed.pathname, '/embed/dQw4w9WgXcQ')
  assert.equal(embed.searchParams.get('rel'), '0')
  assert.equal(embed.searchParams.get('playsinline'), '1')
  assert.equal(embed.searchParams.get('autoplay'), '1')
  assert.equal(embed.searchParams.get('start'), '12')
  assert.equal(embed.searchParams.get('hl'), 'ar')
  assert.equal(new URL(youtubeEmbedUrl('dQw4w9WgXcQ')).searchParams.has('autoplay'), false)

  const live = new URL(youtubeLiveEmbedUrl('UCabcdefghijklmnopqrstuv'))
  assert.equal(live.origin, 'https://www.youtube-nocookie.com')
  assert.equal(live.pathname, '/embed/live_stream')
  assert.equal(live.searchParams.get('channel'), 'UCabcdefghijklmnopqrstuv')
  assert.equal(youtubeWatchUrl('dQw4w9WgXcQ'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
})

test('youtube: no player is ever given referrerPolicy no-referrer (YouTube error 153)', () => {
  for (const file of ['src/components/media/YouTubeDialog.tsx', 'src/components/media/VideoTile.tsx', 'src/components/dramas/HubScreen.tsx']) {
    assert.doesNotMatch(readFileSync(path.join(ROOT, file), 'utf8'), /referrerPolicy=["']no-referrer["']/, file)
  }
})

test('hub screen: the trailer never starts on touch screens, and pauses off-screen', () => {
  const screen = readFileSync(path.join(ROOT, 'src/components/dramas/HubScreen.tsx'), 'utf8')
  // useCanAutoplay() with its default: a hovering, fine pointer (a mouse), no reduced motion, no Data Saver.
  assert.match(screen, /useCanAutoplay\(\)/)
  assert.doesNotMatch(screen, /useCanAutoplay\(\s*false\s*\)/)
  assert.match(screen, /intersectionRatio >= 0\.35/)
  assert.match(screen, /play=\{running\}/)
  const autoplay = readFileSync(path.join(ROOT, 'src/hooks/use-autoplay.ts'), 'utf8')
  assert.match(autoplay, /\(hover: hover\) and \(pointer: fine\)/)
})

// ---------------------------------------------------------------------------------------------
// Arab countries

test('arab countries: the 22 Arab League members, their pages and names', () => {
  assert.equal(ARAB_COUNTRY_CODES.length, 22)
  assert.equal(new Set(ARAB_COUNTRY_CODES).size, 22)
  assert.deepEqual(ARAB_TMDB_COUNTRIES, ARAB_COUNTRY_CODES.map((code) => code.toUpperCase()))
  assert.ok(isArabCountry('tn') && isArabCountry('eg') && isArabCountry('ps'))
  assert.equal(isArabCountry('TN'), false, 'TMDB codes are lowercased first')
  assert.equal(isArabCountry('fr'), false)
  assert.equal(arabCountryOf(['FR', 'TN']), 'tn')
  assert.equal(arabCountryOf(['US']), null)
  assert.equal(arabCountryOf(null), null)
  assert.equal(arabCountryHref('tn'), '/tunisian/cinema')
  assert.equal(arabCountryHref('eg'), '/arab-cinema/eg')
  assert.equal(arabCountryName('ps', 'en'), 'Palestine')
  assert.equal(arabCountryName('ps', 'fr'), 'Palestine')
  assert.equal(arabCountryName('ps', 'ar'), 'فلسطين')
  assert.equal(arabCountryName('ps', 'tn'), 'فلسطين')
  assert.equal(arabCountryName('eg', 'en'), 'Egypt')
  assert.match(arabCountryName('eg', 'tn'), /مصر/, "Derja is Arabic to Intl, not Tswana")
  assert.match(arabCountryName('ma', 'fr'), /Maroc/)
})

// ---------------------------------------------------------------------------------------------
// Hub configuration

test('hubs: the configuration the brief sets', () => {
  assert.deepEqual([...HUB_IDS], ['turkish', 'korean'])
  assert.deepEqual(
    { language: HUBS.turkish.language, country: HUBS.turkish.country, accent: HUBS.turkish.accent, watermark: HUBS.turkish.watermark, short: HUBS.turkish.shortMaxEpisodes, votes: HUBS.turkish.votes, min: HUBS.turkish.favouritesMinRating },
    { language: 'tr', country: 'TR', accent: '40 196 184', watermark: 'kafes', short: 13, votes: { tv: 10, favourites: 40, movie: 30 }, min: 7.5 },
  )
  assert.deepEqual(
    { language: HUBS.korean.language, country: HUBS.korean.country, accent: HUBS.korean.accent, watermark: HUBS.korean.watermark, short: HUBS.korean.shortMaxEpisodes, votes: HUBS.korean.votes, min: HUBS.korean.favouritesMinRating },
    { language: 'ko', country: 'KR', accent: '104 124 255', watermark: 'changsal', short: 12, votes: { tv: 30, favourites: 200, movie: 150 }, min: 7.8 },
  )
  assert.ok(HUBS.turkish.keywords.historical.includes('ottoman empire'))
  assert.ok(HUBS.korean.keywords.historical.includes('joseon dynasty'))
  assert.ok(HUBS.korean.keywords.romance.includes('contract marriage'))
  // Neither accent is the Tunisian red or the Ramadan gold.
  for (const hub of HUB_IDS) assert.ok(!['231 0 19', '245 190 80'].includes(HUBS[hub].accent))

  assert.ok(isHubId('turkish') && isHubId('korean'))
  assert.equal(isHubId('japanese'), false)
  assert.deepEqual([...FILTER_SHELVES], ['romance', 'historical', 'thrillers', 'short', 'films'])
  assert.ok(isFilterShelf('romance'))
  assert.equal(isFilterShelf('for-you'), false)
  assert.equal(isFilterShelf(['romance']), false)
  assert.equal(hubPath('korean'), '/dramas/korean')
  assert.equal(hubPath('turkish', 'short'), '/dramas/turkish?shelf=short')
  assert.deepEqual([rowMinimum('new-episodes'), rowMinimum('trending'), rowMinimum('romance'), rowMinimum('for-you')], [3, 5, 6, 6])
})

test('hubs: TMDB base queries', () => {
  assert.deepEqual(tvBaseParams('korean', 'ar'), {
    with_original_language: 'ko', with_origin_country: 'KR', with_type: '2|4',
    without_genres: '16,99,10762,10763,10764,10767', include_adult: false, language: 'ar',
  })
  assert.deepEqual(movieBaseParams('turkish', 'en-US'), {
    with_original_language: 'tr', with_origin_country: 'TR', without_genres: '16,99', include_adult: false, language: 'en-US',
  })
  assert.ok(belongsToHub({ original_language: 'tr', origin_country: ['TR'], genre_ids: [18] }, 'turkish'))
  assert.equal(belongsToHub({ original_language: 'tr', origin_country: ['TR'], genre_ids: [10764] }, 'turkish'), false, 'reality shows')
  assert.equal(belongsToHub({ original_language: 'ko', origin_country: ['KR'], genre_ids: [18] }, 'turkish'), false)
  assert.equal(belongsToHub({ original_language: 'ko', origin_country: ['US'], genre_ids: [18] }, 'korean'), false)
})

test('hubs: keyword ids from TMDB search results', () => {
  const results = [{ id: 1, name: 'joseon dynasty (1392–1910)' }, { id: 2, name: 'Romance' }, { id: 3, name: 'bromance' }]
  assert.equal(chooseKeywordId('romance', results), 2)
  assert.equal(chooseKeywordId('joseon dynasty', results), 1)
  assert.equal(chooseKeywordId('romantic comedy', results), null)
  assert.equal(chooseKeywordId('mance', results), null)
})

test('hubs: the daily rotation is stable for a day and changes the next', () => {
  const items = Array.from({ length: 40 }, (_, index) => index)
  const seed = rotationSeed(TODAY, 'turkish', 'romance')
  assert.equal(seed, '2026-10-08:turkish:romance')
  assert.deepEqual(rotate(items, seed), rotate(items, seed))
  assert.notDeepEqual(rotate(items, seed), rotate(items, rotationSeed('2026-10-09', 'turkish', 'romance')))
  assert.notDeepEqual(rotate(items, seed), rotate(items, rotationSeed(TODAY, 'korean', 'romance')))
  assert.deepEqual([...rotate(items, seed)].sort((a, b) => a - b), items, 'a reordering, nothing lost')
})

test('hubs: Hangul-only titles, logos and trailers', () => {
  assert.ok(isHangulOnly('나 혼자 산다'))
  assert.ok(isHangulOnly('무한도전 2'))
  assert.equal(isHangulOnly('Running Man'), false)
  assert.equal(isHangulOnly('الرجل الجاري'), false)
  assert.equal(isHangulOnly('Love 101 사랑'), false)
  assert.equal(isHangulOnly(''), false)

  const logos = [
    { iso_639_1: 'ko', file_path: '/ko.png', aspect_ratio: 2 },
    { iso_639_1: 'tr', file_path: '/tr.png', aspect_ratio: 2 },
    { iso_639_1: null, file_path: '/textless.png', aspect_ratio: 2.5 },
    { iso_639_1: 'en', file_path: '/en.png', aspect_ratio: 3 },
  ]
  assert.deepEqual(pickHubLogo(logos, 'korean'), { path: '/en.png', ratio: 3 })
  assert.deepEqual(pickHubLogo(logos.slice(0, 3), 'turkish'), { path: '/textless.png', ratio: 2.5 })
  assert.deepEqual(pickHubLogo(logos.slice(0, 2), 'turkish'), { path: '/tr.png', ratio: 2 })
  assert.equal(pickHubLogo(logos.slice(0, 1), 'korean'), null, 'never Korean script')
  assert.equal(pickHubLogo([], 'turkish'), null)
  // Every candidate, best first, so a logo too dark for the stage can give way to the next one.
  assert.deepEqual(hubLogoCandidates(logos, 'turkish').map((logo) => logo.path), ['/en.png', '/textless.png', '/tr.png'])
  assert.deepEqual(hubLogoCandidates(logos, 'korean').map((logo) => logo.path), ['/en.png', '/textless.png'])
  assert.deepEqual(hubLogoCandidates([{ iso_639_1: 'en' }, null], 'korean'), [], 'no file, no logo')

  const videos = [
    { site: 'YouTube', key: 'teaser-en', type: 'Teaser', iso_639_1: 'en' },
    { site: 'YouTube', key: 'trailer-ko', type: 'Trailer', official: true, iso_639_1: 'ko' },
    { site: 'YouTube', key: 'featurette', type: 'Featurette', official: true, iso_639_1: 'en' },
    { site: 'Vimeo', key: 'vimeo', type: 'Trailer', official: true, iso_639_1: 'en' },
    { site: 'YouTube', key: 'trailer-en', type: 'Trailer', official: true, iso_639_1: 'en' },
  ]
  assert.equal(pickHubTrailer(videos, 'korean'), 'trailer-en')
  assert.equal(pickHubTrailer(videos.slice(0, 2), 'korean'), 'trailer-ko', 'a trailer before a teaser')
  assert.equal(pickHubTrailer(videos.slice(2, 4), 'korean'), null)
})

test('hubs: a logo too dark for the stage is measured as such', () => {
  // RGBA pixels: [r, g, b, a] repeated.
  const pixels = (rgba, count = 16) => Uint8Array.from(Array.from({ length: count }, () => rgba).flat())
  const white = logoLightness(pixels([255, 255, 255, 255]))
  const black = logoLightness(pixels([0, 0, 0, 255]))
  const red = logoLightness(pixels([255, 0, 0, 255]))
  const darkRed = logoLightness(pixels([150, 0, 0, 255]))
  assert.ok(Math.abs(white - 1) < 1e-9)
  assert.equal(black, 0)
  assert.ok(white >= LOGO_MIN_LIGHTNESS && red >= LOGO_MIN_LIGHTNESS, 'white and bright colours read on the dark stage')
  assert.ok(black < LOGO_MIN_LIGHTNESS && darkRed < LOGO_MIN_LIGHTNESS, 'black and dark logos do not')
  // Transparent pixels don't count, whatever their colour: a white logo on a transparent black canvas is white.
  const logo = Uint8Array.from([...pixels([255, 255, 255, 255], 4), ...pixels([0, 0, 0, 0], 60)])
  assert.ok(logoLightness(logo) > 0.99)
  assert.equal(logoLightness(pixels([255, 255, 255, 0])), null, 'nothing visible')
})

test('hubs: where a series is in its week', () => {
  const detail = (last, next) => ({ last_episode_to_air: last ? { air_date: last } : null, next_episode_to_air: next ? { air_date: next } : null })
  assert.deepEqual(airState(detail('2026-10-08', '2026-10-15'), TODAY), { kind: 'today', date: TODAY })
  assert.deepEqual(airState(detail('2026-10-01', '2026-10-08'), TODAY), { kind: 'today', date: TODAY })
  assert.deepEqual(airState(detail('2026-10-06', '2026-10-13'), TODAY), { kind: 'new', date: '2026-10-06' })
  assert.deepEqual(airState(detail('2026-10-01', '2026-10-09'), TODAY), { kind: 'tomorrow', date: '2026-10-09' })
  assert.deepEqual(airState(detail('2026-10-01', '2026-10-12'), TODAY), { kind: 'next', date: '2026-10-12' })
  assert.equal(airState(detail('2026-10-05', '2026-10-13'), TODAY), null, 'outside today-2..today+4')
  assert.equal(airState({}, TODAY), null)

  const order = [
    { kind: 'next', date: '2026-10-12' }, { kind: 'new', date: '2026-10-06' }, { kind: 'today', date: TODAY },
    { kind: 'tomorrow', date: '2026-10-09' }, { kind: 'new', date: '2026-10-07' }, { kind: 'next', date: '2026-10-10' },
  ].sort(compareAir)
  assert.deepEqual(order.map((air) => `${air.kind}:${air.date.slice(8)}`), ['today:08', 'new:07', 'new:06', 'tomorrow:09', 'next:10', 'next:12'])
})

test('hubs: the featured series and its reason', () => {
  assert.deepEqual(REASON_ORDER, ['premiere', 'new', 'airing', 'justAired', 'trending', 'favourite', 'popular'])
  const premiere = { last_episode_to_air: { air_date: '2026-10-05', episode_number: 1, season_number: 3 }, next_episode_to_air: { air_date: '2026-10-12' }, first_air_date: '2022-01-01' }
  assert.deepEqual(reasonFor(premiere, { today: TODAY, trendingRank: 1 }), { type: 'premiere', season: 3 })
  assert.deepEqual(reasonFor({ first_air_date: '2026-10-01', last_episode_to_air: { air_date: '2026-10-01', episode_number: 1, season_number: 1 } }, { today: TODAY }), { type: 'new', date: '2026-10-01' })
  assert.deepEqual(reasonFor({ first_air_date: '2020-01-01', next_episode_to_air: { air_date: '2026-10-10' } }, { today: TODAY, trendingRank: 2 }), { type: 'airing', date: '2026-10-10' })
  assert.deepEqual(reasonFor({ first_air_date: '2020-01-01', last_episode_to_air: { air_date: '2026-10-04', episode_number: 9, season_number: 1 } }, { today: TODAY }), { type: 'justAired', episode: 9 })
  assert.deepEqual(reasonFor({ first_air_date: '2020-01-01' }, { today: TODAY, trendingRank: 4, favourite: true }), { type: 'trending', rank: 4 })
  assert.deepEqual(reasonFor({ first_air_date: '2020-01-01' }, { today: TODAY, trendingRank: null, favourite: true }), { type: 'favourite' })
  assert.deepEqual(reasonFor(null, { today: TODAY }), { type: 'popular' })
  assert.ok(reasonTier({ type: 'premiere', season: 2 }) < reasonTier({ type: 'airing', date: TODAY }))
  assert.ok(reasonTier({ type: 'justAired', episode: 1 }) < reasonTier({ type: 'trending', rank: 1 }))

  const candidates = [
    { id: 1, reason: { type: 'trending', rank: 1 } },
    { id: 2, reason: { type: 'airing', date: '2026-10-10' } },
    { id: 3, reason: { type: 'favourite' } },
    { id: 4, reason: { type: 'justAired', episode: 4 } },
  ]
  const seed = rotationSeed(TODAY, 'korean', 'featured')
  assert.ok([2, 4].includes(chooseFeatured(candidates, seed, new Set()).id), 'the best tier first')
  assert.equal(chooseFeatured(candidates, seed, new Set([2, 4])).id, 1, 'never one featured recently')
  assert.ok([2, 4].includes(chooseFeatured(candidates, seed, new Set([1, 2, 3, 4])).id), 'all recent: still something')
  assert.equal(chooseFeatured([], seed, new Set()), null)
  assert.equal(chooseFeatured(candidates, seed, new Set()).id, chooseFeatured(candidates, seed, new Set()).id, 'the same all day')
})

// ---------------------------------------------------------------------------------------------
// Strings

test('strings: plural keys follow each language', () => {
  assert.equal(pluralKey('dramas.episodes', 'en', 1), 'dramas.episodes.one')
  assert.equal(pluralKey('dramas.episodes', 'en', 8), 'dramas.episodes.other')
  assert.equal(pluralKey('dramas.episodes', 'ar', 0), 'dramas.episodes.zero')
  assert.equal(pluralKey('dramas.episodes', 'ar', 2), 'dramas.episodes.two')
  assert.equal(pluralKey('dramas.episodes', 'ar', 8), 'dramas.episodes.few')
  assert.equal(pluralKey('dramas.episodes', 'ar', 12), 'dramas.episodes.many')
  assert.equal(pluralKey('dramas.episodes', 'tn', 3), 'dramas.episodes.few', 'Derja counts like Arabic')
  for (const base of ['dramas.episodes', 'dramas.index.newCount']) {
    for (const category of ['zero', 'one', 'two', 'few', 'many', 'other']) assert.ok(`${base}.${category}` in dramaHubs.en, `${base}.${category}`)
  }
})

test('strings: complete in Arabic, and Derja and French only translate known keys', () => {
  const english = Object.keys(dramaHubs.en)
  assert.deepEqual(Object.keys(dramaHubs.ar).sort(), [...english].sort())
  for (const language of ['tn', 'fr']) {
    for (const key of Object.keys(dramaHubs[language] ?? {})) assert.ok(english.includes(key), `${language}: ${key}`)
  }
  for (const [language, strings] of Object.entries(dramaHubs)) {
    for (const [key, value] of Object.entries(strings)) {
      assert.ok(value.trim().length > 0, `${language}: ${key} is empty`)
      const placeholders = (text) => (text.match(/\{\w+\}/g) ?? []).sort().join()
      if (language !== 'en' && !/\.(zero|one|two)$/.test(key)) assert.equal(placeholders(value), placeholders(dramaHubs.en[key]), `${language}: ${key} placeholders`)
    }
  }
})

test('strings: the nav label fits, and the copy follows the design rules', () => {
  assert.ok(dramaHubs.en['dramas.nav'].length <= 20, dramaHubs.en['dramas.nav'])
  for (const [language, strings] of Object.entries(dramaHubs)) {
    for (const [key, value] of Object.entries(strings)) {
      assert.doesNotMatch(value, /[·→]/, `${language}: ${key}`)
      // The hubs never talk about dubbing or subtitles.
      assert.doesNotMatch(value, /\bdub|subtit|sous-titr|doubl[ée]|vostfr|مدبلج|دبلج|مترجم|ترجمة/i, `${language}: ${key}`)
    }
  }
})

test('copy: nothing in the hubs\' code talks about dubbing or subtitles either', () => {
  const files = []
  const walk = (dir) => {
    for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const relative = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(relative)
      else if (/\.(tsx?|mjs)$/.test(entry.name)) files.push(relative)
    }
  }
  for (const dir of ['src/app/dramas', 'src/components/dramas', 'src/components/hubs']) walk(dir)
  files.push('src/lib/dramas.ts', 'src/lib/dramas-config.ts', 'src/lib/dramas-for-you.ts')
  assert.ok(files.length >= 10, files.join())
  // ('subtitle' alone is a prop name: the line under a title.)
  const words = /\bdub(?:bed|bing|s)?\b|doublage|\bdoubl[ée]e?s?\b|vostfr|sous-titr|\bsubtitle[sd]\b|مدبلج|دبلج/i
  for (const file of files) assert.doesNotMatch(readFileSync(path.join(ROOT, file), 'utf8'), words, file)
})

// ---------------------------------------------------------------------------------------------
// Chip: rendered for real (sucrase strips the TSX, React renders it) and checked with axe.

const require = createRequire(path.join(ROOT, 'package.json'))
// sucrase (through tailwindcss), axe-core (through eslint-config-next) and jsdom come with the
// project's own dependencies; without them the rendered checks are skipped, not failed.
const missing = ['sucrase', 'axe-core', 'jsdom', 'react-dom/server'].filter((name) => {
  try { require.resolve(name); return false } catch { return true }
})
const RENDERED = missing.length ? { skip: `not installed: ${missing.join(', ')}` } : {}

async function loadChip() {
  const { transform } = require('sucrase')
  const source = readFileSync(path.join(ROOT, 'src/components/ui/chip.tsx'), 'utf8')
  const { code } = transform(source, { transforms: ['typescript', 'jsx'], jsxRuntime: 'automatic', production: true, filePath: 'chip.tsx' })
  // A data: module can't resolve bare packages: point them at their files. next/link renders an
  // <a> with the same props, and the X icon an <svg>: small stand-ins keep the test fast.
  const react = pathToFileURL(require.resolve('react')).href
  const stub = (body) => `data:text/javascript;base64,${Buffer.from(`import React from '${react}'
${body}`).toString('base64')}`
  const stubs = {
    'next/link': stub("export default function Link({ href, children, ...props }) { return React.createElement('a', { href, ...props }, children) }"),
    'lucide-react': stub("export const X = (props) => React.createElement('svg', { 'aria-hidden': true, ...props })"),
  }
  const linked = code.replace(/from ["']([^"'.@/][^"']*)["']/g, (_, name) => `from '${stubs[name] ?? pathToFileURL(require.resolve(name)).href}'`)
  return import(`data:text/javascript;base64,${Buffer.from(linked).toString('base64')}`)
}

async function render(build) {
  const React = require('react')
  const { renderToStaticMarkup } = require('react-dom/server')
  const chip = await loadChip()
  return renderToStaticMarkup(build(React.createElement, chip))
}

async function axeViolations(markup, rules) {
  const { JSDOM } = require('jsdom')
  const dom = new JSDOM(`<!doctype html><html lang="en"><head><title>Chips</title></head><body><main>${markup}</main></body></html>`, { runScripts: 'outside-only' })
  dom.window.eval(require('axe-core').source)
  const result = await dom.window.axe.run(dom.window.document, { runOnly: { type: 'rule', values: rules } })
  dom.window.close()
  // Array.from: a plain array of this realm (jsdom's arrays are another realm's).
  return Array.from(result.violations, (violation) => `${violation.id}: ${Array.from(violation.nodes, (node) => node.html).join(' | ')}`)
}

const A11Y_RULES = ['nested-interactive', 'button-name', 'link-name', 'aria-required-children', 'aria-required-parent', 'aria-allowed-attr', 'aria-valid-attr-value', 'aria-allowed-role', 'list', 'listitem']

test('chip: a removable chip has its X beside it, never nested (axe)', RENDERED, async () => {
  const markup = await render((h, { Chip, ChipGroup }) =>
    h(ChipGroup, { label: 'Your filters', mode: 'none' },
      h(Chip, { onRemove: () => {}, removeLabel: 'Remove Comedy' }, 'Comedy'),
      h(Chip, { onRemove: () => {}, removeLabel: 'Remove 2020s', active: true, count: 12 }, '2020s')))
  assert.deepEqual(await axeViolations(markup, A11Y_RULES), [])
  assert.doesNotMatch(markup, /<button[^>]*>(?:(?!<\/button>).)*<button/s, 'no button inside a button')
  assert.equal((markup.match(/<button/g) ?? []).length, 2)
  assert.match(markup, /aria-label="Remove Comedy"/)
  assert.match(markup, /role="list"/)
})

test('chip: each mode has its semantics (axe)', RENDERED, async () => {
  const markup = await render((h, { Chip, ChipGroup }) => h('div', null,
    h(ChipGroup, { label: 'Type' }, h(Chip, { active: true, onClick() {} }, 'All'), h(Chip, { active: false, onClick() {} }, 'Movies')),
    h(ChipGroup, { label: 'Genres', mode: 'multi' }, h(Chip, { active: true, onClick() {} }, 'Drama'), h(Chip, { onClick() {} }, 'Comedy')),
    h(ChipGroup, { label: 'Show', mode: 'nav', scroll: true }, h(Chip, { href: '/dramas/turkish', active: true }, 'All'), h(Chip, { href: '/dramas/turkish?shelf=romance' }, 'Love stories')),
    h(ChipGroup, { label: 'Sections', mode: 'tabs' }, h(Chip, { active: true, controls: 'panel-a', onClick() {} }, 'A'), h(Chip, { controls: 'panel-b', onClick() {} }, 'B')),
    h('div', { id: 'panel-a', role: 'tabpanel' }, 'A'), h('div', { id: 'panel-b', role: 'tabpanel', hidden: true }, 'B'),
  ))
  assert.deepEqual(await axeViolations(markup, A11Y_RULES), [])
  // single (the default, as the library's chips always were): a radio group with one tab stop.
  assert.match(markup, /role="radiogroup" aria-label="Type"/)
  assert.match(markup, /role="radio" aria-checked="true" tabindex="0"[^>]*>.*?All/s)
  assert.match(markup, /role="radio" aria-checked="false" tabindex="-1"/)
  // multi: toggles.
  assert.match(markup, /role="group" aria-label="Genres"/)
  assert.match(markup, /aria-pressed="true"[^>]*>.*?Drama/s)
  // nav: links in a <nav>, the current one marked.
  assert.match(markup, /<nav aria-label="Show"/)
  assert.match(markup, /<a href="\/dramas\/turkish"[^>]*aria-current="page"/)
  assert.doesNotMatch(markup, /href="\/dramas\/turkish\?shelf=romance" aria-current/)
  // tabs: manual activation, the panel named.
  assert.match(markup, /role="tablist" aria-label="Sections"/)
  assert.match(markup, /role="tab" aria-selected="true" aria-controls="panel-a" tabindex="0"/)
})

test('chip: the library still imports Chip and ChipGroup from its controls', () => {
  const controls = readFileSync(path.join(ROOT, 'src/components/library/controls.tsx'), 'utf8')
  assert.match(controls, /export \{ Chip, ChipGroup \} from '@\/src\/components\/ui\/chip'/)
})
