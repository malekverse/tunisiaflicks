TRACK french · WAVE 1 · effort XL. Make French ('fr') a full fourth UI language: one LOCALE_META table, French catalogue text from TMDB, an atomic switch, and the Settings #display section.

COMMON RULES
- Worktree and git
  - Worktree: C:/Users/malek/AppData/Local/Temp/claude/C--Users-malek-OneDrive-Attachments-Documents-GitHub-tunisiaflicks/6a114b99-37cf-4f20-bc1e-b374d7220f50/scratchpad/tf-extras (branch feat/redesign), shared with the other agents in your wave.
  - Edit only your own files; report anything else as a shared-file request.
  - Shared git index: stage only your own paths and commit with a pathspec (`git commit -m 'msg' -- <paths>`). Never a bare commit, add -A, stash, reset or checkout of others' files. If .git/index.lock exists, wait 2–10s at random and retry (up to 10 times); never delete the lock.
- Design and strings
  - Follow docs/DESIGN.md: logical RTL utilities, 44px targets, text never below white/50, no all-caps, '·', '→' or emoji.
  - Strings go only in your feature file. Arabic and Derja: no verb right after {name}. French: no participle that agrees with {name}.
- Imports and tests
  - Client files import from '@/src/lib/i18n/locales' and '@/src/lib/i18n/translate', never values from '@/src/lib/i18n'.
  - Typecheck with `npx tsc --noEmit --incremental false` and fix only your own files.
  - Dev server :3300: don't start it. HTTP tests use BASE_URL (default :3000; run them with :3300). Unit tests: `*.unit.test.mjs` via `npm run test:unit`.
- Mongo 5.9: findOneAndUpdate returns {value}.
- Free tiers only.

FILES: see ownership 'french'.
- Foundations already created locales.ts, translate.ts, LanguageHint, LanguageSettings (stubs) and features/languages.ts, and wired #display, LanguageHint and the Settings nav.
- MediaHero, DetailSections, the detail pages and ChipRail go to other tracks in wave 2: keep your edits there line-local.

1. LOCALES (extend locales.ts)
- Locale 'en'|'fr'|'ar'|'tn'; LOCALES order en, fr, ar, tn.
- LOCALE_META:

| Locale | short | label | endonym | dir | script | htmlLang | og | tmdb | date |
|---|---|---|---|---|---|---|---|---|---|
| en | EN | English | English | ltr | latn | en | en_US | en-US | en-GB |
| fr | FR | Français | Français | ltr | latn | fr | fr_FR | fr-FR | fr-FR |
| ar | عربي | عربي | العربية | rtl | arab | ar | ar_TN | ar | ar-TN-u-nu-latn |
| tn | تونسي | تونسي | تونسي (الدارجة) | rtl | arab | ar-TN | ar_TN | ar | ar-TN-u-nu-latn |

- isArabicScript = script 'arab'. dateLocale always returns a string. Add ogLocale and ogAlternates.
- negotiateLocale is q-ordered: the first of en|fr|ar, never tn.
- index.ts: fr dictionary; the translator falls back to English; add dictionaryFor(locale).
- server.ts getLocale: cookie, then negotiate, then 'en'.
- Audit every isArabicScript and `locale === 'en'` site for fr.

2. fr.ts
- `Record<CoreKey, string>`, register 'vous'.
- Typography:
  - U+00A0 before ':'.
  - U+202F before ? ! ; and inside « », written as escapes.
  - ’ for apostrophes, … for the ellipsis.
- Keep placeholders exactly as they are.
- Glossary: Film, Série, Saison, Épisode ('S{season}:É{episode}'), Bande-annonce, Extraits, Distribution, Réalisation; 'À voir' (watchlist), Favoris, Mes listes, Mon année, Surprenez-moi, Le choix du jour, Lecture, Reprendre, Se connecter, Paramètres, 'Qui regarde ?', Enfants, Vous.
- Length limits: tab 10, hero action 11, primary button 14, mood chip 22, tile 24, rail 20.

3. features/languages.ts
- Keys: languages.settings.title (seeded), languages.settings.desc ('On this device.'), languages.hint.*, languages.switched ('Language: {language}'), languages.offline, languages.site.*.
- Fill en, ar, tn and fr for every key.

4. CATALOGUE
- tmdb-locale.ts:
  - catalogueLanguage: fr → 'fr-FR', otherwise undefined.
  - logoLanguages: fr → 'fr,en,null', otherwise 'en,null'.
  - translatedRecord: null for en.
  - localizeDetail: ar/tn overlay overview and genres; fr overlays title, name, overview, tagline, genres and poster. Season names. French logo rule.
  - genreList: cached 24h.
- genres.ts: add an fr column, with local names that win over TMDB's: Action et aventure, Enfants, Actualités, Téléréalité, Science-fiction et fantastique, Feuilleton, Talk-show, Guerre et politique, Policier, Science-fiction.
- Pass catalogueLanguage through the pages and libs in your list. New parameters are optional.

5. format.ts
- formatDate: headline capitalization for fr; YYYY-MM-DD parsed at T12:00Z.
- quote(): « » with narrow no-break spaces in fr, “ ” otherwise.
- languageName and regionName via Intl.DisplayNames (try/catch).
- Apply in PickOfTheDay, LibraryCollection, upcoming, MediaHero (tagline) and DetailSections.

6. LanguageSwitch
- Options EN, FR, عربي, تونسي, from LOCALE_META.
- Compact: unfolds with a 35ms stagger; the pill uses layoutId with spring.snappy.
- Stretch: h-11 segments. Use `label` from 420px up and `short` below (otherwise 'Français' is clipped at 375px). Test at 360 and 375px.
- Accessibility: radiogroup; options have lang, aria-label = endonym; roving focus (Left/Right mirrored under rtl, Home/End); Enter/Space selects; Escape folds the compact switch.
- haptic(8) on change.

7. Atomic switch (I18nProvider)
- Props {locale, messages?}; context adds pendingLocale and switching.
- setLocale:
  1. Write the tf-locale cookie (1 year, lax, secure on https).
  2. Set html data-locale-pending; globals.css dims #main and footer to .55 (160ms in, 240ms out, 120ms under reduced motion).
  3. startTransition(router.refresh()).
  4. On commit: set lang/dir, remove the attribute, and announce languages.switched politely.
- The dim lifts after 4s at the latest.
- Offline: show the languages.offline toast.
- syncLocale: POST /api/locale with keepalive, including the push endpoint.
- When `messages` is provided, use translatorFrom(messages).

8. LanguageSettings (replace the stub)
- `<SettingsSection id='display' title description>` containing a label row, `<LanguageSwitch stretch/>`, then `<TvModeSetting/>` (tv-mode's stub).

9. LanguageHint (replace the stub)
- Show once per device when: no tf-locale cookie, the locale is fr, localStorage 'tf-lang-hint' is unset, and the path isn't /profiles.
- After 1200ms, a Sonner toast: 'TunisiaFlicks parle français' / 'Vous pouvez changer de langue à tout moment depuis le menu.'
  - action 'عربي' calls setLocale('ar'); cancel 'English' calls setLocale('en'); duration 9s.

10. POST /api/locale
- JSON only (415 otherwise). Body {locale, endpoint?}, endpoint https and ≤2048 chars.
- Rate limit 30/h per IP.
- Sets users.locale and, when an endpoint is given, pushSubscriptions.locale (no upsert).
- Returns 200, 400, 415 or 429.

11. Legal, errors, SEO
- legal.ts: docs {en, ar, fr}; fallback isArabicScript ? ar : en; interface-language clause; bump.
- global-error: secondary line in fr or ar.
- offline.html: localized; sw.js VERSION v3.
- seo.ts description 'in English, French and Arabic'; alternateLocale ['fr_FR', 'ar_TN']; structured-data inLanguage.

12. Scripts
- scripts/check-translations.mjs
  - Errors: placeholder mismatches; ASCII apostrophes, missing NBSP and “ ” quotes in fr; '...'.
  - Warnings: fr identical to en; slot overruns; missing fr feature keys; an Arabic word right after {name} that starts with ي or ت or ends with ت or وا (allowlist).
- scripts/check-client-i18n.mjs: fail when a 'use client' file has a non-type import from '@/src/lib/i18n' itself.

13. DEFERRED: ?lang= URLs, hreflang, localized e-mails.

SHARED-FILE REQUESTS
- layout: messages and generateMetadata (localized title/description, og locales, French keywords).
- page: catalogueLanguage.
- share-sections: search subtitle.
- en/ar search.description:
  - en 'Search every movie, show and actor, in English, French or Arabic.'
  - ar 'ابحث عن أي فيلم أو مسلسل أو ممثل، بالعربية أو الفرنسية أو الإنجليزية.'
- package.json: check:i18n.
- README: languages.

ACCEPTANCE
1. tsc is clean; fr covers every CoreKey.
2. Cookie fr:
   - /about has lang='fr' dir='ltr'.
   - /privacy has no Arabic.
   - /movie/550 shows the French title.
   - /discover?type=tv doesn't show 'War & Politics'.
3. Negotiation table: 'fr-FR,fr;q=0.9' → fr; 'ar-TN,fr;q=0.8' → ar; 'de-DE,fr;q=0.5' → fr; 'de' → en; an en cookie beats fr; a tn cookie gives ar-TN rtl. Unit-tested in tests/french.unit.test.mjs.
4. No half-translated frame; the dim lifts.
5. check:i18n has no errors.
6. /api/locale returns 415, 400 and 200 as specified (tests/french.test.mjs).
7. The switch fits at 360px.