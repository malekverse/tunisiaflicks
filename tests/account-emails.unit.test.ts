// Unit tests for the account e-mails (src/lib/account-emails on src/lib/email-kit): the content in
// each language, right-to-left in Arabic and Derja, escaping, and the plain-text part.
// No server, no database, no network:
//   npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contactEmail, passwordResetEmail, releaseAlertsEmail, verificationEmail, type ReleaseAlert } from '@/src/lib/account-emails'

const appUrl = 'https://tunisiaflicks.example/'

const alerts: ReleaseAlert[] = [
  { media_type: 'tv', tmdbId: '1399', title: 'Game of Thrones', poster_path: '/got.jpg', event: { kind: 'episode', code: 'S08E06', name: 'The Iron Throne', date: '2026-10-11' } },
  { media_type: 'movie', tmdbId: '603', title: 'The Matrix', poster_path: null, event: { kind: 'movie', date: '2026-10-10' } },
]

test('confirm e-mail: the site look, the link on the button and to paste, English by default', () => {
  const mail = verificationEmail({ appUrl, token: 'tok/en+1' })
  assert.equal(mail.subject, 'Confirm your e-mail for TunisiaFlicks')
  const link = 'https://tunisiaflicks.example/auth/verify-email?token=tok%2Fen%2B1'
  assert.equal(mail.html.split(link).length - 1, 3, 'the button, and the link to paste (its href and its text)')
  assert.ok(mail.html.includes('/email/wordmark.png') && mail.html.includes('/email/mark.png'), 'the wordmark and the red A')
  assert.ok(mail.html.includes('#e50f05'), 'the red pill')
  assert.ok(mail.html.includes('lang="en" dir="ltr"'))
  assert.ok(mail.text.includes(`Confirm my e-mail: ${link}`))
  assert.ok(!/undefined|null|NaN|\{\w+\}/.test(mail.html), 'no missing value or unfilled placeholder')
})

test('reset password: in French with French spacing, in Arabic right to left', () => {
  const fr = passwordResetEmail({ locale: 'fr', appUrl, token: 'x' })
  assert.equal(fr.subject, 'Réinitialisez votre mot de passe TunisiaFlicks')
  assert.ok(fr.html.includes('lang="fr"'))
  assert.ok(!/ [?:!]/.test(fr.text.replace(/https?:\/\/\S+/g, '')), 'no plain space before ? : ! in French')

  const ar = passwordResetEmail({ locale: 'ar', appUrl, token: 'x' })
  assert.ok(ar.html.includes('dir="rtl"'))
  assert.ok(ar.html.includes('اختر كلمة مرور جديدة'))
  assert.ok(ar.html.includes('text-align:right'), 'text starts on the right')
})

test('an unknown language falls back to English', () => {
  assert.equal(verificationEmail({ locale: 'xx', appUrl, token: 't' }).subject, 'Confirm your e-mail for TunisiaFlicks')
})

test('release alerts: one e-mail, each title with what is new and when, posters or a stand-in', () => {
  const mail = releaseAlertsEmail({ appUrl, alerts })
  assert.equal(mail.subject, '2 titles you follow have something new')
  assert.ok(mail.html.includes('New episode · S08E06 · The Iron Throne'))
  assert.ok(mail.html.includes('Aired 11 October 2026') && mail.html.includes('Released 10 October 2026'))
  assert.ok(mail.html.includes('https://image.tmdb.org/t/p/w342/got.jpg'))
  assert.ok(mail.html.includes('href="https://tunisiaflicks.example/movie/603"'))
  assert.equal(mail.html.split('>Watch now<').length - 1, 2, 'a small Watch pill per title')
  assert.ok(mail.text.includes('- The Matrix: Out now (Released 10 October 2026)'))
  assert.ok(mail.html.includes('/profile#following'), 'the way to manage alerts')

  const one = releaseAlertsEmail({ locale: 'en', appUrl, alerts: alerts.slice(1) })
  assert.equal(one.subject, 'The Matrix is out now')
  assert.equal(one.html.split('>Watch now<').length - 1, 1, 'one title: only the red button')
})

test('release alerts in Arabic and Derja: right to left, dates in the language, titles isolated', () => {
  const ar = releaseAlertsEmail({ locale: 'ar', appUrl, alerts: alerts.slice(0, 1) })
  assert.equal(ar.subject, 'حلقة جديدة من ⁨Game of Thrones⁩')
  assert.ok(ar.html.includes('dir="rtl"') && ar.html.includes('حلقة جديدة'))
  const tn = releaseAlertsEmail({ locale: 'tn', appUrl, alerts })
  assert.ok(tn.html.includes('dir="rtl"') && tn.html.includes('تفرّج توا'))
})

test('everything from outside is escaped', () => {
  const mail = releaseAlertsEmail({ appUrl, alerts: [{ ...alerts[1], title: '<script>alert(1)</script> & "Co"' }] })
  assert.ok(!mail.html.includes('<script>'))
  assert.ok(mail.html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;Co&quot;'))
  const contact = contactEmail({ appUrl, msg: { kind: 'dmca', name: 'A <b>', email: 'a@example.test', message: '<img src=x onerror=alert(1)>', urls: 'https://x.test/<1>' } })
  assert.ok(!contact.html.includes('<img src=x') && !contact.html.includes('<b>'))
  assert.equal(contact.subject, '[DMCA] Copyright notice from A <b>')
  assert.ok(contact.text.startsWith('From: A <b> <a@example.test>'))
})
