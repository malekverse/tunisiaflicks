// The bridge between the TunisiaFlicks site and the desktop app. contextIsolation-safe and small:
// the site gets the local player's address (to offer it as a source) and nothing privileged.
//
// Preloads only run in the window's top frame, never in a source's iframe, so the third-party
// players (and their ads) never see this bridge — and never fire the "the viewer clicked" signal
// the main process uses to tell a real click on the site from a popup an ad fired.
const { contextBridge, ipcRenderer } = require('electron')

const arg = (name) => {
  const prefix = `--${name}=`
  const found = process.argv.find((value) => value.startsWith(prefix))
  return found ? found.slice(prefix.length) : null
}

const player = arg('tf-player')

contextBridge.exposeInMainWorld('tunisiaflicksDesktop', {
  present: true,
  version: arg('tf-version') || '0.0.0',
  platform: process.platform,
  /** The local player service, e.g. http://127.0.0.1:53124 (the site frames /embed/… from it). */
  player: player && /^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(player) ? player : null,
  /** The offline screen's "Try again". */
  retry: () => ipcRenderer.send('tf:retry'),
  /** The app's updates (see updater.js); the site's settings show and change them. Since 1.1.0. */
  updates: {
    get: () => ipcRenderer.invoke('tf:update:get'),
    setAuto: (on) => ipcRenderer.invoke('tf:update:set-auto', on === true),
    check: () => ipcRenderer.invoke('tf:update:check'),
    /** Restart on the version already downloaded. */
    install: () => ipcRenderer.invoke('tf:update:install'),
    /** Calls back with each new state; returns a function that stops listening. */
    onChange: (callback) => {
      const listener = (_event, state) => callback(state)
      ipcRenderer.on('tf:update', listener)
      return () => ipcRenderer.removeListener('tf:update', listener)
    },
  },
})

// A click or a key on the site itself: the viewer may open a link outside (see main.js).
const gesture = () => ipcRenderer.send('tf:gesture')
window.addEventListener('pointerdown', gesture, true)
window.addEventListener('keydown', gesture, true)
