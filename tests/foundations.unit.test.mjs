// Unit tests for the wave-0 helpers (no server, no database):
//   npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE, dateLocale, dirOf, htmlLang, isArabicScript, isLocale,
} from '@/src/lib/i18n/locales'
import { fillPlaceholders, translateApiMessage, translatorFrom } from '@/src/lib/i18n/translate'
import { withTimeout } from '@/src/lib/with-timeout'
import { scrubBreadcrumb, scrubEvent, scrubQuery, scrubText, scrubUrl } from '@/src/lib/scrub-url'

test('locales: the three languages and what follows from each', () => {
  assert.deepEqual([...LOCALES], ['en', 'ar', 'tn'])
  assert.equal(DEFAULT_LOCALE, 'en')
  assert.equal(LOCALE_COOKIE, 'tf-locale')
  for (const locale of LOCALES) assert.ok(isLocale(locale))
  for (const value of ['', 'EN', 'fr-FR', null, undefined, 1, {}]) assert.equal(isLocale(value), false)
  assert.equal(isArabicScript('en'), false)
  assert.equal(isArabicScript('ar'), true)
  assert.equal(isArabicScript('tn'), true)
  assert.equal(dirOf('en'), 'ltr')
  assert.equal(dirOf('ar'), 'rtl')
  assert.equal(dirOf('tn'), 'rtl')
  assert.equal(htmlLang('en'), 'en')
  assert.equal(htmlLang('ar'), 'ar')
  assert.equal(htmlLang('tn'), 'ar-TN')
  assert.equal(dateLocale('en'), undefined)
  assert.equal(dateLocale('ar'), 'ar-TN-u-nu-latn')
  assert.equal(dateLocale('tn'), 'ar-TN-u-nu-latn')
})

test('translate: placeholders, fallback and API messages', () => {
  const t = translatorFrom({ hello: 'Salut {name}', only: 'ici' }, { hello: 'Hello {name}', other: 'English only' })
  assert.equal(t('hello', { name: 'Amine' }), 'Salut Amine')
  assert.equal(t('other'), 'English only')
  assert.equal(t('missing.key'), 'missing.key')
  assert.equal(t('hello'), 'Salut {name}')
  assert.equal(fillPlaceholders('{a} and {b}', { a: 1 }), '1 and {b}')
  const api = translatorFrom({ 'api.userExists': 'Ce compte existe déjà' })
  assert.equal(translateApiMessage(api, 'User already exists'), 'Ce compte existe déjà')
  assert.equal(translateApiMessage(api, 'Something else'), 'Something else')
  assert.equal(translateApiMessage(api, undefined), undefined)
})

test('withTimeout: the value when in time', async () => {
  assert.equal(await withTimeout(Promise.resolve(42), 50, 0), 42)
  const slowButInTime = new Promise((resolve) => setTimeout(() => resolve('row'), 5))
  assert.equal(await withTimeout(slowButInTime, 200, null), 'row')
})

test('withTimeout: the fallback when late', async () => {
  const late = new Promise((resolve) => setTimeout(() => resolve('late'), 200))
  const started = Date.now()
  assert.equal(await withTimeout(late, 20, 'fallback'), 'fallback')
  assert.ok(Date.now() - started < 150, 'did not wait for the slow task')
})

test('withTimeout: the fallback when the task fails, without rejecting', async () => {
  const original = console.error
  console.error = () => {}
  try {
    assert.equal(await withTimeout(Promise.reject(new Error('boom')), 50, null), null)
  } finally {
    console.error = original
  }
})

test('scrubUrl: removes invite, t, code, device and k, keeps the rest', () => {
  assert.equal(scrubUrl('/u/x?invite=abc'), '/u/x')
  assert.equal(scrubUrl('https://tunisiaflicks.vercel.app/u/x?invite=abc&tab=lists#ratings'), 'https://tunisiaflicks.vercel.app/u/x?tab=lists#ratings')
  assert.equal(scrubUrl('/unsubscribe?t=SIGNED.value'), '/unsubscribe')
  assert.equal(scrubUrl('/activate?code=ABC123&device=tv1'), '/activate')
  assert.equal(scrubUrl('/u/amine?k=key123&ref=share'), '/u/amine?ref=share')
  assert.equal(scrubUrl('/search?q=batman&page=2'), '/search?q=batman&page=2')
  assert.equal(scrubUrl('/movie/550'), '/movie/550')
  assert.equal(scrubUrl('/x?%69nvite=abc&a=1'), '/x?a=1', 'encoded names are recognised')
  assert.equal(scrubUrl('/x?invites=1&tt=2&kk=3'), '/x?invites=1&tt=2&kk=3', 'only exact names')
  assert.equal(scrubUrl('/profiles?next=%2Fu%2Fx%3Finvite%3Dabc'), '/profiles?next=%2Fu%2Fx', 'return addresses are scrubbed too')
  assert.equal(scrubUrl('/login?callbackUrl=%2Fsearch%3Fq%3Ddune'), '/login?callbackUrl=%2Fsearch%3Fq%3Ddune')
  assert.equal(scrubQuery('?invite=abc&q=1'), 'q=1')
  assert.equal(scrubQuery('invite=abc'), '')
})

test('scrubText: secret values in free text are filtered', () => {
  assert.equal(scrubText('Failed to load /u/x?invite=abc&tab=1'), 'Failed to load /u/x?invite=[Filtered]&tab=1')
  assert.equal(scrubText('to /profiles?next=%2Fu%2Fx%3Finvite%3Dabc%26tab%3D1'), 'to /profiles?next=%2Fu%2Fx%3Finvite%3D[Filtered]%26tab%3D1')
  assert.equal(scrubText('nothing here'), 'nothing here')
})

test('scrubEvent and scrubBreadcrumb: a report from ?invite=abc carries no abc', () => {
  const event = {
    message: 'Crash on https://site/u/x?invite=abc',
    request: {
      url: 'https://site/u/x?invite=abc&tab=lists',
      query_string: 'invite=abc&tab=lists',
      headers: { Referer: 'https://site/lists/fav?invite=abc' },
    },
    exception: { values: [{ type: 'Error', value: 'GET /api/social/requests?invite=abc failed' }] },
    breadcrumbs: [
      { category: 'navigation', data: { from: '/u/x?invite=abc', to: '/profiles?next=%2Fu%2Fx%3Finvite%3Dabc' } },
      { category: 'fetch', data: { url: '/api/notifications?code=abc', method: 'GET' } },
    ],
  }
  const scrubbed = scrubEvent(event)
  assert.doesNotMatch(JSON.stringify(scrubbed), /abc/)
  assert.equal(scrubbed.request.url, 'https://site/u/x?tab=lists')
  assert.equal(scrubbed.request.query_string, 'tab=lists')
  assert.deepEqual(scrubEvent({ request: { query_string: [['invite', 'abc'], ['q', '1']] } }).request.query_string, [['q', '1']])
  assert.deepEqual(scrubEvent({ request: { query_string: { invite: 'abc', q: '1' } } }).request.query_string, { q: '1' })
  assert.equal(scrubBreadcrumb({ data: { url: '/x?k=secret' } }).data.url, '/x')
})

test('scrubEvent and scrubBreadcrumb: split-off queries and stack frames are scrubbed too', () => {
  // The server SDK keeps an outgoing request's query beside a sanitized URL.
  const crumb = scrubBreadcrumb({ category: 'http', data: { url: 'https://site/api/x', 'http.query': 'invite=abc&page=2', 'url.query': 'k=abc' } })
  assert.equal(crumb.data['http.query'], 'page=2')
  assert.equal(crumb.data['url.query'], '')
  // An inline script's frame carries the page address.
  const event = scrubEvent({
    exception: { values: [{ type: 'TypeError', value: 'x is undefined', stacktrace: { frames: [
      { filename: 'https://site/u/x?invite=abc', abs_path: 'https://site/u/x?invite=abc&tab=1', lineno: 1 },
      { filename: 'app:///_next/static/chunks/main.js', lineno: 2 },
    ] } }] },
  })
  assert.doesNotMatch(JSON.stringify(event), /abc/)
  assert.equal(event.exception.values[0].stacktrace.frames[0].abs_path, 'https://site/u/x?tab=1')
  assert.equal(event.exception.values[0].stacktrace.frames[1].filename, 'app:///_next/static/chunks/main.js')
})
