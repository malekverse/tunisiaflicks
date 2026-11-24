// Unit tests for lib/programme: the whole programme on /about (every feature, grouped).
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { PROGRAMME, foldText, isNewItem, programmeFor, programmeMatches } from '@/src/lib/programme'
import { featureStrings } from '@/src/lib/i18n/features'

const APP = path.resolve('src/app')

/** Is there a page (or a route handler) at this path? '/movie-night#x' → src/app/movie-night/page.tsx. */
function routeExists(href: string) {
  const pathname = href.split('#')[0].split('?')[0]
  const dir = path.join(APP, ...pathname.split('/').filter(Boolean))
  return ['page.tsx', 'route.ts'].some((file) => existsSync(path.join(dir, file)))
}

describe('The whole programme: the list', () => {
  const items = PROGRAMME.flatMap((group) => group.items)

  test('each thing once, each with a page or a place', () => {
    assert.equal(new Set(items.map((item) => item.id)).size, items.length)
    for (const item of items) assert.ok(item.href || item.at, item.id)
  })
  test('every link goes to a page that exists', () => {
    for (const item of items) if (item.href) assert.ok(routeExists(item.href), `${item.id}: ${item.href}`)
  })
  test('every name and line, in English, Arabic and French; every group named', () => {
    for (const language of ['en', 'ar', 'fr'] as const) {
      const strings = featureStrings(language)
      for (const item of items) {
        assert.ok(strings[`programme.${item.id}`], `${language} programme.${item.id}`)
        assert.ok(strings[`programme.${item.id}.text`], `${language} programme.${item.id}.text`)
      }
      for (const group of PROGRAMME) {
        assert.ok(strings[`programme.group.${group.id}`], `${language} group ${group.id}`)
        assert.ok(strings[`programme.chip.${group.id}`], `${language} chip ${group.id}`)
      }
      for (const at of new Set(items.flatMap((item) => (item.at ? [item.at] : [])))) {
        assert.ok(strings[`programme.at.${at}`], `${language} at ${at}`)
      }
    }
  })
  test('colours as "r g b"', () => {
    for (const group of PROGRAMME) assert.match(group.light, /^\d{1,3} \d{1,3} \d{1,3}$/)
  })
})

describe('The whole programme: Kids profiles', () => {
  test('nothing grown-up: no group, no thing', () => {
    const kids = programmeFor(true)
    assert.ok(kids.every((group) => !group.grownUp && group.items.every((item) => !item.grownUp)))
    assert.ok(!kids.some((group) => group.id === 'plus' || group.id === 'together'))
    assert.ok(kids.some((group) => group.id === 'pick' && group.play))
  })
  test('grown-ups get all of it', () => {
    assert.equal(programmeFor(false), PROGRAMME)
  })
})

describe('The whole programme: finding a thing', () => {
  test('every word, anywhere, any case or accent', () => {
    assert.ok(programmeMatches('', 'anything'))
    assert.ok(programmeMatches('  ', 'anything'))
    assert.ok(programmeMatches('tele ma', 'Lire sur ma télé'))
    assert.ok(programmeMatches('KIDS screen', 'Screen time: a daily limit for Kids profiles'))
    assert.ok(!programmeMatches('kids party', 'Screen time: a daily limit for Kids profiles'))
  })
  test('Arabic: vowel marks, tatweel and the alef and ta marbuta forms fold', () => {
    assert.equal(foldText('صُوِّر'), 'صور')
    assert.ok(programmeMatches('اطفال', 'ملفات الأطفال'))
    assert.ok(programmeMatches('شاشه', 'وقت الشاشة'))
    assert.ok(programmeMatches('العـربية', 'العربية'))
  })
  test('"New" until the day it says', () => {
    const until = { newUntil: '2027-02-15' }
    assert.ok(isNewItem(until, Date.parse('2027-02-14T23:00:00Z')))
    assert.ok(!isNewItem(until, Date.parse('2027-02-15T00:00:00Z')))
    assert.ok(!isNewItem({}))
  })
})
