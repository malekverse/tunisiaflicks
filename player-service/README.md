# TunisiaFlicks player-service

A standalone service that turns a **torrent (magnet / infohash)** into an **HTTP video stream** a
browser can play — ad-free, under our control. The app resolves a magnet (YTS/EZTV) and hands it
here; the service joins the swarm and re-serves the video over HTTP, converting on the fly the files
a plain `<video>` can't play.

> **Not part of the Next.js app; cannot run on Vercel.** It holds live peer connections, disk
> buffers, and spawns ffmpeg, so it needs a long-running machine. The intended home is **each
> viewer's own machine** (via a desktop app), which keeps bandwidth and legal exposure on the viewer
> rather than a central server. It can also run on a VPS for testing.

## Run locally

```bash
cd player-service
npm install
npm start           # http://127.0.0.1:8080
```

Open it, click a public-domain demo (Sintel / Big Buck Bunny), and it streams.

## How playback works

Each file is probed with `ffprobe`, then one of three paths is chosen (see `codec.js`):

| Decision | When | What happens | Seek |
| --- | --- | --- | --- |
| **direct** | H.264 + AAC in MP4 (most YTS x264) | streamed as-is, native byte-range | ✅ instant |
| **remux** | H.264 in MKV/AVI, or AC3/DTS audio (common TV rips) | `ffmpeg -c:v copy`, audio→AAC, progressive fMP4 | ⚠️ limited (Phase 2) |
| **transcode** | HEVC / VP9 / AV1 / 10-bit | `ffmpeg` re-encode to H.264/AAC | ⚠️ limited; CPU/GPU-heavy |

`ffmpeg`/`ffprobe` are bundled via **`ffmpeg-ffprobe-static`** (no system install needed).

## API

| Route | Purpose |
| --- | --- |
| `GET /health` | liveness + byte counters |
| `GET /sources?type=movie&tmdb=550` | every copy of a title, best to stream first: the built-in providers (YTS, EZTV, The Pirate Bay) plus the installed extensions' streams (torrents and direct links), each with an id, quality, size, seeders and the audio languages its name says it has (`languages`, `multi`). The right single film ranks before multi-film packs, then by quality, size and seeds (providers.js). TV: `?type=tv&tmdb=…&season=1&episode=1`. |
| `GET /resolve?type=movie&tmdb=550` | plays the best copy, trying up to 3 in turn if a swarm doesn't answer (`?audioLang=fre` puts copies dubbed in that language first), or `?source=<id>` from `/sources`. Answers `playUrl`, `decision`, `seekable`, `durationSec` and the file's `audioTracks`. Ranks 1080p > 720p, x264 over x265/HEVC/AV1 (which need transcoding), direct links before torrents, then seeds. TV releases must be named after the show (EZTV files some under the wrong show). Still takes `?imdb=` alone (YTS/EZTV only). |
| `GET /seek/:infoHash/:index?t=&audio=` · `GET /seek/u/:id?t=&audio=` | where a converted stream asked to start at `t` really starts (`{ start }`: a remux starts on a keyframe) |
| `GET /uplay/:id?t=&audio=` | an extension's direct link, converted like `/play` when a browser can't play it as it is |
| `GET /subtitles?type=…&tmdb=…` · `GET /subtitle/:id` | every subtitle for a title (YIFY Subtitles, SubDL with `SUBDL_API_KEY`, and the extensions'), then one as UTF-8 text, unzipped and decoded (Arabic Windows-1256 too) |
| `POST /translate` | `{ to, lines }`: a batch of subtitle lines in another language (`translate.js`) |
| `GET /addons` · `GET /addons/catalog` · `POST /addons` · `DELETE /addons/:id` | the installed extensions, the ready list (`extensions.json`), install one by its `manifest.json` address, remove one |
| `GET /state?key=movie:550` · `PUT /prefs` · `PUT /progress/:key` | what the player remembers (`state.js`): preferences, and where the viewer stopped |
| `GET /embed/movie/:tmdb` · `GET /embed/tv/:tmdb/:season/:episode` | the player as an embed, for the TunisiaFlicks site's player frame (desktop app). Only the site's origins and loopback may frame it (`frame-ancestors`). |
| `GET /cast/devices` | Play on TV: the DLNA TVs on the home network (most Samsung / LG TVs), from an SSDP search |
| `POST /cast/start` | `{ deviceId, infoHash, index, title, position }`: send an active swarm's file to a TV |
| `GET /cast/:cast/status` · `POST /cast/:cast/{play,pause,seek,stop}` | follow and drive the TV (`seek` takes `{ position }` in seconds) |
| `GET /stats/:infoHash` | peers / speed / progress of an active swarm (the embed's loading screen) |
| `GET\|POST /add?magnet=…` | join the swarm; returns the file list + `best` with `decision`, codecs and a ready-to-play `playUrl` |
| `GET /stream/:infoHash/:index` | native byte-range stream (direct path), `206` |
| `GET /play/:infoHash/:index?t=&audio=` | ffmpeg remux/transcode → progressive MP4, from `t` seconds, with audio track `audio` (redirects to `/stream` for a direct file's first track) |
| `GET /api/tmdb/trending` · `GET /api/tmdb/search?q=` | thin TMDB movie proxy for the built-in browse page (keeps the key server-side) |

Two ways to drive it: from a TMDB id (`/resolve`, used by the built-in browse page and the desktop
app) or from a magnet you already resolved (`/add`). Either way, point the player at the returned
`playUrl`. The built-in page at `/` is a search + trending grid that plays a movie locally on click.

The built-in providers (YTS, EZTV, The Pirate Bay) and the default Torrentio extension mean a popular
title usually returns dozens of copies; the service ranks them so the one that streams best on a
normal connection plays first, and the player lets the viewer switch or pick on any slow copy.

## The player (views/embed.html)

A custom player: auto-hiding controls, a seek bar with what's buffered and a time preview, volume,
speed, picture in picture, full screen, keyboard shortcuts (`?` lists them), resume where the viewer
stopped, and Play on TV. Its panels:

- **Sources** — every copy, best first, filtered by quality and by audio language; switching keeps
  the place.
- **Audio** — the file's audio tracks (dubbed versions): picking one restarts the conversion with that
  track at the same moment (browsers can't switch tracks themselves). The language picked is
  remembered: the next films start on a copy and a track in it when there's one.
- **Subtitles** — every language, the version made for the playing release first (matched by name),
  then the best rated; a file of the viewer's (or dropped on the player); size, style and sync.
  The site's language (`?lang=` from the site) picks them before the viewer chooses: Arabic or
  French on those sites, none on the English one; with none in that language, the English ones are
  translated. Any subtitle can be translated (Google Translate's free web endpoint, unofficial).
- **Extensions** — the installed ones (Torrentio ships on by default: one aggregator covering ~15
  indexers), the ready list (`extensions.json`, one click), and any other
  by its `manifest.json` address. They follow the common add-on protocol: `/stream/…` and
  `/subtitles/…` for an IMDB id.

Converted streams (MKV, HEVC, another audio track) seek by starting again where asked: the page asks
`/seek` for the keyframe, then plays `…?t=<keyframe>`, and its clock is that offset plus the video's
own time; subtitles are drawn by the page on that clock.

## Security (it exposes a torrent engine, so it's locked down)

- **Binds `127.0.0.1` only** (`HOST`) — the API never answers on the LAN. The one exception is Play on
  TV: while casting, a separate small server on the LAN address the TV was found from serves only
  `/media/<token>/<name>`, where the token is a random 256-bit secret for that one cast, dead once it
  stops. TVs are only driven by ids from our own discovery, and a device description is only read
  from the private address that answered the search. Windows asks once to allow it on private
  networks. The TV gets the original file (TVs decode MKV / HEVC / AC3 themselves): no transcoding.
  `node test-cast.mjs` tests it end to end against a fake TV.
- **Host allow-list** rejects foreign `Host` headers (anti DNS-rebinding).
- **Origin allow-list** (`ALLOWED_ORIGINS`) — only the app's web origins may drive it; a random site's
  `fetch` is refused, so no page can make your machine join a swarm.
- **Built-in providers** (providers.js): The Pirate Bay (apibay) alongside YTS and EZTV, so a copy is
  found even when one index is down; each is a direct, keyless API call.
- **No address from a page** — `/add` takes magnets/infohashes only (no http(s) URLs, no file paths).
  Extensions are installed by their address (from the player page, which only the allowed origins
  can drive), and what they answer is kept server-side behind random ids: the page only ever sends
  an id back. ffmpeg/ffprobe open links with a protocol whitelist (http, https, tcp, tls, crypto: never
  `file:` or `concat:`); answers are size-capped and time-limited.
- **Bounds-checked** file indexes; ffmpeg is spawned with an argv array (no shell), fed over a pipe.

## Config (env vars)

| Var | Default | Notes |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | loopback only; don't change unless you know why |
| `PORT` | `8080` | |
| `ALLOWED_ORIGINS` | `http://localhost:3000,https://tunisiaflicks.vercel.app` | web origins allowed to drive it (loopback origins are always allowed) |
| `TMDB_API_KEY` | project key (dev fallback) | powers `/resolve` (tmdb→imdb) and the browse proxy; server-side only |
| `DOWNLOAD_DIR` | OS temp `/tunisiaflicks-stream` | scratch space for pieces |
| `MAX_TORRENTS` | `12` | concurrent swarms kept alive |
| `IDLE_MS` | `600000` | drop a swarm after 10 min unused |
| `TRANSCODE_MAXHEIGHT` | `1080` | downscale ceiling for the transcode path |
| `FFMPEG_PATH` / `FFPROBE_PATH` | bundled | override to use system binaries (may have GPU encoders) |
| `DATA_DIR` | `~/.tunisiaflicks-player` | the installed extensions and what the player remembers (the desktop app passes its own folder) |
| `SUBDL_API_KEY` | none | turns on SubDL subtitles (a free key from subdl.com; strong for Arabic) |

## Tests

- `node test-codec.mjs` — deterministic: synthesizes the hard cases (H.264-in-MKV-with-AC3,
  HEVC-with-AC3) and verifies the policy + ffmpeg turn them into browser-native H.264/AAC MP4.
- `tests/player.unit.test.mjs` (in the site's unit tests) — extensions, sources and dubbed copies,
  subtitles (zip, encodings, matching), what the player remembers, seeking and audio tracks.

## Notes & gotchas

- **`overrides` pins `uint8-util` to `2.2.5`.** `uint8-util@2.3.x` makes `arr2hex` strict, which
  crashes current WebTorrent on every `add` (it passes the infohash string to it for a debug label).
  Don't remove the override until WebTorrent ships a fix.
- **Do NOT set `uploadLimit: 0`.** It sounds like "don't seed" but it blocks the BitTorrent handshake
  (which must send bytes) → **0 peers, nothing plays**. The client is a normal swarm member while a
  title is open; seeding is kept minimal by pulling only watched pieces and dropping the swarm on
  idle/close — not a hard no-upload guarantee.
- **Seek on remux/transcode is limited.** Those paths serve a progressive stream (no byte ranges)
  for now; full seeking needs the HLS path (Phase 2).
- **Transcode is CPU/GPU-heavy.** On a low-end machine with no hardware encoder, HEVC/4K can run
  slower than realtime and stall. Prefer 1080p x264 sources; `TRANSCODE_MAXHEIGHT` downscales.
- **Legal / ops.** The machine running this joins the swarm, so its IP is visible there (inherent to
  torrents), and a *central* deployment also becomes the distributor (DMCA / host-termination risk).
  Running it on each viewer's own machine keeps that exposure on the viewer. Test only with content
  you're allowed to stream — the built-in demos are Creative-Commons (Blender open movies).
