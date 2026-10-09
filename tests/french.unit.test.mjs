// Unit tests for French as a UI language (no server, no database, no TMDB):
//   npm run test:unit
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  LOCALES, LOCALE_META, dateLocale, dirOf, htmlLang, isArabicScript, isLocale, negotiateLocale, ogAlternates, ogLocale, resolveLocale,
} from '@/src/lib/i18n/locales'
import { formatDate, languageName, quote, regionName } from '@/src/lib/i18n/format'
import { en } from '@/src/lib/i18n/en'
import { fr } from '@/src/lib/i18n/fr'
import { createTranslator, dictionaryFor } from '@/src/lib/i18n'
import { featureStrings } from '@/src/lib/i18n/features'
import { genreNames, localGenreName } from '@/src/lib/genres'
import { catalogueLanguage, localizeDetail, logoLanguages } from '@/src/lib/tmdb-locale'
import { tmdbLanguage } from '@/src/lib/tmdb'
import { pageMetadata, siteMetadata } from '@/src/lib/seo'

const NBSP = String.fromCharCode(0xa0)
const NNBSP = String.fromCharCode(0x202f)

test('locales: four languages, in the switch order, from one table', () => {
  assert.deepEqual([...LOCALES], ['en', 'fr', 'ar', 'tn'])
  assert.deepEqual(LOCALES.map((locale) => LOCALE_META[locale].short), ['EN', 'FR', 'عربي', 'تونسي'])
  assert.equal(LOCALE_META.fr.label, 'Français')
  assert.equal(LOCALE_META.fr.endonym, 'Français')
  assert.ok(isLocale('fr'))
  for (const value of ['FR', 'fr-FR', 'de', '', null]) assert.equal(isLocale(value), false)
  assert.equal(isArabicScript('fr'), false)
  assert.equal(isArabicScript('tn'), true)
  assert.equal(dirOf('fr'), 'ltr')
  assert.equal(htmlLang('fr'), 'fr')
  assert.equal(htmlLang('tn'), 'ar-TN')
  // Always an explicit Intl locale, so server and browser agree.
  assert.deepEqual(LOCALES.map(dateLocale), ['en-GB', 'fr-FR', 'ar-TN-u-nu-latn', 'ar-TN-u-nu-latn'])
  assert.deepEqual(LOCALES.map(tmdbLanguage), ['en-US', 'fr-FR', 'ar', 'ar'])
})

test('locales: Open Graph locale and alternates', () => {
  assert.equal(ogLocale('fr'), 'fr_FR')
  assert.deepEqual(ogAlternates('en'), ['fr_FR', 'ar_TN'])
  assert.deepEqual(ogAlternates('fr'), ['en_US', 'ar_TN'])
  assert.deepEqual(ogAlternates('tn'), ['en_US', 'fr_FR'])
})

test('negotiation: the first of en, fr, ar in the browser\'s order, never Derja', () => {
  assert.equal(negotiateLocale('fr-FR,fr;q=0.9'), 'fr')
  assert.equal(negotiateLocale('ar-TN,fr;q=0.8'), 'ar')
  assert.equal(negotiateLocale('de-DE,fr;q=0.5'), 'fr')
  assert.equal(negotiateLocale('de'), undefined)
  assert.equal(negotiateLocale('de-DE,en;q=0.3,fr;q=0.7'), 'fr', 'q values decide, not the header order')
  assert.equal(negotiateLocale('fr;q=0.5,ar;q=0.5'), 'fr', 'ties keep the header order')
  assert.equal(negotiateLocale('fr;q=0,en'), 'en', 'q=0 means "not this one"')
  assert.equal(negotiateLocale('*'), undefined)
  assert.equal(negotiateLocale(''), undefined)
  assert.equal(negotiateLocale(null), undefined)
  assert.equal(negotiateLocale('tn,ar-TN'), 'ar')
})

test('resolveLocale: the cookie wins, then the browser, then English', () => {
  assert.equal(resolveLocale(undefined, 'fr-FR,fr;q=0.9'), 'fr')
  assert.equal(resolveLocale(undefined, 'de'), 'en')
  assert.equal(resolveLocale('en', 'fr-FR,fr;q=0.9'), 'en', 'an English cookie beats a French browser')
  assert.equal(resolveLocale('tn', 'fr-FR'), 'tn')
  assert.equal(htmlLang(resolveLocale('tn', null)), 'ar-TN')
  assert.equal(dirOf(resolveLocale('tn', null)), 'rtl')
  assert.equal(resolveLocale('xx', 'ar'), 'ar', 'a broken cookie is ignored')
})

test('formatDate: calendar days at noon UTC, French headlines capitalized', () => {
  assert.equal(formatDate('2026-10-08', 'fr', { weekday: 'long' }), 'jeudi')
  assert.equal(formatDate('2026-10-08', 'fr', { weekday: 'long' }, { headline: true }), 'Jeudi')
  assert.equal(formatDate('2026-10-08', 'fr', { day: 'numeric', month: 'long', year: 'numeric' }), '8 octobre 2026')
  assert.equal(formatDate('2026-10-08', 'en', { day: 'numeric', month: 'long', year: 'numeric' }), '8 October 2026')
  assert.equal(formatDate('2026-10-08', 'ar', { day: 'numeric', month: 'long' }), '8 أكتوبر')
  // The first of January stays the first of January whatever the time zone.
  assert.equal(formatDate('2027-01-01', 'fr', { day: 'numeric', month: 'long' }), '1 janvier')
  assert.equal(formatDate('not a date', 'fr', { day: 'numeric' }), '')
  assert.equal(formatDate(new Date(Date.UTC(2026, 9, 8, 12)), 'fr', { month: 'long', timeZone: 'UTC' }), 'octobre')
})

test('quote and Intl names', () => {
  assert.equal(quote('Rien ne va plus', 'fr'), `«${NNBSP}Rien ne va plus${NNBSP}»`)
  assert.equal(quote('Why so serious?', 'en'), '“Why so serious?”')
  assert.equal(languageName('en', 'fr'), 'Anglais')
  assert.equal(languageName('ar', 'en'), 'Arabic')
  assert.equal(regionName('TN', 'fr'), 'Tunisie')
  assert.equal(regionName('tn', 'en'), 'Tunisia')
  assert.equal(languageName('qqq', 'fr'), undefined)
  assert.equal(languageName('', 'fr'), undefined)
})

test('fr.ts covers every core key, with the same placeholders', () => {
  const missing = Object.keys(en).filter((key) => !(key in fr))
  assert.deepEqual(missing, [])
  for (const [key, value] of Object.entries(fr)) {
    const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort().join()
    assert.equal(placeholders(value), placeholders(en[key]), `${key}: placeholders`)
  }
  // French typography: npm run check:i18n warns about it, never failing a build.
  // The glossary.
  assert.equal(fr['common.seasonEpisode'], 'S{season}:É{episode}')
  assert.equal(fr['profiles.whoIsWatching'], `Qui regarde${NNBSP}?`)
  assert.equal(fr['nav.bookmarked'], 'À voir')
  assert.equal(fr['pick.title'], 'Le choix du jour')
  assert.equal(fr['billboard.play'], 'Lecture')
})

test('the French translator, with English filling the gaps', () => {
  const t = createTranslator('fr')
  assert.equal(t('nav.settings'), 'Paramètres')
  assert.equal(t('languages.switched', { language: 'Français' }), `Langue${NBSP}: Français`)
  const messages = dictionaryFor('fr')
  for (const key of Object.keys({ ...en, ...featureStrings('en') })) assert.ok(key in messages, `${key} in dictionaryFor('fr')`)
  assert.equal(messages['nav.home'], 'Accueil')
  assert.equal(dictionaryFor('tn')['nav.home'], createTranslator('tn')('nav.home'))
  assert.strictEqual(dictionaryFor('fr'), messages, 'built once per language')
})

test('genres: French names of our own, TMDB\'s elsewhere', () => {
  assert.deepEqual(genreNames([80, 878, 10768], 'fr'), ['Policier', 'Science-fiction', 'Guerre et politique'])
  assert.deepEqual(genreNames([80], 'tn'), ['جريمة'])
  assert.equal(localGenreName(10766, 'fr'), 'Feuilleton')
  assert.equal(localGenreName(10766, 'en'), undefined)
  assert.equal(localGenreName(10766, 'ar'), undefined)
})

test('catalogue language and logos', () => {
  assert.equal(catalogueLanguage('fr'), 'fr-FR')
  assert.equal(catalogueLanguage('en'), undefined)
  assert.equal(catalogueLanguage('ar'), undefined)
  assert.equal(logoLanguages('fr'), 'fr,en,null')
  assert.equal(logoLanguages('tn'), 'en,null')
})

const english = {
  id: 155,
  title: 'The Dark Knight',
  overview: 'Batman raises the stakes.',
  tagline: 'Why so serious?',
  poster_path: '/en.jpg',
  genres: [{ id: 80, name: 'Crime' }, { id: 18, name: 'Drama' }],
  seasons: [{ id: 1, name: 'Season 1', poster_path: '/s1.jpg' }],
  images: { logos: [{ iso_639_1: 'en', file_path: '/logo-en.png' }, { iso_639_1: 'fr', file_path: '/logo-fr.png' }] },
}

test('localizeDetail: French title, text, poster and genres', () => {
  const french = {
    title: 'The Dark Knight : Le Chevalier noir', overview: 'Batman aborde une phase décisive.', tagline: '', poster_path: '/fr.jpg',
    genres: [{ id: 80, name: 'Crime' }, { id: 18, name: 'Drame' }], seasons: [{ id: 1, name: 'Saison 1' }],
  }
  const data = localizeDetail(english, french, 'fr')
  assert.equal(data.title, 'The Dark Knight : Le Chevalier noir')
  assert.equal(data.overview, 'Batman aborde une phase décisive.')
  assert.equal(data.tagline, '', 'no French tagline: none (not the English one in « »)')
  assert.equal(localizeDetail(english, { ...french, tagline: 'Pourquoi tant de sérieux ?' }, 'fr').tagline, 'Pourquoi tant de sérieux ?')
  assert.equal(localizeDetail(english, null, 'fr').tagline, 'Why so serious?', 'no French record at all: the page stays English')
  assert.equal(data.poster_path, '/fr.jpg')
  assert.deepEqual(data.genres.map((genre) => genre.name), ['Policier', 'Drame'])
  assert.equal(data.seasons[0].name, 'Saison 1')
  assert.equal(data.seasons[0].poster_path, '/s1.jpg')
  assert.deepEqual(data.images.logos.map((logo) => logo.file_path), ['/logo-fr.png'])
  assert.equal(english.title, 'The Dark Knight', 'the English record is not changed')
})

test('localizeDetail: the French logo rule', () => {
  const englishLogoOnly = { ...english, images: { logos: [{ iso_639_1: 'en', file_path: '/logo-en.png' }] } }
  // A different French title and no French logo: no logo (the title is shown in type).
  assert.deepEqual(localizeDetail(englishLogoOnly, { title: 'Le Chevalier noir' }, 'fr').images.logos, [])
  // The same title in French: the English logo is fine.
  assert.deepEqual(localizeDetail(englishLogoOnly, { title: 'The Dark Knight' }, 'fr').images.logos.map((logo) => logo.file_path), ['/logo-en.png'])
})

test('localizeDetail: Arabic only overlays the overview and genres; English is untouched', () => {
  const arabic = { title: 'فارس الظلام', overview: 'باتمان…', tagline: 'لماذا؟', poster_path: '/ar.jpg', genres: [{ id: 80, name: 'جريمة' }] }
  const data = localizeDetail(english, arabic, 'ar')
  assert.equal(data.title, 'The Dark Knight')
  assert.equal(data.tagline, 'Why so serious?')
  assert.equal(data.poster_path, '/en.jpg')
  assert.equal(data.overview, 'باتمان…')
  assert.equal(data.genres[0].name, 'جريمة')
  assert.equal(data.images, english.images)
  assert.strictEqual(localizeDetail(english, arabic, 'en'), english)
  assert.strictEqual(localizeDetail(english, null, 'ar'), english)
  assert.deepEqual(localizeDetail(english, null, 'fr').genres.map((genre) => genre.name), ['Policier', 'Drame'], 'French genre names even without a French record')
})

test('siteMetadata: the site described in the language of the page, with its og:locale', () => {
  const french = siteMetadata('fr', createTranslator('fr'))
  assert.equal(french.title, `TunisiaFlicks${NBSP}: films, séries et séries tunisiennes`)
  assert.match(String(french.description), /en français, en anglais et en arabe/)
  assert.equal(french.openGraph.locale, 'fr_FR')
  assert.deepEqual(french.openGraph.alternateLocale, ['en_US', 'ar_TN'])
  assert.equal(french.openGraph.title, french.title)
  assert.ok(french.keywords.includes('Séries tunisiennes'))
  const english = siteMetadata('en', createTranslator('en'))
  assert.equal(english.title, 'TunisiaFlicks: movies, TV shows and Tunisian series')
  assert.equal(english.openGraph.locale, 'en_US')
  const derja = siteMetadata('tn', createTranslator('tn'))
  assert.equal(derja.openGraph.locale, 'ar_TN')
  assert.deepEqual(derja.openGraph.alternateLocale, ['en_US', 'fr_FR'])
  assert.match(String(derja.title), /TunisiaFlicks/)
})

test('pageMetadata: og:locale follows the language of the page (English outside a request)', () => {
  const page = pageMetadata({ title: 'À propos', path: '/about' })
  assert.equal(page.openGraph.locale, 'en_US')
  assert.deepEqual(page.openGraph.alternateLocale, ['fr_FR', 'ar_TN'])
  assert.equal(page.title, 'À propos | TunisiaFlicks')
})
