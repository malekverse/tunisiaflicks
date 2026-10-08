// Minimal, contextIsolation-safe bridge. v1 only advertises that we're inside the desktop app (so a
// page can show "ad-free local player active"). Nothing privileged is exposed — the window loads the
// local service directly. When Phase 2 points the window at the real site, add narrowly-scoped,
// validated methods here (health probe, resolve magnet, stream URL) and expose them ONLY to the top
// frame, never to third-party ad iframes.
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('tunisiaflicksDesktop', {
  present: true,
  version: process.env.npm_package_version || '0.1.0',
})
