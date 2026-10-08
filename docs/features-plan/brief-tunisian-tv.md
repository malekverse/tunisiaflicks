TRACK tunisian-tv · WAVE 2 · effort L

Full Tunisian series and shows from official YouTube channels.
- A secured cron ingests free RSS feeds and checks each video with oEmbed.
- Pages: /tunisian/tv and /tunisian/tv/[channel]. They show rows of VideoTiles that play in a YouTubeDialog with previous/next.
- Also: 3 HubDoors on /tunisian, Ramadan rows, and a LiveDot on the home HubShelf tile.
- No series pages, no progress tracking, no home rows.
- Kids: KidsBlocked with what='tunisian'.

COMMON RULES
- Workspace
  - Worktree: C:/Users/malek/AppData/Local/Temp/claude/C--Users-malek-OneDrive-Attachments-Documents-GitHub-tunisiaflicks/6a114b99-37cf-4f20-bc1e-b374d7220f50/scratchpad/tf-extras (branch feat/redesign), shared.
  - Edit only your own files.
- Git (shared index)
  - Stage only your paths; commit with `git commit -m 'msg' -- <paths>`.
  - Never a bare commit, add -A, stash or reset.
  - On an index.lock error, retry after 2–10s.
- Design: follow docs/DESIGN.md. Text at white/50 or brighter.
- Strings: features/tunisian-tv.ts (en+ar, tn, fr).
- Tooling
  - Run `npx tsc --noEmit --incremental false`.
  - Don't touch the :3300 server.
  - Mongo 5.9 returns {value}.
- Free tiers only.

USE
- YouTubeDialog, VideoTile, LiveDot
- youtube.ts: youtubeThumb is first-party (/api/yt-thumb); use it everywhere, never i.ytimg.com
- HubDoor, Chip
- runCron and withLease, cronDeadline
- ramadan.ts and hijri.ts
- dominantColor, withTimeout

FILES: see ownership 'tunisian-tv'.

CHANNELS (channels.ts; each verified live)
| slug | name | YouTube id | handle | kind | note |
|---|---|---|---|---|---|
| watania-1 | Watania 1 / الوطنية 1 | UCdvWVsmQBROkgcGzVep73oA | @WataniaReplay | tv | daily live |
| watania-2 | Watania 2 / الوطنية 2 | UCJW9gatYczI191TunQxMGbA | @Watania2Replay | tv | |
| elhiwar | Elhiwar Ettounsi / الحوار التونسي | UCXzmMkXaHxMVlutDBD8goHA | @EttounsiaReplay | tv | |
| attessia | Attessia / التاسعة | UCQS3ejF2jBAhwmbGD9Q3oeA | @attessiatvofficial | tv | |
| nessma | Nessma / نسمة | UC-48PCT3flS86JkLzxlTA9g | @nessmatv | tv | UULF |
| hannibal | Hannibal TV / حنبعل | UCMowjs_MJ-oIWEeHUu3DrOQ | @hannibaltvofficielle | tv | |
| carthage-plus | Carthage+ / قرطاج+ | UCivxHCcy2MQwPBGQyPYcPcg | @carthageplus4007 | tv | dormant |
| mosaique-fm | Mosaique FM | UC6y8T-vG9SeQ-FKOCt_o8MA | @mosaiquefm | radio | |
| diwan-fm | Diwan FM | UCWbA7UIK1pKf2aFvoDyi61w | @radiodiwan | radio | |
| jawhara-fm | Jawhara FM | UCXowBzuwUrjfRt68d5VphAg | @JawharaFM | radio | |
- Reserved slugs: series, live.
- Env: TUNISIAN_TV_CHANNELS, TUNISIAN_TV_CHANNELS_OFF.

DATA (prefix ttv, lazy indexes)
- ttvChannels
  - Fields: slug, name, nameAr, handle, kind, avatar, color, status, disabled?, lastUploadAt, weekCount, feedOkAt, feedFailures, live, updatedAt.
  - Status: active < 30 days; quiet 30–180 days; dormant > 180 days; unreachable after 6 failures and 72h.
  - Outage guard: when 80% or more of feeds fail, keep the current statuses.
- ttvSeries
  - Fields: source, key, title, titleAlt, kind, seasons, episodeCount, firstAt, lastAt, coverId, coverMaxres, color, ramadan, cadence, description, playable, hidden, complete.
  - complete is true only when the full playlist was read through the API.
- ttvVideos
  - Fields: channelId, seriesId, playlistIds, title, description (≤300 chars, drama only), publishedAt, views, duration, episode, part, season, subtitle, live, status, checkedAt, recheckAt.
  - No Shorts.
- Retention
  - gone videos: 30 days
  - videos without a series: 45 days
  - videos of hidden series (clips, or playable < 0.2): 30 days
  - 'show' series: keep the latest 60 videos
  - Log the collection sizes in the cron stats.

INGEST GET /api/cron/tunisian-tv (runCron; deadline from cronDeadline: 22s for cron-job.org)
- scope feeds | full.
- A. Feeds
  - UULF and UULV feeds, for channels last read more than 25 minutes ago, 5 at a time.
  - Collect PL ids from video descriptions; accept one only when the feed's channelId matches the channel.
- B. Playlists
  - RSS returns at most 15 entries, so:
    - With YOUTUBE_API_KEY: playlists.list, playlistItems.list (≤4 pages), videos.list (duration, embeddable, live), channels.list. Soft cap 3,000 units/day in ttvMeta. Never search.list. Series built this way can be marked complete.
    - Without a key: build series only from uploads seen since ingest started, and never mark them complete.
  - On-air playlists: every 2h (every 30 minutes for Ramadan series during Ramadan). Archive: weekly.
- C. Verify
  - oEmbed: 200 → ok; 401/403 → blocked; 400/404 → gone.
  - Per run: 40 new videos plus 20 older than 7 days.
  - HEAD request on maxres covers.
- D. Derive
  - parseEpisodeTitle, groupParts, classifySeries.
  - Ramadan tag: first episode from 3 days before to 10 days after 1 Ramadan.
  - Cadence from at least 4 dates.
  - Colour: sharp to 32×18, then dominantColor.
- E. Prune, then revalidateTag('ttv').
- Every fetch: 8s timeout, fixed hosts, ids checked by regex. No scraping.
- read.ts
  - unstable_cache 300s, tag ttv. Never throws.
  - When the DB is empty, bootstrap from live RSS within a 3s total budget, otherwise return empty.
  - Exports: getTvHub, getTvChannel, getRamadanTv, getLatestTvEpisodes, getTunisianTvShelfTile, tunisianTvSitemap, searchTvSeries.

UX
1. /tunisian header: 3 HubDoors in `grid gap-3 xl:grid-cols-3` (stacked below xl so text never truncates).
   - Tunisian cinema → /tunisian/cinema
   - Tunisian TV → /tunisian/tv, with a LiveDot badge when live and the text 'New: {series}, episode {n}'
   - Ramadan series → /ramadan
   - Accents: 231 0 19, and 245 190 80 for Ramadan.
   - Keep everything else on the page.
2. /tunisian/tv (force-dynamic, maxDuration 20; Kids get KidsBlocked)
- Header
  - Title 'Tunisian TV'.
  - Subtitle: 'Full episodes from the official YouTube channels of Tunisian TV. Free, legal and new every evening.'
  - TunisiaMark watermark, plus a channel stack linking to #channels.
- TvHero
  - Content: newest drama episode within 36h, else the most recently updated on-air series; the Ramadan drama during Ramadan.
  - Cadence line.
  - Buttons: 'Play episode {n}' (red) and 'All episodes'.
  - Without complete data, the button reads 'Latest episodes'.
- Rows, each hidden when empty:
  - Live now
  - New episodes (7 days)
  - Ramadan row
  - On air now
  - Most watched this week
  - Talk and entertainment
  - Complete series: only series where complete is true
  - Channels strip
- Footer
  - FaYoutube and 'Every episode plays from the channels' official YouTube pages. TunisiaFlicks doesn't host or change them.'
  - 'Updated {time}'.
- Empty: 'Tunisian TV is warming up', never a 500.
3. /tunisian/tv/[channel]
- Header: 88px avatar, name, @handle, 'Official channel', 'Open on YouTube', RoomTint.
- Series rows (id series-<id>), latest uploads, shows.
- ?v= opens that video.
- Quiet and dormant states.
4. Playing
- One YouTubeDialog per page, through TvWatchProvider.
- Blocked tiles open YouTube in a new tab.
- Nothing loads from YouTube's servers until Play is pressed: thumbnails come from the first-party proxy and the embed is nocookie.
5. /ramadan: RamadanTvRows (null for Kids), plus a 'Watch on Tunisian TV' button.
6. HubShelf: the Tunisian TV tile gets its picture (youtubeThumb of the cover) and a LiveDot badge from getTunisianTvShelfTile().
7. tunisianTvDigestProvider.

TESTS
- Unit tests on parse.mjs with live-captured fixtures:
  - parseFeed, including isShort
  - parseEpisodeTitle cases:
    - 'مسلسل المايسترو | El Maestro - الحلقة 7'
    - 'Warthet El Nar EP13 ll…'
    - 'Carte Postale EP13 P02'
    - 'Sans Filtres S02 Episode 30 24-07-2026 Partie 03'
    - the 'Epiosde' typo
    - 'خطيفة الحلقة 22'
  - seriesKey, classifySeries, playlistIdsIn, cleanDescription, airingCadence, groupParts

SHARED-FILE REQUESTS
- Footer.
- sitemap.
- share-sections 'tunisian-tv'.
- cron.yml: '23 */3 * * *'.
- Digest providers.
- legal (thumbnails through our server; video only after Play).
- README: YOUTUBE_API_KEY (recommended for complete series), TUNISIAN_TV_CHANNELS(_OFF), kill switches.

ACCEPTANCE
1. Unit tests pass.
2. Cron
   - 401 without auth.
   - A second run creates no duplicates.
   - Two concurrent runs: one answers busy.
   - Finishes within 22s for cron-job.org.
3. Pages
   - 200 with an empty DB or with YouTube blocked.
   - Unknown channel → 404.
   - Kids get KidsBlocked.
   - The tn cookie gives RTL.
4. Blocked videos fall back to YouTube.
5. The network panel shows no youtube.com or ytimg.com request before Play.
6. The LiveDot shows on the door and on the shelf tile.
7. At 768px the doors' text isn't truncated.