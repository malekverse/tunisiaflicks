# TunisiaFlicks extras: integrated build plan (final pass)

Worktree `tf-extras` (branch `feat/redesign`). Where a spec and the IA disagree, the IA wins. Track briefs carry the full specs; this page carries decisions, waves and contracts.

## Review changes (final pass)
**Accepted, including all high-severity issues:**
- **New wave 0 `foundations` (one agent, before wave 1).**
  - Test toolchain: a Node 22 loader, globbed scripts, CI on Node 22 and port :3000.
  - Dependency-free i18n helpers in `i18n/locales.ts` and `translate.ts`, plus `richT`.
  - Missing primitives: Popover, the EmptyState `action` slot, the SectionHeader `end` slot, SignInInvite props, withTimeout.
  - Security prerequisites: user-content validation, re-auth for e-mail changes, a limited-session guard, Sentry URL scrubbing, Referrer-Policy, and a profile gate that keeps `?invite=`.
  - Every stub and mount point (layout, middleware `?tv`, home slots, Settings sections) is wired from day one, so tracks can verify their own work in their own wave. All stubs move from social to foundations.
- **Git:** all agents share one index. Stage only your own paths and always commit with a pathspec. tsc runs with `--incremental false`.
- **TV pairing:**
  - The session is scoped `tv`, pinned to the approved profile and revocable (`tvSessions`, plus 'TVs signed in' under #security). It never counts as a fresh login.
  - Account mutations refuse it.
  - /activate asks you to confirm the code, re-authenticates stale phones, is rate-limited, and burns a code after 5 lookups.
  - The WebView is hardened. CSS `zoom` is dropped so old WebViews behave.
- **Social safety:**
  - Anything shown to another person comes from TMDB (`resolveShareMedia`), never from client text.
  - A block covers the whole account. A declined request leaves a 90-day tombstone.
  - Rate limits are per account, and acting socially needs a verified e-mail.
  - Reserved words also apply as substrings, and an old handle stays held for 90 days.
- **'Anyone with the link' is now a real link:** a per-profile `shareKey` (`/u/handle?k=`).
  - Activity offers only Only me / Friends, and shows the day, not the time.
  - Unpausing or opening up ratings never exposes the past (`activitySince`, `ratingsVisibleSince`).
  - The public average uses only verified accounts, one vote per account, ratings at least 24h old, no Kids, and at least 20 accounts. It is rounded and refreshed daily.
- **Lists:** each list's visibility is Only me / Friends / Anyone with the link. The profile-level `lists` setting is dropped. OG cards never show posters of non-public things. Non-members see only the owner's name.
- **Invites:** `maxUses`, a use count, 'Turn off link', the owner is told when someone joins, and block checks. A night link join waits for the host's approval when a place or note is set. `.ics` requires membership.
- **Notifications:**
  - `event_key = kind:profileId:key`, which fits the existing unique index.
  - Merges stay within one profile and apply only to note-less sends.
  - Kids see kidSafe release items and kidsVisible badges.
  - Push follows the profile and skips Kids profiles for adult titles.
- **Deletion:** an ordered pipeline (hand over shared lists and cancel hosted nights first). Exports carry no other people's ids.
- **Cron:** calls from cron-job.org get a 22s deadline (it cuts requests at 30s). cron.yml quoting and input injection are fixed, with one secret per scheduler.
- **Mail and secrets:**
  - One shared daily mail counter keeps 70 sends for account mail.
  - Unsubscribe never rate-limits a valid token.
  - `EMAIL_TOKEN_SECRET` and `SUPPORT_HASH_SECRET` are independent of NEXTAUTH_SECRET.
- **Ask:**
  - The palette puts Ask first only when `looksLikeAsk`.
  - A hard daily model budget fails closed. Guest limits go per IPv6 /64 plus a first-party cookie id.
  - Ask appears only when enabled, for grown-ups, outside TV mode.
  - `mood.new` loses its sparkle icon.
- **UX:**
  - The desktop inbox is a Popover with role dialog.
  - The invite token survives Google sign-in, the profile picker, a Kids profile and handle setup.
  - SeasonalBanner dismissal is a cookie, so there is no flash.
  - Chip gets nav and tabs modes, with remove as a sibling button.
  - One 'Share…' item, and never two sheets stacked.
  - Inline actions are 44px with Undo. Red marks unread only.
  - Kids get nav alternatives: Tunisian goes to /tunisian/cinema, and Swipe replaces Movie night.
  - The e-mail settings fold into #notifications. The social surface is 'Your page'.
  - Also: logical AvatarStack overlap, a white/50 text floor, arab-map country codes on phones with preview-only scrubbing, a debounced feed light, HubDoors stacked below xl, and a compact drama hub header.
- **Feasibility:**
  - Friends activity is capped at 50 friends and cached for 5 minutes. Home gets maxDuration 30, and each new child times out at 4s.
  - Kids get their own cache keys (more-like-this, soundtrack, arab-map).
  - Tunisian TV retention is bounded, and a series is shown as 'complete' only with an API key.
  - A note on the Mongo 5.9 driver, an idempotent swipe match hook, sw.js bumped to v4 after wave 2, and the seasons table fixed.

**Partly accepted or rejected:**
- Renaming 'link' to 'Anyone with your handle': superseded by the real share link, so the original label is now true.
- Folding 'Titles you follow' into Notifications: e-mail folds in, but #following stays its own section because it is a long list. It gains the release-email switch.
- Per-profile photo upload: deferred. Only the owner profile (`profiles[0]`) may use the account photo.
- 'Ask me before people join' for lists: deferred. The owner is notified on every join and can turn the link off.
- Groq `max_completion_tokens` 350: set to 500, because reasoning tokens count toward it.

## 0. Shape of the build
- **Wave 0:** foundations (1 agent).
- **Wave 1:** french, social, seasons, drama-hubs, digest (5 agents).
- **Wave 2:** social-pages, ai-search, movie-night, shared-lists, badges, arab-map, tunisian-tv, tv-mode, detail-extras (9 agents).
- **Integration** is the lead's work between waves: nav entries, footer, sitemap, legal, account deletion, cron jobs, digest providers, README.
- **Stub-then-own:**
  - Foundations creates every cross-track file with its final signature and a trivial body, then mounts it.
  - The owner replaces the body and never changes the signature.
  - Stubs: ShareSheetHost, FriendsRow, LanguageHint, LanguageSettings, `seasons.ts`, SeasonalBanner, HubShelf, DigestSettings, ReleaseEmailSwitch, SocialPrivacySettings, UpcomingNightCard, NightTile, PlanNightRow, ProfileBadges, BadgesSetting, SupporterSettings, ProfileLists, AddToListSection, TvModeProvider (real), use-tv-mode, TvShell, TvModeOffer, TvModeSetting, TvSessionsSetting.
- **One owner per file per wave.** Files that change owner:

| File | W0 | W1 | W2 |
|---|---|---|---|
| layout, page, middleware, profile/page, SettingsNav | foundations | integration (between waves) | integration |
| Rail, TabBar, TopBar | foundations (props) | social | integration |
| MediaActions | – | social | shared-lists |
| PeekLayer | – | social | – |
| MediaHero, DetailSections, movie/tv/person pages | – | french | detail-extras |
| ChipRail | – | french | ai-search |
| HubShelf | foundations stub | drama-hubs | tunisian-tv |
| og.tsx | – | social | movie-night |
| offline.html | – | french | tv-mode |
| sw.js | – | french | integration (bump to v4) |
| src/lib/social/**, components/social, inbox, share, api/social | types.ts by foundations | social | social-pages (signatures frozen) |
| user-content route | foundations (validation) | – | badges (hooks) |
| src/lib/tv-mode.ts | foundations | – | tv-mode |

### Lead steps
1. **Before wave 0.** Tag `pre-extras`, confirm the :3300 dev server and keep a restart command. Agents report a dead server; they never restart it.
2. **After each wave.** Run typecheck, lint, test:unit, build and smoke. Apply the reported shared-file requests and the integration list. Commit and tag `wave-0`, `wave-1` or `wave-2`.

## 1. IA decisions applied
- **Nav.** One registry drives four surfaces.
  - `NavItem` gains `match`, `grownUp`, `kidsHref` and `kidsAlt`. When several items match, the longest href wins.
  - Groups are BROWSE, WORLD (plus the seasonal slot) and YOURS, with Settings pinned.
  - Final YOURS: Friends, Movie night (Kids get Swipe instead), Library.
  - Final WORLD: Tunisian (Kids go to /tunisian/cinema), Dramas (grown-ups), Arab cinema.
  - The 'You' tab lights up when no tab matches the current page.
- **Seasonal slot.** Only moments with weight 90 or more: Ramadan (from 45 days before, inclusive), the two Eids, and 'Your year' (Dec 1 to Jan 15, signed-in only). The icon is a key that social renders.
- **Inbox = the bell.**
  - A Popover on desktop and a Drawer on phones. /notifications is the full list.
  - Rows with a pending action stay pinned until settled.
  - Filters: friends = friend_*, title_sent, friend_rated, list_*; nights = night_*; alerts = movie_released, new_episode, badge_earned.
- **Invitations.** Always the thing's own URL plus `?invite=TOKEN`.
  - Tokens are hashed, expire, have `maxUses` and can be revoked.
  - The token survives sign-in and the profile picker.
  - InviteBanner removes it from the URL only after you accept or decline.
- **TV mode is a mode, not routes.** Cookie `tf-tv=1`, a TvShell plus a focus engine, and a WebView APK on GitHub Releases.
- **Detail page.** No new hero buttons; Share opens the ShareSheet. Order: Watch, Episodes, Ratings, More like this, Extras, Cast, Details. SectionNav lists only sections known on the server.
- **Home.** 20 slots in IA order.
  - Kids skip slots 5, 7 and 12. TV mode skips 5, 7 and 9.
  - The only AI on home is the Ask chip. ChipRail skips the moment that SeasonalBanner already shows.
- **Settings.**
  - Order: account, profiles, privacy* ('Friends and privacy'), display, playback, notifications (On this device, then By email* with `id='email'`), following (plus the account-level release-email switch), library, supporter*, security (plus TVs signed in), data. `*` = grown-up only.
  - SettingsNav gets `kids` from the server.

## 2. Spec deltas (spec → integrated)
- **social:**
  - Per-profile identity. Handles live in a `handles` collection (uniqueness, 30-day redirect, 90-day hold).
  - No directory, no /inbox page, no mute, no reports.
  - Notes are 140 characters at most.
  - Privacy: activity is Only me or Friends; ratings and badges add Anyone with the link (the shareKey). 'Pause sharing'.
  - Invites come from the `invites` lib.
  - The settings anchor is #privacy.
  - ProfileSetupCard moves into social (wave 1), because InviteBanner and the ShareSheet need it.
- **movie-night:** no voting, no reveal, no guests without accounts, no /together. Planning has RSVP, candidates and 'Pick together' through a linked swipe room. Link joins become requests when a place or note is set.
- **shared-lists:**
  - `?invite=` with InviteBanner and the ShareSheet invite mode.
  - Visibility: private, friends or link.
  - No PeekLayer action and no submenu: the 'Add to a list…' menu item, the ShareSheet row and the save toast are the entry points.
- **ai-search:** POST /api/ai/search and the URL `/search?mode=ask&q=&p=`. A Titles | Ask switch. AiMark is lucide Sparkle. Cut: TopMatch and editable chips. Hidden for Kids and in TV mode.
- **badges:**
  - 4 metal tiers and weekly streaks. The shelf lives on /me and /u.
  - Ko-fi only; /support.
  - `watchActivity` stores day flags only, keeps them 13 months, and has an off switch.
- **digest:** per profile. One route per job via `src/lib/cron.ts`. The #email group sits inside #notifications.
- **detail-extras:** Deezer soundtrack, the 'but…' chips, 'Where have I seen them?', and the STREAM_PROVIDERS fix.
- **tunisian-tv:** hub and channel pages, the YouTubeDialog, an ingest cron, and first-party thumbnails. 'Complete' only when YOUTUBE_API_KEY is set.
- **drama-hubs:** `?shelf=` chips (ChipGroup `nav`) and HubShelf. Owns the world primitives and `/api/yt-thumb`.
- **arab-map:** TN goes to /tunisian/cinema. Kids get a dimmed map with filtered data. Phones get codes and preview-only scrubbing. No duplicate chip list.
- **seasons:** decorations cut. Kept: getSeasonalNav, getSeasonalBanner, SeasonalBanner (cookie dismissal), HubDoor, and the moment page echoes.
- **tv-mode:** TvShell and a focus engine on the same URLs, /app, /activate (scoped, revocable sessions), and a hardened WebView APK.
- **french:** P1a, P1b and P1c ship. P2 (SEO URLs) is deferred.

## 3. Tracks at a glance
| Track | Wave | Surfaces | Data | Cron |
|---|---|---|---|---|
| foundations | 0 | tooling, i18n split, primitives, security prerequisites, all stubs and mounts | none | none |
| french | 1 | fr language, LanguageSwitch, #display, LanguageHint, POST /api/locale | users.locale, pushSubscriptions.locale | none |
| social | 1 | shell, InboxBell, ShareSheet, RatingsBand, InviteBanner, ProfileSetupCard, FriendsRow, /api/social/*, /api/ratings, /api/notifications | socialProfiles, handles, friendships, blocks, invites, ratings; notifications and pushSubscriptions extended | none |
| seasons | 1 | seasonal slot, SeasonalBanner, HubDoor, moment echoes | dismissal cookie | none |
| drama-hubs | 1 | /dramas/*, HubShelf, primitives, /api/yt-thumb | caches | none |
| digest | 1 | #email group, release-email switch, /unsubscribe, cron lib, cron.yml | digestPrefs, digestEditions, digestDeliveries, cronRuns, users.emailPrefs | digest |
| social-pages | 2 | /friends, /friends/list, /u, /me, /notifications, #privacy | (social) | none |
| ai-search | 2 | Ask in /search, palette and ChipRail | aiSearchCache, aiState, aiStats | none |
| movie-night | 2 | /movie-night/*, NightTile, PlanNightRow, UpcomingNightCard | movieNights, swipeRooms.night | nights |
| shared-lists | 2 | /lists, AddToList | lists extended | none |
| badges | 2 | /me#badges, /support, #supporter, Ko-fi webhook | badges, watchActivity, titleFacts, supporters, supportEvents | badges |
| arab-map | 2 | /arab-cinema/* | caches | none |
| tunisian-tv | 2 | /tunisian doors, /tunisian/tv/*, /ramadan rows | ttvChannels, ttvSeries, ttvVideos | tunisian-tv |
| tv-mode | 2 | TvShell, /app, /activate, StreamSection TV, APK | tvPairings, tvSessions | none |
| detail-extras | 2 | detail sections, person seen-row | soundtracks | none |

## 4. Shared contracts
Full TypeScript is in `contracts`. Key modules:
- Social: `src/lib/social/{types,session,identity,media,friends,privacy,ratings,activity,account}.ts`, `src/lib/invites.ts`, `src/lib/notify.ts`, `src/store/share-sheet.ts`.
- Social components: `src/components/{social,share,inbox}/*`.
- Shell and seasons: `nav.tsx`, `src/lib/seasons.ts`, HubDoor.
- drama-hubs primitives: `ui/chip`, `hubs/*`, `ui/live-dot`, `media/{YouTubeDialog,VideoTile}`, `lib/youtube`, `lib/arab-countries`.
- Scheduling and mail: `src/lib/cron.ts`, `src/lib/digest/providers.ts`, `email.ts` `reserveMail`.
- i18n: `i18n/{locales,translate,rich,format}`, `tmdb-locale`.
- Foundations helpers: `ui/popover`, `with-timeout`, `session-scope`, `tv-mode`.
- URL contracts: `/movie-night/new?title=movie:550`, `/u/[handle]?invite=|k=`, `/lists/[slug]?invite=`, `/movie-night/[id]?invite=`, `/search?mode=ask&q=&p=`, `/?tv=1|0`, `/activate?code=`.

## 5. Cron and scheduling (free)
- Vercel's single cron stays on /api/cron/notify, using CRON_SECRET.
- cron-job.org is the primary scheduler for the other jobs. It sends the header `X-Cron-Source: cron-job` and gets a 22s deadline.
- GitHub Actions is the fallback. It sends `X-Cron-Source: github`, gets a 45s deadline, and loops while the response says `more`.
- Each external scheduler has its own entry in CRON_SECRETS_EXTRA.

| Route | cron-job.org (Africa/Tunis) | GitHub (UTC) |
|---|---|---|
| /api/cron/digest | every 10 min, Fri–Sun | `41 16 * * 5`, `41 20 * * 5`, `17 8 * * 6,0` |
| /api/cron/nights | every 15 min | `5 */3 * * *` |
| /api/cron/badges | daily 03:10 | `10 2 * * *` |
| /api/cron/tunisian-tv | every 30 min | `23 */3 * * *` |

Every cron route:
- answers a GET that carries a Bearer secret;
- sets maxDuration 60 and takes a lease;
- is idempotent and answers with JSON stats;
- returns 200 when it is busy or idle.

## 6. Cuts and deferrals
See `cuts`. In short:
- the seasonal skin;
- movie-night voting and guests without accounts;
- the TV route tree, the TWA and the Play Store listing;
- MusicBrainz;
- editable AI chips and TopMatch;
- the /badges page and the badges toast host;
- social directory, mute and report;
- French P2;
- Tunisian TV series pages;
- per-profile photos and 'Ask me before people join' (both v2).

## 7. Key risks
- **Shared git index:** pathspec commits plus lock retry.
- **Locale change in wave 1:** helpers live in `locales.ts` from wave 0, and there is no exhaustive Record<Locale>.
- **Family members on one account can act as each other's profile:** accepted per the IA. A block covers the whole account, and the account photo is limited to the owner profile.
- **Free quotas:**
  - Groq: a token and call budget that fails closed.
  - SMTP: 450/day shared, with 70 reserved for account mail.
  - GitHub Actions minutes: kept light.
  - Mongo M0 512MB: retention rules and capped arrays.
- **Old TV-box WebViews:** no CSS zoom, a glass fallback, and a minimum WebView version.
- **YouTube embeds blocked by channels:** an oEmbed check plus the 'Watch on YouTube' fallback.