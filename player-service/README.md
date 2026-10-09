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
| `GET /resolve?type=movie&tmdb=550` | title → magnet → swarm → `playUrl`. Takes `imdb`, or `tmdb` (+ a TMDB key). TV: `?type=tv&tmdb=…&season=1&episode=1`. Auto-picks 1080p/720p x264 over 2160p (which needs transcoding). |
| `GET\|POST /add?magnet=…` | join the swarm; returns the file list + `best` with `decision`, codecs and a ready-to-play `playUrl` |
| `GET /stream/:infoHash/:index` | native byte-range stream (direct path), `206` |
| `GET /play/:infoHash/:index` | ffmpeg remux/transcode → progressive MP4 (redirects to `/stream` for direct files) |
| `GET /api/tmdb/trending` · `GET /api/tmdb/search?q=` | thin TMDB movie proxy for the built-in browse page (keeps the key server-side) |

Two ways to drive it: from a TMDB id (`/resolve`, used by the built-in browse page and the desktop
app) or from a magnet you already resolved (`/add`). Either way, point the player at the returned
`playUrl`. The built-in page at `/` is a search + trending grid that plays a movie locally on click.

## Security (it exposes a torrent engine, so it's locked down)

- **Binds `127.0.0.1` only** (`HOST`) — never the LAN.
- **Host allow-list** rejects foreign `Host` headers (anti DNS-rebinding).
- **Origin allow-list** (`ALLOWED_ORIGINS`) — only the app's web origins may drive it; a random site's
  `fetch` is refused, so no page can make your machine join a swarm.
- **Magnet/infohash only** — `/add` rejects http(s) URLs and file paths (no SSRF / local-file reads).
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

## Tests

- `node test-codec.mjs` — deterministic: synthesizes the hard cases (H.264-in-MKV-with-AC3,
  HEVC-with-AC3) and verifies the policy + ffmpeg turn them into browser-native H.264/AAC MP4.

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
