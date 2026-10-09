# Owner overrides

The final review pass cut some things the owner explicitly asked for. These are restored; each affected brief ends with the same section.

## movie-night

Restore VOTING. The owner asked for: "propose three picks, friends vote, the winner gets a calendar invite".
- Candidates: the host proposes up to 3 picks (keep the ≤8 limit only if guests may suggest; simplest: host proposes 1–3, guests may suggest 1 each until voting opens, total ≤ 6).
- Voting: every member who is 'going' or 'invited' (and the host) casts ONE vote for one candidate, changeable until the vote closes. Store votes as `votes: { [profileKey]: candidateKey }` with atomic `$set` on `votes.<profileKey>`; show live counts and voter avatars per candidate (AvatarStack), poll like the rest of the page.
- Closing: at `vote_closes_at` (default 2 hours before `starts_at`, host-editable, never after starts_at) or when the host taps 'Close the vote'. Resolve lazily on read (GET) and in the 'nights' cron, idempotently with a `{_id, chosen: null}` guarded update (modifiedCount===1 runs the notify hook once). `chosen_by: 'vote'`.
- Tie-break: most votes; ties go to the candidate that reached its count first (earliest last-vote timestamp), then the host's own vote, then candidate order. State the rule in the UI ('Ties go to the first to get there').
- Reveal: when the result is known, the page shows a reveal moment (the three posters fanned, the winner lifts forward with spring.pop, the others dim), once per viewer (localStorage flag), reduced-motion fallback = static winner.
- Calendar: the .ics SUMMARY becomes 'Movie night: {title}' once chosen; SEQUENCE increments (version bump) so calendars update; everyone going gets a notification 'We're watching {title}' with Add to calendar.
- Keep 'Pick together' (linked Swipe room) as an alternative way to choose; a vote in progress and a swipe can't both choose: the first guarded write wins.
- Accountless guests stay cut (security review). Tests: unit tests for the tie-break and lazy close; smoke: vote endpoint auth.

## seasons

Restore a RESTRAINED SEASONAL SKIN (the owner asked for "Ramadan, Eid and New Year skins with matching home banners"). Keep the IA rule "no decorations in the navigation chrome", so the skin is ambient, not ornamental:
1. Season light: `getSeasonSkin(kids, today)` in src/lib/seasons.ts → `{ id, light: 'r g b', glow?: 'r g b' } | null` for Ramadan (from its first day, not the 45-day lead), both Eids, New Year's Eve/Day (Dec 31–Jan 1), and the national days. The root layout sets `data-season={id}` on <html> and `--season-light: r g b` (integration/foundations mount; request it). RoomLight (src/components/shell/RoomLight.tsx; this track owns it in wave 1) uses `--season-light` as its DEFAULT light when no page sets its own (pages with posters keep their picture light). Ramadan/Eid: lantern gold 245 190 80; New Year: champagne 255 210 120; national days: flag red 231 0 19 at low strength.
2. New Year banner: include new-year in SeasonalBanner on Dec 31 (countdown to midnight Africa/Tunis, 'Happy New Year' on Jan 1) even though its weight is 70.
3. Motifs live INSIDE the SeasonalBanner and the moment pages only: a thin line-art crescent and lantern (Ramadan/Eid), a few slow sparkles (New Year, CSS only, none with reduced motion). Small inline SVG, no images.
4. Kids: same skin (it is just light). Preview for testing: `SEASONS_TODAY` env (dev only) as planned.

## tv-mode

Restore the GOOGLE PLAY APP prep for PHONES (the owner asked: "wrap the PWA as a Play Store app (Trusted Web Activity), no separate codebase"). The TV-box APK stays as planned (TV boxes often lack Chrome); the TWA targets phones, where Chrome is present.
- `/.well-known/assetlinks.json` route (app/.well-known/assetlinks.json/route.ts): built from env `ANDROID_TWA_PACKAGE` and `ANDROID_TWA_SHA256` (comma-separated fingerprints); 404 when unset. Cache 1h.
- `android/twa/twa-manifest.json` for Bubblewrap (packageId from the same name, host tunisiaflicks.vercel.app, start url '/', theme/background #000000, icon from /icons, maskable icon, splash, shortcuts Search / Tunisian / Library, fallback to Custom Tabs, display standalone, orientation default, enableNotifications true).
- Manifest quality check in src/app/manifest.ts (maskable icons, id, scope, shortcuts, screenshots if available): request changes from integration if the file isn't yours.
- docs/play-store.md: step-by-step for the owner (Bubblewrap init/build, keystore safety, Play Console one-time fee, Data safety form answers, content rating, privacy policy URL /privacy, testing track), and how to get the SHA-256 for ANDROID_TWA_SHA256 (Play App Signing).
- /app page: 'Get it on Google Play' when NEXT_PUBLIC_PLAY_STORE_URL is set (official badge text, no image hotlinking), alongside the TV APK panel.

## detail-extras

Restore DARKER and OLDER in "More like this, but…" (the owner listed: lighter, darker, shorter or older).
- darker: '…, but darker' — 'The same kind of story, with more shadow'. Query: top 4 keywords + with_genres '53|80|9648|27' (thriller, crime, mystery, horror), without_genres '35,10751,16'; skip when the title itself is already dark (tone ≥ 2.5) — mirror of lighter. Kids: never offered.
- older: '…, but older' — 'Classics from before {year}'. Query: same top keywords/genres, release date ≤ (year − 15), sort vote_count.desc, vote_count ≥ 200; skip for titles released before 1990.
- Order: Closest, Lighter, Darker, Shorter, Older, Newer, As a series/film, Arab world (in ar/tn, Arab world right after Closest). Keep the 'renders when Closest has items or ≥2 variations exist' rule. Add smoke tests for but=darker and but=older.

## foundations

Owner override support: add the stub `getSeasonSkin(kids: boolean, today?: string): { id: string, light: string, glow?: string } | null` (returns null) to src/lib/seasons.ts, and mount it in the root layout: `data-season={skin?.id}` on <html> and `style={{ '--season-light': skin?.light }}` when set. The seasons track implements it and owns src/components/shell/RoomLight.tsx in wave 1 (it reads --season-light as its default).


## OWNER UPDATE (latest; overrides everything above, including the earlier OWNER OVERRIDES)

The owner has DEFERRED the app packaging:
- The Google Play app (Trusted Web Activity: assetlinks.json route, android/twa/twa-manifest.json, docs/play-store.md, the 'Get it on Google Play' panel) — SKIPPED for now.
- The Android TV APK (the WebView app on GitHub Releases, android-tv.yml, signing secrets, the APK panel and checksums on /app) — SKIPPED for now.
- Chromecast / AirPlay — not in scope.
Do NOT build any more of these, and do NOT spend review time on them. Do NOT delete what already exists either: the lead moves those parts to a separate branch after this wave. Everything else in TV mode stays and is the priority: TvShell + focus engine on the same URLs, the remote-friendly home/detail/search/player, TV mode in any TV browser (?tv=1, the offer, the setting), and /activate (approving a TV from the phone, scoped revocable sessions). /app should still work without the app panels (TV mode in a browser + installing the site as a PWA).
