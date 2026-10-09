// Unit tests for the strings sent to the browser (clientMessages, src/lib/i18n/client-keys.ts):
//   npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LOCALES, clientMessages, dictionaryFor } from '@/src/lib/i18n'
import { SCOPE_KEYS, SERVER_ONLY_KEYS } from '@/src/lib/i18n/client-keys'

const scopes = Object.keys(SCOPE_KEYS)

test('client messages: every key is in the shell, in a scope, or server-only', () => {
  const all = Object.keys(dictionaryFor('en'))
  const shell = new Set(Object.keys(clientMessages('en')))
  const scoped = new Set(scopes.flatMap((scope) => SCOPE_KEYS[scope]))
  const serverOnly = new Set(SERVER_ONLY_KEYS)
  for (const key of all) {
    const places = [shell.has(key), scoped.has(key), serverOnly.has(key)].filter(Boolean).length
    assert.equal(places, 1, `${key}: in ${places} of shell, scopes, server-only`)
  }
  // A small shell: that's the point.
  assert.ok(shell.size < all.length / 3, `${shell.size} of ${all.length} keys on every page`)
  assert.ok(scopes.includes('movie-night/layout') && scopes.includes('page'))
})

test('client messages: the shell has what the root layout\'s client components translate', () => {
  for (const locale of LOCALES) {
    const shell = clientMessages(locale)
    // The I18nProvider's own announcements, the navigation, the search palette.
    for (const key of ['languages.switched', 'languages.offline', 'nav.home', 'nav.search', 'common.close']) {
      assert.equal(shell[key], dictionaryFor(locale)[key], `${locale} ${key}`)
    }
  }
})

test('client messages: a scope\'s strings in the language, English filling the gaps, built once', () => {
  const fr = clientMessages('fr', 'movie-night/layout')
  assert.deepEqual(Object.keys(fr).sort(), [...SCOPE_KEYS['movie-night/layout']].sort())
  for (const key of Object.keys(fr)) assert.equal(fr[key], dictionaryFor('fr')[key])
  // Derja leaves keys out: they come from Arabic, then English, like the server's t().
  const tn = clientMessages('tn', 'profile/layout')
  for (const key of SCOPE_KEYS['profile/layout']) assert.equal(tn[key], dictionaryFor('tn')[key])
  assert.strictEqual(clientMessages('fr', 'movie-night/layout'), fr)
  assert.strictEqual(clientMessages('ar'), clientMessages('ar'))
  // Nothing scoped or server-only in the shell.
  const shell = clientMessages('en')
  for (const key of SERVER_ONLY_KEYS) assert.ok(!(key in shell), key)
  for (const key of SCOPE_KEYS['movie-night/layout']) assert.ok(!(key in shell), key)
})
