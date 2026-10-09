TRACK drama-hubs · WAVE 1 · effort L. You ship the Turkish and Korean drama hubs. You also own the world primitives that wave 2 consumes. Build the primitives first and commit them early with exact signatures.

COMMON RULES
- Workspace
  - Worktree: C:/Users/malek/AppData/Local/Temp/claude/C--Users-malek-OneDrive-Attachments-Documents-GitHub-tunisiaflicks/6a114b99-37cf-4f20-bc1e-b374d7220f50/scratchpad/tf-extras (branch feat/redesign), shared.
  - Edit only your own files.
- Git (shared index)
  - Stage only your own paths. Commit with `git commit -m 'msg' -- <paths>`.
  - Never a bare commit, add -A, stash or reset.
  - On index.lock, retry after 2–10s. Never delete it.
- Design (docs/DESIGN.md)
  - Logical RTL; 44px targets; text at least white/50.
  - No all-caps, '·', '→' or emoji.
  - A button on a link card is a sibling, not a child.
- Strings
  - Only in features/drama-hubs.ts: en+ar complete, tn, fr.
  - Arabic: no verb right after {name}; use PluralRules keys.
  - Client imports come from i18n/locales.
- Tooling
  - Typecheck with `npx tsc --noEmit --incremental false`. Leave the :3300 server alone.
  - next/og on Windows: use the plain-Node harness.
  - Tests: tests/drama-hubs.test.mjs (BASE_URL) and tests/drama-hubs.unit.test.mjs.
- Free tiers only.

FILES: see ownership 'drama-hubs'. Foundations created the HubShelf stub and mounted it on home in slot 12.

A. PRIMITIVES (signatures in the contracts)
1. Chip and ChipGroup (src/components/ui/chip.tsx)
- Chip
  - h-10, rounded-full, px-4, 13.5px medium. Background white/[0.06]; hover /[0.1] (hover-gated); active bg-white text-black.
  - 16px icon. Count in white/50 (black/55 when active).
  - With href it renders a Link, otherwise a button.
  - With onRemove it renders a <span> chip plus a sibling remove <button> (aria-label removeLabel), never nested: a 32px circle with a 44px hit area made by negative margin.
  - pressable, focus ring red-500, select-none.
- ChipGroup modes
  - single: radiogroup, roving tabindex.
  - multi: aria-pressed.
  - nav: a <nav aria-label> of links with aria-current='page'.
  - tabs: tablist/tab, aria-selected, aria-controls from Chip.controls; manual activation (arrows move focus, Enter/Space selects).
  - none: list.
  - scroll: a horizontal rail on phones (-mx-[var(--gutter)] px-[var(--gutter)]).
- controls.tsx re-exports Chip and ChipGroup. The old props must still work.
2. HubHeader
- Props add size 'display' | 'compact'.
- display: clamp(40px,6.5vw,92px). compact: clamp(36px,5.4vw,72px).
- RoomTint with the accent. animate-focus-in, then the subtitle at 60ms and the end slot at 120ms.
- Subtitle max-w-[56ch], 15px, white/60. Watermark at ~13%.
- The accent is used only for tint and glow.
3. HubTile
- rounded-tile, aspect-video; TmdbImage or <img>.
- Gradient from black/85. Title 20–28px. Line at 13px white/70.
- Badge at the top end. Accent ring on hover.
4. HubShelf (replaces the stub; null for Kids)
- 'Beyond Hollywood' row of 5 HubTiles:
  - Tunisian (231 0 19)
  - Tunisian TV (gradient + TunisiaMark; tunisian-tv wires it in wave 2)
  - Turkish (40 196 184)
  - Korean (104 124 255)
  - Arab cinema (200 162 122): daily pick from discover/movie with with_origin_country = ARAB_TMDB_COUNTRIES joined by '|'
- The Tunisian tile uses ONE request with the exact params of the `popular` call in src/lib/tunisian-cinema.ts, so it shares the data cache. Don't call getTunisianCinema.
- Wrap the data in withTimeout(…, 4000, null).
5. LiveDot: 8px red-500 with a glow, sr-only label, 2s pulse under motion-safe only.
6. youtube.ts
- isYouTubeId.
- youtubeThumb returns `/api/yt-thumb/${key}/${size}`.
- youtubeEmbedUrl (nocookie, rel=0, playsinline), youtubeLiveEmbedUrl, youtubeWatchUrl.
- Never use referrerPolicy no-referrer (error 153).
7. /api/yt-thumb/[id]/[size]
- Validate the id with isYouTubeId and size in mq|hq|maxres.
- Fetch https://i.ytimg.com/vi/{id}/{mqdefault|hqdefault|maxresdefault}.jpg (5s timeout) and stream it back.
- `Cache-Control: public, max-age=86400, s-maxage=604800`. 404 when invalid or missing.
- This keeps visitors' IPs away from Google until they press play.
8. YouTubeDialog
- Dialog max-w-5xl p-0. A 16:9 iframe (allow autoplay; encrypted-media; picture-in-picture; fullscreen).
- Bar: title and subtitle; counter (aria-hidden, plus an sr-only 'Video n of total'); prev/next as 44px glass buttons (RTL-aware); 'Watch on YouTube' link only when external !== false.
- When the body has focus, ←/→ switch videos (mirrored in RTL).
- Blocked: a fallback card (MonitorPlay, 'This video only plays on YouTube', button hidden when external is false).
9. VideoTile
- A button: aspect-video, rounded-tile.
- <img> with srcSet from youtubeThumb mq 320w / hq 480w, lazy, with dimensions.
- Duration chip at the bottom end; badge at the bottom start.
- Hover: a play circle and scale 1.04 over 500ms. Press: 0.98.
- Title 14.5px white/90, clamp 2, <bdi>. Meta row.
- Blocked: 'Only on YouTube'; opens the watch URL in a new tab.
10. arab-countries.ts: the 22 Arab League codes. arabCountryHref: tn → /tunisian/cinema. arabCountryName via Intl, with the ps override Palestine / فلسطين.

B. HUBS (/dramas, /dramas/turkish, /dramas/korean; force-dynamic, maxDuration 20)
- dramas-config.ts HUBS
  - turkish: tr / TR, 40 196 184, kafes, shortMaxEpisodes 13, votes {tv:10, favourites:40, movie:30}, favouritesMinRating 7.5
  - korean: ko / KR, 104 124 255, changsal, shortMaxEpisodes 12, votes {30, 200, 150}, favouritesMinRating 7.8
  - Keywords (resolved via search/keyword, cached 30d), with genre 10768 as the fallback:
    - romance: romance, love, romantic comedy, love triangle, forbidden love, first love, contract marriage
    - historical tr: ottoman empire, sultan, historical drama, period drama, seljuk empire
    - historical ko: joseon dynasty, goryeo dynasty, historical drama, period drama, sageuk
  - SHELF_IDS and helpers as before.
- dramas.ts
  - Base params: with_original_language, with_origin_country, with_type '2|4', without_genres '16,99,10762,10763,10764,10767', include_adult false, tmdbLanguage.
  - Shelves:
    - new-episodes: air-date window today−2..+4, then tv/{id} (6h)
    - trending: trending/tv/week pages 1–5, filtered, topped up from discover
    - favourites
    - romance and historical (vote_average ≥6.5)
    - thrillers: '80|9648'
    - short: weekly episode-count cache
    - films
  - Daily rotation seeded with `${tunisDate()}:${hub}:${shelf}`. getShelf is cache()d to de-duplicate.
  - Hangul-only titles fall back to en-US.
  - featuredSeries: daily pick, not yesterday's. Logo order en → textless → tr, never Korean script. pickTrailer. Reason order.
- dramas-for-you.ts (signed-in, non-Kids): resume from history (/tv/{id}?s=&e=), and 'Because you watched {title}'.
- /dramas page: PageHeader 'Turkish and Korean dramas', two HubTile doors ('{n} series with new episodes', hidden at 0), and a 'New episodes this week' row.
- /dramas/[hub] (unknown hubs → notFound)
  - With 'All' selected, the order is:
    1. HubHeader size compact, with the lattice watermark and SegmentedLinks in the end slot.
    2. HubScreen frame (rounded-stage, h-[clamp(440px,42vw,640px)]).
       - Ken Burns backdrop.
       - Muted trailer after 2.5s via YouTubeBackdrop, only if useCanAutoplay. Visible pause and sound controls; pauses when under 35% visible.
       - Buttons: Play (red), More info, My list. Trailer → YouTubeDialog when autoplay is off.
       - Phones: a 16:10 band.
    3. The ChipGroup mode 'nav' filter row: All, Love stories, Ottoman/Joseon history, Crime and mystery, Short series, Films. Links to `?shelf=`.
    4. Rows: New episodes (AirBadge), Top 10 (outlined numerals; 'By popularity on TMDB, worldwide'), For you, favourites, romance, historical, thrillers, short (EpisodesBadge), films. Each row needs at least 3 / 5 / 6 items.
    5. Cross-link tile.
  - With a shelf selected: HubHeader display, then chips, then a GRID_CLASS grid of up to 60 titles.
- Kids: KidsBlocked. Both data sources empty: EmptyState (CloudOff) with action 'Try again'.
- OG via renderSectionCard (revalidate 21600). JSON-LD CollectionPage.
- Copy never mentions dubbing or subtitles.

STRINGS: dramas.nav ('Turkish & K-dramas', 20 chars or fewer), shelf, index, turkish, korean, why, episodes plurals, row, badge, forYou, filter, error; live.label.

SHARED-FILE REQUESTS
- nav WORLD: Dramas (grownUp).
- Footer: Explore entry.
- sitemap.
- share-sections: dramas-turkish, dramas-korean.
- README.

ACCEPTANCE
1. Primitives exist with exact props; library Chip still works on /history and /lists. The removable Chip has no nested interactive element (axe check).
2. HTTP
   - /dramas, /dramas/turkish, /dramas/korean and ?shelf=romance return 200.
   - /dramas/japanese returns 404.
   - A tn cookie gives RTL.
   - /api/yt-thumb/dQw4w9WgXcQ/mq returns 200 image/jpeg; a bad id returns 404.
3. check-drama-keywords prints keyword ids, counts and the featured pick.
4. The trailer pauses off-screen and never autoplays on touch.
5. At 1366×768 the Play button sits above the fold.
6. A grep finds no dubbing words.