#!/usr/bin/env node
// Checks the UI strings of every language against the English ones:
//   node scripts/check-translations.mjs        (npm run check:i18n)
//
// Errors (exit code 1):
// - a translation whose {placeholders} differ from the English string's;
// - French typography: an ASCII apostrophe (use ’), “ ” quotes (use « »), a missing no-break
//   space (U+00A0 before ':', U+202F before ? ! ; and inside « »);
// - '...' in French (use …).
// Warnings (printed, never fatal):
// - '...' in the other languages;
// - French identical to English (often fine: 'Action', 'Notifications'; listed to be looked at);
// - French longer than its slot (tab 10, hero action 11, primary button 14, mood chip 22, tile 24,
//   rail 20 characters);
// - feature strings without French (they fall back to English);
// - in Arabic and Derja, a word right after {name} that looks like a conjugated verb (starts with
//   ي or ت, or ends with ت or وا): it would have to agree with the person (see docs/DESIGN.md).
import { register } from 'node:module'

// The dictionaries are TypeScript: load them with the unit tests' resolver ('@/', .ts). Node's
// notice about reparsing them as ES modules is noise here.
process.removeAllListeners('warning')
register('../tests/loader-hooks.mjs', import.meta.url)

const { en } = await import('@/src/lib/i18n/en')
const { ar } = await import('@/src/lib/i18n/ar')
const { tn } = await import('@/src/lib/i18n/tn')
const { fr } = await import('@/src/lib/i18n/fr')
const features = await import('@/src/lib/i18n/features')

const NBSP = String.fromCharCode(0xa0)
const NNBSP = String.fromCharCode(0x202f)
const ARABIC_WORD = new RegExp(`^[${String.fromCharCode(0x600)}-${String.fromCharCode(0x6ff)}]+`)

const errors = []
const warnings = []
const error = (locale, key, message) => errors.push(`${locale} ${key}: ${message}`)
const warn = (kind, message) => warnings.push({ kind, message })

// English, complete: the core strings and every feature's.
const english = { ...en, ...features.featureStrings('en') }
const dictionaries = {
  ar: { ...ar, ...features.featureStrings('ar') },
  tn: { ...tn, ...features.featureStrings('tn') },
  fr: { ...fr, ...features.featureStrings('fr') },
}

const placeholders = (text) => new Set([...String(text).matchAll(/\{(\w+)\}/g)].map((match) => match[1]))

// 1. Placeholders, in every language. One the English string doesn't fill would show as "{name}";
//    one left out loses information, except in Arabic and Derja, whose zero/one/two forms say the
//    number in words ('حلقتان').
for (const [locale, dictionary] of Object.entries(dictionaries)) {
  for (const [key, value] of Object.entries(dictionary)) {
    if (!(key in english)) {
      error(locale, key, 'no English string with this key')
      continue
    }
    const expected = placeholders(english[key])
    const used = placeholders(value)
    const unknown = [...used].filter((name) => !expected.has(name))
    const dropped = [...expected].filter((name) => !used.has(name))
    if (unknown.length) error(locale, key, `{${unknown.join('}, {')}} is not in the English string`)
    if (dropped.length) {
      if (locale === 'fr') error(locale, key, `{${dropped.join('}, {')}} is missing`)
      else warn('placeholder', `${locale} ${key}: without {${dropped.join('}, {')}}`)
    }
    if (value.includes('...')) {
      if (locale === 'fr') error(locale, key, "'...' instead of …")
      else warn('ellipsis', `${locale} ${key}: '...' instead of …`)
    }
  }
}
for (const [key, value] of Object.entries(english)) {
  if (String(value).includes('...')) warn('ellipsis', `en ${key}: '...' instead of …`)
}

// 2. French typography.
const show = (text) => text.split(NBSP).join('⍽').split(NNBSP).join('·')
/** The French typography mistakes in `text` (an empty list when it's right). */
function frenchTypography(text) {
  const problems = []
  if (text.includes("'")) problems.push("ASCII apostrophe (use ’)")
  if (/[“”"]/.test(text)) problems.push('“ ” or " quotes (use « »)')
  // ':' as punctuation (followed by a space or the end; not 'S{season}:É{episode}' or 'https:').
  for (const match of text.matchAll(/(.):(?=\s|$)/g)) {
    if (match[1] !== NBSP) problems.push(`no U+00A0 before ':' in "${show(text.slice(Math.max(0, match.index - 8), match.index + 3))}"`)
  }
  for (const match of text.matchAll(/(.)([?!;])(?=\s|$|»|\))/g)) {
    if (match[1] !== NNBSP && !/[?!]/.test(match[1])) problems.push(`no U+202F before '${match[2]}' in "${show(text.slice(Math.max(0, match.index - 8), match.index + 3))}"`)
  }
  if (/[?!;:](?=[?!;:])/.test(text)) problems.push('two punctuation marks in a row')
  for (const match of text.matchAll(/«(.)/g)) if (match[1] !== NNBSP) problems.push('no U+202F after «')
  for (const match of text.matchAll(/(.)»/g)) if (match[1] !== NNBSP) problems.push('no U+202F before »')
  return problems
}
for (const [key, value] of Object.entries(dictionaries.fr)) {
  for (const problem of frenchTypography(value)) error('fr', key, problem)
}

// 3. French identical to English (keys whose French is the same word by nature are expected).
const SAME_ON_PURPOSE = /^(footer\.site|footer\.rights|countdown\.appleOutlook|filters\.minStars|detail\.minutes|detail\.budget|detail\.studios|detail\.source|form\.message|footer\.contact|genre\.fallback|filters\.genre|swipe\.genre|nav\.menu|nav\.ramadan|moment\.halloween\.title|clips\.pause|dept\.Production|wrapped\.(movieMany|episodesShort)|alerts\.bellLabel|settings\.notifications|pagination\.aria|mood\.short|filters\.runtime90|detail\.votes|countdown\.minutes|wrapped\.movieOne|search\.filterAll|common\.all)$/
for (const [key, value] of Object.entries(dictionaries.fr)) {
  if (value === english[key] && /[A-Za-z]{3}/.test(value) && !SAME_ON_PURPOSE.test(key)) warn('same', `fr ${key}: same as English ("${value}")`)
}

// 4. Slots: French that would overflow a short slot.
const SLOTS = [
  ['tab', 10, ['nav.home', 'nav.discover', 'nav.clips', 'nav.search', 'nav.you']],
  ['hero action', 11, ['billboard.myList', 'billboard.inMyList', 'peek.favorite', 'peek.unfavorite', 'hero.share', 'peek.moreInfo']],
  ['primary button', 14, ['billboard.play', 'detail.trailer', 'pick.moreInfo', 'home.resume', 'nav.signIn', 'nav.createAccount', 'push.turnOn']],
  ['mood chip', 22, ['mood.short', 'mood.family', 'mood.epic', 'mood.new', 'mood.bingeable', 'mood.laugh', 'mood.swipe', 'mood.dateNight', 'mood.scary', 'nav.surprise',
    ...['ramadan', 'eid-al-fitr', 'eid-al-adha', 'independence-day', 'republic-day', 'womens-day', 'new-year', 'christmas', 'halloween', 'valentines', 'awards', 'winter', 'summer', 'back-to-school'].map((id) => `moment.${id}.title`)]],
  ['tile', 24, ['swipe.title', 'nav.myYear', 'nav.surprise']],
  ['rail', 20, ['nav.home', 'nav.tvShows', 'nav.discover', 'nav.clips', 'nav.tunisian', 'nav.comingSoon', 'nav.topRated', 'nav.recent', 'nav.favorites', 'nav.bookmarked', 'nav.myLists', 'swipe.title', 'nav.myYear', 'nav.settings']],
]
for (const [slot, max, keys] of SLOTS) {
  for (const key of keys) {
    const value = dictionaries.fr[key]
    if (value && [...value].length > max) warn('slot', `fr ${key}: ${[...value].length} characters for a ${slot} (${max}): "${value}"`)
  }
}

// 5. Feature strings without French.
const missing = new Map()
for (const key of Object.keys(features.featureStrings('en'))) {
  if (!(key in dictionaries.fr)) {
    const feature = key.split('.')[0]
    missing.set(feature, (missing.get(feature) ?? 0) + 1)
  }
}
for (const [feature, count] of missing) warn('fr-missing', `fr: ${count} ${feature}.* string${count === 1 ? '' : 's'} without French (English is shown)`)

// 6. Arabic and Derja: a conjugated verb right after {name}.
const NOT_VERBS = new Set(['تونس', 'تونسي', 'تونسية', 'تلفزة', 'تلفزيون', 'تطبيق', 'ترشيح', 'تقييم', 'تقييمات'])
for (const locale of ['ar', 'tn']) {
  for (const [key, value] of Object.entries(dictionaries[locale])) {
    for (const match of String(value).matchAll(/\{name\}\s+(\S+)/g)) {
      const word = match[1].match(ARABIC_WORD)?.[0]
      if (!word || NOT_VERBS.has(word)) continue
      const first = word[0]
      if (first === 'ي' || first === 'ت' || word.endsWith('ت') || word.endsWith('وا')) {
        warn('verb', `${locale} ${key}: "{name} ${word}" looks like a verb that agrees with the person`)
      }
    }
  }
}

// Report.
const byKind = new Map()
for (const { kind, message } of warnings) byKind.set(kind, [...(byKind.get(kind) ?? []), message])
const TITLES = { placeholder: 'Arabic/Derja without a placeholder', ellipsis: "'...' outside French", same: 'French identical to English', slot: 'French longer than its slot', 'fr-missing': 'Feature strings without French', verb: 'Arabic/Derja: verb after {name}' }
for (const [kind, messages] of byKind) {
  console.log(`\nWarning: ${TITLES[kind] ?? kind} (${messages.length})`)
  for (const message of messages.slice(0, 40)) console.log(`  ${message}`)
  if (messages.length > 40) console.log(`  …and ${messages.length - 40} more`)
}
if (errors.length) {
  console.error(`\n${errors.length} error${errors.length === 1 ? '' : 's'}:`)
  for (const message of errors) console.error(`  ${message}`)
  process.exitCode = 1
} else {
  console.log(`\ncheck-translations: no errors (${Object.keys(english).length} keys; fr ${Object.keys(dictionaries.fr).length}, ar ${Object.keys(dictionaries.ar).length}, tn ${Object.keys(dictionaries.tn).length}).`)
}
