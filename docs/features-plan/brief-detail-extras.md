TRACK detail-extras · WAVE 2 · effort XL
You own the movie and TV detail layout from now on, and add computed layers. No new hero buttons.
Section order: Watch, Episodes (TV), Ratings, More like this, Extras, Cast, Details.
SectionNav lists only sections known on the server.

COMMON RULES
- Workspace
  - Worktree: C:/Users/malek/AppData/Local/Temp/claude/C--Users-malek-OneDrive-Attachments-Documents-GitHub-tunisiaflicks/6a114b99-37cf-4f20-bc1e-b374d7220f50/scratchpad/tf-extras (branch feat/redesign), shared. Edit only your files.
  - Read MovieDetail, TvDetail, MediaHero, DetailSections and the pages fully. Keep resume/next-episode, trailer autoplay, the share fallback, the countdown and downloads.
- Git (shared index)
  - Stage only your paths; commit with `git commit -m 'msg' -- <paths>`.
  - Never a bare commit, add -A, stash or reset.
  - On index.lock, retry after 2–10s.
- Design: docs/DESIGN.md. Text at least white/50. Siblings, never nested buttons.
- Strings: features/detail-extras.ts (en, ar, tn, fr).
- French already added tmdb-locale and quote(); keep using them.
- Tooling
  - Run `npx tsc --noEmit --incremental false`. Don't touch :3300.
  - Mongo 5.9: findOneAndUpdate returns {value}.
- Free tiers only.

USE
- From social: RatingsBand, openShare, ShareMedia, ratingSummary.
- From drama-hubs: YouTubeDialog (external prop), VideoTile, youtube.ts, Chip and ChipGroup (mode tabs), arab-countries.
- Also: regionName, languageName, useTvMode, Popover, SectionHeader end, withTimeout.

FILES: see ownership 'detail-extras'. StreamSection belongs to tv-mode; pass it the same props.

1. HERO
- Buttons stay as they are.
- Share → openShare({kind:'title', media}); hidden in TV mode.
- Trailer → YouTubeDialog over the trailers group, with external={!kids}.
- pickTrailer(videos, prefer): ar for ar/tn, fr, en. The default stays compatible.
- Videos fetched with include_video_language 'en,ar,fr,null'.

2. RATINGS (#ratings)
- `<RatingsBand id='ratings' media/>` after Watch (movies) or Episodes (TV).
- Server side: signedIn, plus `await ratingSummary()` (cached daily).
  - Guests with no average: no band and no SectionNav entry.
  - Label: t('social.ratings.title').

3. MORE LIKE THIS, BUT… (#similar)
- An h2 per variation:
  - 'More like this'
  - '…, but lighter' / '…, but shorter' / '…, but newer'
  - 'More like this, as a series' (on a film) / '…, as a film' (on a show)
  - 'More like this, from the Arab world'
- Hint lines:
  - lighter: 'The same kind of story, easier on the heart'
  - shorter: 'Under {minutes} minutes' (films) / 'Limited series you can finish in a weekend' (shows)
  - newer: 'Released since {year}'
  - arab: 'Films and series made in the Arab world'
- Chips: ChipGroup mode 'tabs' with manual activation.
  - Order: Closest, Lighter, Shorter, Newer, As a series/film, Arab world. In ar/tn, Arab world comes right after Closest.
  - Availability:
    - lighter: tone < 1.5
    - shorter: runtime ≥100, or ≥2 seasons, or episodes ≥45 min
    - newer: released ≥6 years ago
    - kind and arab: always
  - The section renders when Closest has items or ≥2 variations exist.
  - Prefetch on hover or focus with a fine pointer.
- Results
  - A Row keyed by variation, tween.base fade, skeletons after 150ms.
  - Empty: 'Nothing close enough' + 'Show the closest'. Error: 'Try again'.
- API: GET /api/more-like-this?type=&id=&but=&kids=0|1
  - The page passes the server-known kids value. The route compares it with getKidsMode(): a mismatch returns 409 {code:'profile_changed'} and the client calls router.refresh().
  - Kids merge kidsDiscoverParams and filterKidSafe.
  - 120 per 10 min. Cache-Control private, max-age=3600.
  - Discover attempts (≤3; include_adult false; sort vote_count.desc):
    - lighter: top 4 keywords + with_genres '35|10751|16', without_genres '27,53'
    - shorter: with_runtime.lte = clamp(round5(runtime·0.8), 75, 105), gte 60; TV with_type 2
    - newer: date.gte = max(year+5, now−8)
    - kind: mapped genres and keywords
    - arab: ARAB_TMDB_COUNTRIES joined with '|' + top 2 genres, then OR'd, then with_original_language ar
  - Rank by genre Jaccard, then vote_count.

4. EXTRAS (#extras)
- extrasFromVideos: YouTube only, deduped. Groups trailers, behind, clips, bloopers, recaps; ≤24 each.
- Videos row: VideoTiles (first-party thumbnails).
  - Group chips only when there are ≥2 groups.
  - Opens YouTubeDialog with external={!kids}.
- Soundtrack (Deezer, no key)
  - deezer.ts: search/album, album/{id}, tracks?limit=40. 6s timeout, fixed host.
  - Matching: score = 0.45·title (with a soundtrack marker, including موسيقى تصويرية) + 0.30·year (±1) + 0.25·composer (Various Artists counts 0.5).
    - Accept ≥0.75.
    - Reject when a different work also scores ≥0.75.
  - Cache: soundtracks {_id 'movie:27205', status, albumId, title, artist, cover, link, trackCount, reports, blocked, checkedAt, staleAt (found 60d; none 30d, or 3d when recent; error 1h), expiresAt}.
  - Never store preview URLs. GET /api/soundtrack?type&id&kids=0|1 (same mismatch rule, revalidate 3600, private).
  - Kids: tracks flagged explicit_lyrics removed; no outbound links.
  - UI
    - Cover with a peeking vinyl (slides on fine-pointer hover; aria-hidden; flips in RTL).
    - Album title, artist (links to the composer's person page), year, 'Tracks: {n}'.
    - 'Listen on' chips: Deezer, then Anghami, Spotify, YouTube Music. Anghami first for ar/tn. The last-used service moves first (localStorage).
    - Tracks: 8 rows on md+ and 3 on phones, with 'Show all tracks ({n})'.
      - One shared <audio>, a progress ring, stops on unmount.
      - Note: 'Previews play from Deezer'.
    - 'Wrong album?' → POST /report: one per IP per title; 3 distinct reports block the album.
  - A client sentinel 800px ahead fetches on a cache miss. The block then renders in place but NEVER adds a SectionNav entry.
  - Omit the section when both parts are empty.
- DetailsGrid
  - 'Music' fact.
  - When there's no match and a composer exists (not for Kids): a 'Find the soundtrack' Popover on desktop or Drawer on touch, with 4 search links.

5. CAST: 'Where have I seen them?'
- A header action via SectionHeader `end`: a ScanFace button.
- Signed in: GET /api/seen-with?people=<≤30>&exclude= (requireActiveProfile, 60 per 10 min, private no-store; combined_credits cached 7d).
- Guests: a Popover with Sign in.
- Results
  - The poster fan is a SIBLING button of the cast Link inside `<div class='group/cast'>`, never nested. 44px hit area. aria-label 'You've seen {name} in {count} titles'.
  - Subtitle: 'You've seen {count} of them before'.
  - Fine pointer: hover card after 380ms (300px, ≤4 rows, lock line). Touch: a Drawer.
- Kids can use it.

6. PERSON PAGE
- First row when signed in with matches: 'You've seen {name} in' (seenInCredits). Lock subtitle.
- Filmography marks watched titles (Eye).
- Guests: an invite panel after Known For.

7. Countries: Arab countries link to arabCountryHref with arabCountryName; others use regionName.

8. STREAM PROVIDERS FIX
- getProviderTemplates() is server-only in stream-providers.ts.
- Pages pass the templates as props. MovieDetail and TvDetail fill in {id}/{season}/{episode}.

9. SectionNav
- The order above.
- Entries only from server data: videos, the cached soundtrack, and Ratings when the band renders.

SHARED-FILE REQUESTS
- legal: Deezer paragraph.
- README: the soundtrack cache.

ACCEPTANCE
1. /movie/550 and /tv/1396 render sections in order. SectionNav matches. Share opens the ShareSheet.
2. API checks
   - more-like-this but=newer → 200, ≥4 items, without 550.
   - but=nope → 400.
   - A kids mismatch → 409.
   - seen-with without a session → 401.
   - soundtrack id=abc → 400.
   - Inception's match /Zimmer/.
3. Seed history 603, 245891, 1637: Keanu shows a 2-poster fan, and the fan is not nested in the link (axe check).
4. Kids
   - Switching profile changes more-like-this results.
   - No outbound music or YouTube links.
   - No explicit tracks.
   - The share sheet shows external links only.
5. STREAM_PROVIDERS on the server changes the sources.
6. RTL works. Reduced motion is opacity only. As a guest with no average, there is no Ratings entry.

## OWNER OVERRIDES (the product owner's explicit requirements; they take precedence over anything above)

Restore DARKER and OLDER in "More like this, but…" (the owner listed: lighter, darker, shorter or older).
- darker: '…, but darker' — 'The same kind of story, with more shadow'. Query: top 4 keywords + with_genres '53|80|9648|27' (thriller, crime, mystery, horror), without_genres '35,10751,16'; skip when the title itself is already dark (tone ≥ 2.5) — mirror of lighter. Kids: never offered.
- older: '…, but older' — 'Classics from before {year}'. Query: same top keywords/genres, release date ≤ (year − 15), sort vote_count.desc, vote_count ≥ 200; skip for titles released before 1990.
- Order: Closest, Lighter, Darker, Shorter, Older, Newer, As a series/film, Arab world (in ar/tn, Arab world right after Closest). Keep the 'renders when Closest has items or ≥2 variations exist' rule. Add smoke tests for but=darker and but=older.
