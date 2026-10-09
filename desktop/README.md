# TunisiaFlicks desktop

The TunisiaFlicks site in its own window, plus the ad-free local player. The window loads the real
site, so the desktop app **is** TunisiaFlicks — the same UI, account, profiles, lists and every
feature — and it never drifts from the web. On top of that it runs the torrent-streaming player
(`../player-service`) on the viewer's own machine, and the site offers it as **one more source** in
its player (first in the bar, named "TunisiaFlicks"), next to VidSrc, VidLink and the others.

## Run it (dev)

```bash
cd player-service && npm install && cd ../desktop && npm install
npm start
```

`npm start` finds a free loopback port, launches `player-service` on it (via Electron's bundled
Node) and opens the window on the site. To try it against a local copy of the site (e.g. before the
site changes are deployed), point it there:

```bash
TF_SITE_URL=http://localhost:3000 npm start
```

## What the desktop adds to the site

- **The local player as a source.** The preload bridge gives the site the player's address
  (`window.tunisiaflicksDesktop.player`); `StreamSection` (via `src/hooks/use-desktop-app.ts`) puts
  a "TunisiaFlicks" source first, which frames `/embed/movie/:id` or `/embed/tv/:id/:s/:e` from the
  service. The other sources stay exactly as they are. In a browser there is no bridge and nothing
  changes.
- **No ad popups.** A new window or a navigation off the site only opens — in the real browser —
  when the viewer clicked something on the site itself. Popups and redirects fired from inside a
  source's frame (the ads) go nowhere. (The preload only runs in the top frame, so a source's frame
  can never fake that click.)
- **Desktop manners.** Dark title bar; the window remembers its size and position; F11 full screen,
  Alt+←/→ and the mouse's back/forward buttons, Ctrl+R / F5, Ctrl +/−/0 zoom; Google sign-in works
  (the app presents a plain Chrome user agent); a branded offline screen that comes back by itself.

## Build an installer

```bash
npm run dist:win     # or: dist (current OS)
```

electron-builder bundles the app + `player-service` (incl. the static ffmpeg/ffprobe) into an
installer under `dist/` (`TunisiaFlicks-Setup.exe`). To publish one, push a `desktop-v1.2.3` tag:
`.github/workflows/desktop-app.yml` builds it on Windows and releases it on GitHub, and the site's
`/desktop` page and `/download/desktop` serve it within the hour (`docs/apps.md`). Notes:

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

- **Done:** the window shows the real site; the local player is a source in the site's player
  (needs the site changes deployed — until then, use `TF_SITE_URL`).
- **Auto-update:** design it in before public release (electron-updater) — if a bad build ever ships
  you need a signed channel to push a fix; it shares the signing identity above.
