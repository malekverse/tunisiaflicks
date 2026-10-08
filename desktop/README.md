# TunisiaFlicks desktop

An Electron app that runs the ad-free torrent-streaming player (`../player-service`) on the viewer's
own machine. The torrenting happens locally, so there's **no central bandwidth bill and no server
acting as distributor** — and the window loads the local service over `http://127.0.0.1`, so there's
no HTTPS→localhost mixed-content problem and no privileged bridge exposed to ad embeds.

## Run it (dev)

```bash
cd player-service && npm install && cd ../desktop && npm install
npm start
```

`npm start` finds a free loopback port, launches `player-service` on it (via Electron's bundled
Node), waits for `/health`, then opens the player window. Paste a magnet / click a demo to stream.

> The bootstrap (free-port → spawn service → health-wait) is verified. The window itself needs a real
> display, so run it on your desktop — it won't render in a headless/CI environment.

## Build an installer

```bash
npm run dist:win     # or: dist (current OS)
```

electron-builder bundles the app + `player-service` (incl. the static ffmpeg/ffprobe) into an
installer under `dist/`. Notes:

- **Per-platform binaries.** The bundled ffmpeg/ffprobe and WebTorrent's deps are OS-specific —
  build each target on (or for) that OS, and reinstall `player-service/node_modules` for the target
  platform. Don't ship a Windows build made with macOS binaries.
- **asar + native deps.** `player-service` is shipped as `extraResources` (unpacked), so its binaries
  stay runnable. If you later move it inside the asar, add the binaries to `asarUnpack`.

## Code-signing — read before you distribute

An unsigned build runs, but Windows SmartScreen shows a scary "unknown publisher" warning that will
scare off most users, and heuristic AV may quarantine an app that spawns ffmpeg and opens many P2P
connections. To clear that you need an **EV code-signing certificate** (~$300–400/yr on a hardware
token) — and that cert is bound to a **verified legal identity**, so signing publicly names *you* as
the publisher of this tool. That is a real legal decision, not a build detail: decide who signs (and
is named), or accept the SmartScreen warning, before shipping publicly. macOS needs notarization
(an Apple Developer account) for the same reason.

## Architecture / roadmap

- **v1 (this):** window loads the local service's own player page. Self-contained, safe, works offline
  from the site.
- **Phase 2:** point the window at the real tunisiaflicks site and expose the local player to it via a
  locked-down `contextIsolation` preload bridge (health probe + resolve-magnet + stream-URL), exposed
  **only to the top frame**, never to third-party ad iframes. Then users browse the catalogue and play
  locally. This needs matching changes in the site's `StreamSection` (a "TunisiaFlicks Player" source).
- **Auto-update:** design it in before public release (electron-updater) — if a bad build ever ships
  you need a signed channel to push a fix; it shares the signing identity above.
