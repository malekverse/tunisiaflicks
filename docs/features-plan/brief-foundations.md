TRACK foundations · WAVE 0 · effort L

GOAL
You run alone, before any other agent. You land everything two or more tracks depend on, so each later track can see and verify its own work in its own wave. Commit in small steps. Every stub starts with the comment 'STUB: implemented by <track> in wave <n>; keep the signature'.

COMMON RULES
- Worktree and git
  - Worktree: C:/Users/malek/AppData/Local/Temp/claude/C--Users-malek-OneDrive-Attachments-Documents-GitHub-tunisiaflicks/6a114b99-37cf-4f20-bc1e-b374d7220f50/scratchpad/tf-extras (branch feat/redesign).
  - All agents share one git index. Stage only your own paths with `git add -- <paths>`.
  - Commit with a pathspec: `git commit -m 'msg' -- <paths>`. Never a bare commit, `add -A`, stash, reset or checkout of other files.
  - On an index.lock error, wait 2–10s at random and retry, up to 10 times. Never delete the lock.
- Design (docs/DESIGN.md)
  - Red only as signal; logical RTL utilities; 44px targets; text never below white/50.
  - No all-caps, '·', '→' or emoji.
- Tooling
  - Typecheck with `npx tsc --noEmit --incremental false`.
  - Dev server on :3300 (don't start or build it).
  - Never junction node_modules.
- MongoDB driver 5.9: findOneAndUpdate returns {value}; claims check modifiedCount.
- Free tiers only.

FILES: see ownership 'foundations'. Each file passes to its named owner afterwards.

A. TOOLING
1. Install exact pins (versions at least 2 weeks old; check `npm view <pkg> time`):
   - `npm i -E uqr @radix-ui/react-popover`
2. Scripts:
   - `typecheck`: `tsc --noEmit --incremental false`
   - `test:unit`: `node --import ./tests/register.mjs --test \"tests/*.unit.test.*\"`
   - `test:smoke`: `node --import ./tests/register.mjs --test \"tests/*.test.mjs\"`
3. tests/register.mjs registers tests/loader-hooks.mjs via module.register. The resolve hook:
   - '@/x' maps to the repo root.
   - Extensionless or directory specifiers try .ts, .mts, .mjs, .js, then /index.ts.
   - 'next/cache' maps to stubs (unstable_cache passes through; revalidate* are no-ops).
   - 'server-only' maps to an empty module.
   - 'next/headers' maps to empty cookies() and headers().
   - .tsx is unsupported.
4. tests/smoke.test.mjs: `BASE_URL ?? 'http://localhost:3000'`.
5. ci.yml:
   - Node 22.
   - env BASE_URL=http://localhost:3000; CRON_SECRET and EMAIL_TOKEN_SECRET as 40-character test values.
   - Run `npm run test:unit` before the build; keep test:smoke after start.

B. I18N SPLIT
1. src/lib/i18n/locales.ts (no imports). Move from index.ts, with behaviour unchanged and still 3 locales: Locale, Dir, LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, isArabicScript, dirOf, htmlLang, dateLocale.
2. src/lib/i18n/translate.ts:
   - `translatorFrom(messages, fallback?)`, with the same placeholder fill as createTranslator.
   - Move translateApiMessage here.
3. index.ts re-exports both files.
4. src/lib/i18n/rich.tsx: `richT(t, key, vars, {bold})`. Splits the template on {var}, wraps each var in <bdi>, and wraps bold ones in <strong className='font-semibold text-white'>.
5. Seed keys:
   - Create features/languages.ts with 'languages.settings.title' (en 'Language and display', ar 'اللغة والعرض') and register it in features/index.ts (FEATURES + FeatureKey).
   - social.ts: 'social.privacy.title' (en 'Friends and privacy', ar 'الأصدقاء والخصوصية').
   - badges.ts: 'badges.supporter.title' (en 'Supporter', ar 'الدعم').
6. Write src/lib/social/types.ts verbatim from the contracts.

C. PRIMITIVES
1. src/components/ui/popover.tsx: Popover, Trigger, Anchor, Content, Close.
   - Content: glass-strong, rounded-[22px], ring-1 ring-white/[0.08], sideOffset 8, collisionPadding 12.
   - Entry: scale .97→1 plus opacity (tween.fast), origin-aware; opacity only under reduced motion.
2. EmptyState (MediaGrid.tsx): `action?: ReactNode`, rendered mt-5 outside the text wrapper.
3. SectionHeader (rows/Row.tsx): `end?: ReactNode`, placed at the inline end.
4. SignInInvite: `{icon, title?, text?, callbackUrl?, className?}`.
   - Links to `/login?callbackUrl=`; the default is the current path + search, read in an effect.
   - Keep today's copy as the default.

D. HELPERS
1. src/lib/with-timeout.ts
2. src/lib/tv-mode.ts: TV_COOKIE 'tf-tv', isTvMode().
3. src/lib/session-scope.ts: isLimitedSession(session) and denyLimitedSession() (403 {code:'tv_session'}).
   - Add `scope?: 'tv'` and `pinnedProfileId?: string` to Session and JWT in src/types/next-auth.d.ts.
4. src/lib/scrub-url.ts: scrubUrl(url) removes invite, t, code, device and k.

E. SECURITY PREREQUISITES
1. POST /api/user-content: validate, else 400.
   - id /^[0-9]{1,9}$/; media_type 'movie' or 'tv'.
   - title cleaned, ≤200 (same rule as toListItem in lists-db.ts).
   - poster_path null or /^[/][A-Za-z0-9._-]+$/.
   - season and episode are integers 0–999.
   - scripts/clean-user-content.mjs: dry run by default, `--apply` writes, prints counts.
2. updateProfile (src/app/profile/actions.ts) and ProfileForm:
   - An e-mail change needs currentPassword (bcrypt) when the account has a password.
   - Google-only accounts need session.loginAt under 10 minutes old, else {error:'reauth'}.
   - The password field shows only when the e-mail input changed.
   - updateProfile and updateAvatar refuse limited sessions.
3. src/app/api/account/**:
   - Mutating handlers call denyLimitedSession first.
   - Setting a first password needs a login under 10 minutes old (403 {code:'reauth'}).
4. /api/profiles POST and /api/profiles/[id] PATCH/DELETE call denyLimitedSession first.
5. Sentry:
   - beforeSend and beforeBreadcrumb in sentry.server.config.ts, sentry.edge.config.ts and the browser init in src/lib/report-error.ts.
   - Pass event.request.url, query_string and breadcrumb URLs through scrubUrl.
6. next.config.js headers():
   - All routes: Referrer-Policy strict-origin-when-cross-origin.
   - /unsubscribe, /api/unsubscribe and /activate: no-referrer.
7. src/components/shell/use-shell-account.ts useProfileGate: `next = pathname + window.location.search`.

F. STUBS (exact signatures from the contracts) AND MOUNTS
Stubs:
- social: share/ShareSheetHost, social/FriendsRow
- french: shell/LanguageHint, profile/LanguageSettings
- seasons:
  - src/lib/seasons.ts: types, functions returning null, SEASON_DISMISS_COOKIE
  - seasons/SeasonalBanner: renders today's <RamadanBanner/>
- drama-hubs: hubs/HubShelf
- digest: digest/DigestSettings, digest/ReleaseEmailSwitch
- social-pages: social/SocialPrivacySettings
- movie-night: movie-night/UpcomingNightCard, NightTile, PlanNightRow
- badges: badges/ProfileBadges, badges/BadgesSetting, support/SupporterSettings
- shared-lists: lists/ProfileLists, lists/AddToListSection
- tv-mode:
  - TvModeProvider (real: context {tv, inApp})
  - hooks/use-tv-mode: useTvMode = context?.tv ?? false, never throws; useLikelyTv returns false
  - TvShell (renders a fragment), TvModeOffer, TvModeSetting, TvSessionsSetting

Layout:
- kids, tv, inApp (user agent contains 'TunisiaFlicksTV/'), seasonal.
- <html data-tv> and <TvModeProvider>.
- When tv, TvShell replaces Rail, TopBar, TabBar, Footer, PeekLayer, SearchPaletteHost and ShareSheetHost. Keep RoomLight, Toaster, NextTopLoader and VerifyEmailBanner.
- Otherwise add ShareSheetHost after PeekLayer and TvModeOffer after VerifyEmailBanner.
- Pass kids/seasonal to Rail and TabBar, and kids/ask={false} to TopBar. Add these optional props to all three, ignored for now.
- LanguageHint goes next to Toaster.

Middleware:
- On '/', ?tv=1 sets the cookie (1 year, lax, not httpOnly, secure on https) and ?tv=0 deletes it, then redirect to '/' keeping other params.
- getToken only on auth paths.
- Matcher: ['/', '/dashboard', '/login', '/signup', '/profiles'].

Home:
- maxDuration 30.
- Slot 3 SeasonalBanner kids, slot 5 UpcomingNightCard, slot 7 FriendsRow, slot 12 HubShelf, each in Suspense fallback null.
- Kids skip 5, 7 and 12; TV mode skips 5, 7 and 9.

Settings:
- Section order and slots as in sharedFiles: a children prop on PushSettingsCard, ReleaseEmailSwitch inside Following, securityExtra on AccountSecurity.
- SettingsNav takes kids from getKidsMode(), gains a grownUp field, and adds entries privacy (Lock, grownUp), display (Languages) and supporter (HandHeart, grownUp).

G. DESIGN.md additions:
- A secondary or dismiss button on a link card is a sibling, never nested.
- Text floor white/50.
- Overlaps use `[&>*+*]:-ms-2`.
- Client files never value-import '@/src/lib/i18n'.
- Arabic: no verb after {name}. French: no participle agreeing with {name}.
- Popover for panels with actions; menus only for command lists.
- Chip modes.
- 'Your page' naming.

ACCEPTANCE
1. typecheck, lint, test:unit (tests/foundations.unit.test.mjs imports '@/src/lib/i18n/locales', with-timeout and scrub-url) and build all pass.
2. The site renders unchanged (RamadanBanner still shows).
3. /?tv=1 sets the cookie and gives data-tv='1'; /?tv=0 clears it.
4. POST /api/user-content with media_type '/evil' returns 400.
5. Google sign-in from /u/x?invite=abc lands on /profiles?next=%2Fu%2Fx%3Finvite%3Dabc.
6. A Sentry event from ?invite=abc has no 'abc'.
7. Report: the stubs and their owners.

## OWNER OVERRIDES (the product owner's explicit requirements; they take precedence over anything above)

Owner override support: add the stub `getSeasonSkin(kids: boolean, today?: string): { id: string, light: string, glow?: string } | null` (returns null) to src/lib/seasons.ts, and mount it in the root layout: `data-season={skin?.id}` on <html> and `style={{ '--season-light': skin?.light }}` when set. The seasons track implements it and owns src/components/shell/RoomLight.tsx in wave 1 (it reads --season-light as its default).
