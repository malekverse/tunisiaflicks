TRACK tv-mode · WAVE 2 · effort XL

TV mode is a mode on the SAME URLs, switched by the cookie tf-tv=1. Foundations already mounted these stubs (keep their signatures):
- TvModeProvider (real) and use-tv-mode (useTvMode never throws)
- TvShell, which the layout swaps in when tf-tv is set
- TvModeOffer, TvModeSetting (inside #display) and TvSessionsSetting (inside #security)
- the middleware handling /?tv=1|0

You ship:
- TvShell with TV_NAV and a focus engine
- /app
- a hardened Android TV WebView APK on GitHub Releases
- a remote-friendly StreamSection
- secure phone-to-TV sign-in at /activate

COMMON RULES
- Workspace: C:/Users/malek/AppData/Local/Temp/claude/C--Users-malek-OneDrive-Attachments-Documents-GitHub-tunisiaflicks/6a114b99-37cf-4f20-bc1e-b374d7220f50/scratchpad/tf-extras (branch feat/redesign), shared with other agents. Edit only your files.
- Git (shared index)
  - Stage only your paths; commit with `git commit -m 'msg' -- <paths>`.
  - Never a bare commit, add -A, stash or reset.
  - On index.lock, retry after 2–10s.
- Design: follow docs/DESIGN.md. Text at least white/50.
- Strings: features/tv-mode.ts (en+ar, tn, fr).
- Code checks
  - `npx tsc --noEmit --incremental false`. Don't touch the :3300 server.
  - Mongo 5.9: findOneAndUpdate returns {value}; claims use modifiedCount.
  - Tests: tests/tv-mode.test.mjs (BASE_URL), tests/tv-mode.unit.test.mjs (normalizeKey, beam scoring).
- Free tiers only; uqr is installed.

FILES: see ownership 'tv-mode'.

1. MODE
- Cookie tf-tv: 1 year, lax, not httpOnly.
- Entry points: /?tv=1, TvModeSetting, TvModeOffer, the menu row.
- Exit points: the TV Settings 'Exit TV mode' button, /?tv=0, POST /api/tv-mode {on} (JSON only). Exit is hidden in the app.
- useLikelyTv: starts false; in an effect, true when any of these holds:
  - inApp
  - the UA matches /Android ?TV|GoogleTV|BRAVIA|AFT[A-Z]|SMART-?TV|Tizen|Web0S|HbbTV|MiTV|Mi ?Box|TV ?Box|Amlogic/i
  - (any-pointer: none) and no touch points and landscape and width ≥900
- Extend src/lib/tv-mode.ts with androidApkUrl().

2. TvShell
- TvNav: a glass-strong bar inside the safe area.
- TV_NAV uses the NavItem shape and visibleItems from nav.tsx:
  - Home, Search, Movies (/discover), TV Shows (/tv)
  - Tunisian (kidsHref /tunisian/cinema)
  - Tunisian TV (/tunisian/tv, label tunisianTv.nav, grownUp)
  - Dramas (grownUp)
  - Library (/saved)
  - Settings (/profile#display)
- The active item is activeHref (longest match), shown as a red indicator. The focused item gets a white pill.
- Padding --tv-safe-x 5vw and --tv-safe-y 5vh.
- tv.css (imported by TvShell)
  - .tv-focus: 3px white ring with a black gap, scale 1.04 and a glow; transform and opacity only, ~140ms.
  - `html[data-tv] [data-tv-hide]{display:none}`.
  - CardAction always visible.
  - Do NOT use CSS zoom. Size for 10ft through html[data-tv] overrides of the shell tokens and font sizes.
  - `html[data-tv] .glass, html[data-tv] .glass-strong {backdrop-filter:none; background: rgb(18 18 18 / .94)}`.
  - A min-height 100vh fallback for dvh.
- Not in TV mode: clips, swipe, friends, nights planning, the map, AI and the ShareSheet.
- TvAnnouncer with Sonner sizing.
- First-visit coach card: 'Made for your remote' with [Got it].

3. FOCUS ENGINE
- Focusables: a[href], button, input, select, [tabindex='0'], [data-tv-focusable]; visible and enabled.
- normalizeKey:
  - arrows; OK 13/23
  - Back 4/8 (when not typing)/27/461/10009/BrowserBack
  - media 179/415/19/412/417; menu 82/93; channel 427/428/PageUp/PageDown
- Inputs keep Left and Right.
- Beam search: score = primary + 0.3·orthogonal inside the beam, + 2·orthogonal outside it. Prefer the [role=list] siblings within a Row.
- Scrolling:
  - Rows: scrollBy, RTL-safe.
  - Page: `scroll-margin-top: 34vh` plus scrollIntoView({block:'start'}). No manual offset maths.
  - Repeats throttled to 110ms with instant scrolling.
- Real DOM focus.
- Back: closes layers with Escape, otherwise history.back(). On home, Back scrolls to the top first.
- A pointer focuses without scrolling.
- Reduced motion: no scale.
- Restore focus per URL.

4. StreamSection: keep the props.
- In TV mode, a briefing card appears before the player starts:
  - 'Ready on {source}'
  - tips with KeyGlyph
  - [Start watching] (red, autofocus) and [Other sources]
- Start: requestFullscreen, wakeLock, a history guard, then focus the iframe.
- Back while playing opens a menu bar: Back to the video, Next episode, Sources, 'Not working? Try the next source', Leave the player. A second Back leaves.
- From the 4th visit, the card becomes a 2.5s hint.
- After 12s without load: '{source} is slow to answer'.

5. TvModeOffer
- Bottom-end card on likely-TV devices, not in TV mode, deferred while VerifyEmailBanner shows, not shown again for 30 days after dismissal (localStorage).
- [Switch to TV mode] (autofocus) and [Not now].

6. TvModeSetting
- SwitchRow 'TV mode' ('On this device').
- In TV mode: a large [Exit TV mode] button, hidden in the app.
- Link to 'Get the app'.

7. /app (public)
- Panels:
  - Android TV APK: only when androidApkUrl() is set; sideload steps; show the APK SHA-256 and the signing certificate fingerprint.
  - PWA install (beforeinstallprompt, plus iOS steps).
  - TV mode button.
- QR code via uqr.

8. ANDROID (android-tv/, Kotlin, one Activity with a WebView)
- JS, DOM storage, media without a gesture, third-party cookies.
- UA suffix ' TunisiaFlicksTV/1.0'. Start URL https://tunisiaflicks.vercel.app/?tv=1.
- Hardening:
  - top-level navigations allowed only when the host EXACTLY equals BuildConfig.SITE_HOST; everything else is cancelled
  - setSupportMultipleWindows(false); window.open blocked
  - allowFileAccess and allowContentAccess false
  - mixedContentMode MIXED_CONTENT_NEVER_ALLOW
  - safeBrowsingEnabled true
  - no addJavascriptInterface
  - onPermissionRequest → deny; onGeolocationPermissionsShowPrompt → deny
  - onReceivedSslError → handler.cancel()
  - no file chooser
- If WebViewCompat.getCurrentWebViewPackage() is below version 100, show an 'Update Android System WebView' screen.
- Back: webView.goBack(), else finish().
- Fullscreen via onShowCustomView.
- LEANBACK_LAUNCHER plus LAUNCHER. Banner 320×180 made from public/A.svg.
- android-tv.yml: runs only on push of a tag 'tv-v*' (never pull_request_target). Builds a signed APK from repo secrets and attaches tunisiaflicks-tv.apk and its sha256 to the Release.
- docs/TV.md: keystore backup, releasing, sideloading, blank-WebView fix.

9. PAIRING (src/lib/tv-pairing.ts, tv-sessions.ts)
- tvPairings document
  - {_id: deviceCode (32 bytes base64url), userCode (6 chars, swipe alphabet, unique), status 'pending'|'approved'|'denied'|'used', deviceLabel (from a fixed set by UA family, never the raw UA or IP), locale, lookups, createdAt, expiresAt (+10 min, TTL), userId?, profileId?}
- Endpoints
  - POST /api/tv/pair: 10 per 10 min per IP.
  - GET /api/tv/pair?device=: status.
  - GET /api/tv/pair/lookup?code=
    - Needs a grown-up session that is not limited.
    - Rate limit 10 per 10 min per user and 20 per 10 min per IP.
    - Increments lookups; at 5 the code is burned (denied).
    - Returns {deviceLabel, requestedMinutesAgo}.
  - POST /api/tv/pair/approve {code, approve, profileId}
    - Same guards, plus session.loginAt within 10 minutes, otherwise 403 {code:'reauth'}.
    - The profile must belong to the account (Kids allowed).
    - Atomic pending→approved.
- auth.ts
  - 'tv-pair' CredentialsProvider
    - authorize() atomically moves approved→used.
    - Creates tvSessions {_id: random id, userId, profileId, deviceLabel, createdAt, lastSeenAt, revokedAt:null}.
    - Returns {id, name, scope:'tv', pairingId, pinnedProfileId}.
  - jwt callback
    - For scope tv: set token.scope, pairingId and pinnedProfileId, and do NOT set loginAt. Other providers keep loginAt.
    - Every 5 minutes (token.checkedAt), re-check tvSessions. If revoked or missing, return {revoked:true} with no id; otherwise update lastSeenAt (throttled).
  - session callback: when revoked, omit user (callers treat that as signed out); expose scope and pinnedProfileId.
- profiles.ts canSwitchFreely: false for scope tv when the pinned profile is Kids.
- POST /api/tv/pair/complete: requires a tv-scoped session; sets PROFILE_COOKIE (profileCookieOptions) to the pinnedProfileId on the server. The TV never picks its own profile.
- /api/tv/sessions
  - GET lists the account's TVs.
  - DELETE ?id= revokes one. Not available to limited sessions.
- TvSessionsSetting: 'TVs signed in' with label, created date, last seen and [Sign out].
- Lifecycle helpers: deleteTvSessions(userId), revokeTvSessionsForProfile(userId, profileId).
- TV sign-in screen (TV mode, signed out)
  - 'Sign in with your phone'; the code at 6rem, split 3+3, dir=ltr.
  - QR code of https://<host>/activate?code=…; countdown; 'Get a new code'; 'Sign in with email instead'.
  - Once approved: signIn('tv-pair', {deviceCode, redirect:false}), then POST /complete, then reload.
- /activate (phone)
  - ?code only prefills; it never counts as consent.
  - Step 1 shows the code large with 'Is this the code on your TV right now?', the device label and 'requested {n} minutes ago'. Buttons: [Yes, that's my TV] / [This isn't my TV].
  - Step 2: profile chips, then [Sign in on the TV] (red).
  - A stale login sends the user to re-auth first: password, or Google with prompt=login, returning via callbackUrl.
  - Warning: 'Only use a code that is on your own TV right now.'
  - Signed out → login. Kids → blocked. No-referrer.

SHARED-FILE REQUESTS
- Footer 'Get the app'.
- robots: disallow /activate.
- legal: pairing and signed-in TVs.
- account.ts and profiles/[id]: tv sessions.
- README.
- sitemap /app.
- sw.js v4 (integration).

ACCEPTANCE
1. /?tv=1 sets the cookie and shows TvShell. /app returns 200. POST /api/tv-mode works.
2. Pairing
   - Creating a code returns a 43-char deviceCode and a 6-char userCode.
   - lookup and approve return 401 without a session; the 11th create returns 429; a code burns after 5 lookups.
   - A paired TV can't change the e-mail, password, profiles or handle (403 tv_session).
   - A TV pinned to Kids can't switch to a grown-up profile without the password.
   - Revoking in #security signs the TV out within 5 minutes.
3. Keyboard-only use reaches every focusable on home, detail, search and settings, on a 1080p box and in desktop Chrome.
4. Back closes layers, then goes back. The StreamSection briefing and Back menu work.
5. APK
   - Builds from a tag; launches from the TV launcher in TV mode; Exit is hidden.
   - Off-host navigation is blocked.
   - Below WebView 100, the update screen shows.
6. Non-TV visitors see no change.
7. Reduced motion: no scale.

## OWNER OVERRIDES (the product owner's explicit requirements; they take precedence over anything above)

Restore the GOOGLE PLAY APP prep for PHONES (the owner asked: "wrap the PWA as a Play Store app (Trusted Web Activity), no separate codebase"). The TV-box APK stays as planned (TV boxes often lack Chrome); the TWA targets phones, where Chrome is present.
- `/.well-known/assetlinks.json` route (app/.well-known/assetlinks.json/route.ts): built from env `ANDROID_TWA_PACKAGE` and `ANDROID_TWA_SHA256` (comma-separated fingerprints); 404 when unset. Cache 1h.
- `android/twa/twa-manifest.json` for Bubblewrap (packageId from the same name, host tunisiaflicks.vercel.app, start url '/', theme/background #000000, icon from /icons, maskable icon, splash, shortcuts Search / Tunisian / Library, fallback to Custom Tabs, display standalone, orientation default, enableNotifications true).
- Manifest quality check in src/app/manifest.ts (maskable icons, id, scope, shortcuts, screenshots if available): request changes from integration if the file isn't yours.
- docs/play-store.md: step-by-step for the owner (Bubblewrap init/build, keystore safety, Play Console one-time fee, Data safety form answers, content rating, privacy policy URL /privacy, testing track), and how to get the SHA-256 for ANDROID_TWA_SHA256 (Play App Signing).
- /app page: 'Get it on Google Play' when NEXT_PUBLIC_PLAY_STORE_URL is set (official badge text, no image hotlinking), alongside the TV APK panel.


## OWNER UPDATE (latest; overrides everything above, including the earlier OWNER OVERRIDES)

The owner has DEFERRED the app packaging:
- The Google Play app (Trusted Web Activity: assetlinks.json route, android/twa/twa-manifest.json, docs/play-store.md, the 'Get it on Google Play' panel) — SKIPPED for now.
- The Android TV APK (the WebView app on GitHub Releases, android-tv.yml, signing secrets, the APK panel and checksums on /app) — SKIPPED for now.
- Chromecast / AirPlay — not in scope.
Do NOT build any more of these, and do NOT spend review time on them. Do NOT delete what already exists either: the lead moves those parts to a separate branch after this wave. Everything else in TV mode stays and is the priority: TvShell + focus engine on the same URLs, the remote-friendly home/detail/search/player, TV mode in any TV browser (?tv=1, the offer, the setting), and /activate (approving a TV from the phone, scoped revocable sessions). /app should still work without the app panels (TV mode in a browser + installing the site as a PWA).
