// Updates for the desktop app (electron-updater). The window shows the live site, so the site is
// always current; this keeps the rest current: the shell (main.js, preload.js) and the bundled
// local player (player-service), which only change with a new installer.
//
// - The feed is the site's /download/desktop-update/ (package.json "publish"; TF_UPDATE_URL
//   overrides it): latest.yml, the installer and its blockmap from the newest desktop-v… release
//   on GitHub. Not electron-updater's GitHub provider: the Android releases share "latest" there.
// - Automatic updates (on by default; the viewer can turn them off in the site's settings, saved
//   in userData/settings.json): a check 15 s after start and every 4 hours, the new version
//   downloads in the background and installs when the app is closed.
// - Off: no checks of its own. "Check for updates" still downloads a new version on request, and
//   "Restart to update" installs it; nothing installs by itself.
// - Unsigned builds: there's no publisherName, so Windows doesn't ask for a signature on the update.
// - Only in the installed app; a dev run (npm start) reports 'unsupported'.
const { app, ipcMain } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const FIRST_CHECK_MS = 15 * 1000
const CHECK_EVERY_MS = 4 * 60 * 60 * 1000

const settingsFile = () => path.join(app.getPath('userData'), 'settings.json')
function readSettings() {
  try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')) || {} } catch { return {} }
}
function writeSettings(patch) {
  try { fs.writeFileSync(settingsFile(), JSON.stringify({ ...readSettings(), ...patch })) } catch { /* not fatal */ }
}

/**
 * Sets the updater up and answers the site's questions about it (through preload.js). The state
 * the site sees: { current, auto, status, version?, percent? }, where status is 'idle',
 * 'checking', 'downloading' (version, percent), 'ready' (version: installs on restart), 'latest',
 * 'error' or 'unsupported'.
 */
function setupUpdates({ getWindow }) {
  let auto = readSettings().autoUpdate !== false
  let state = { status: app.isPackaged ? 'idle' : 'unsupported' }
  let timer = null
  let updater = null

  const snapshot = () => ({ current: app.getVersion(), auto, ...state })
  const publish = (next) => {
    state = next
    const win = getWindow()
    if (win && !win.isDestroyed()) win.webContents.send('tf:update', snapshot())
  }

  if (app.isPackaged) {
    updater = require('electron-updater').autoUpdater
    updater.logger = console
    updater.autoDownload = true
    updater.autoInstallOnAppQuit = auto
    // Every release's installer has the same name, so the "old" and "new" blockmaps would be the
    // same file and a differential download always fails over to a full one: go straight there.
    updater.disableDifferentialDownload = true
    updater.disableWebInstaller = true
    if (process.env.TF_UPDATE_URL) updater.setFeedURL({ provider: 'generic', url: process.env.TF_UPDATE_URL })

    updater.on('checking-for-update', () => publish({ status: 'checking' }))
    updater.on('update-available', (info) => publish({ status: 'downloading', version: info.version, percent: 0 }))
    updater.on('download-progress', (progress) => {
      const percent = Math.floor(progress.percent || 0)
      if (state.status !== 'downloading' || percent !== state.percent) publish({ ...state, status: 'downloading', percent })
    })
    updater.on('update-not-available', () => publish({ status: 'latest' }))
    updater.on('update-downloaded', (info) => publish({ status: 'ready', version: info.version }))
    updater.on('error', (error) => {
      console.error('[updates]', error?.message ?? error)
      // A failed check or download; the version already downloaded (if any) stays ready.
      if (state.status !== 'ready') publish({ status: 'error' })
    })
  }

  const busy = () => state.status === 'checking' || state.status === 'downloading' || state.status === 'ready'
  const check = () => {
    if (!updater || busy()) return
    updater.checkForUpdates().catch(() => { /* reported through 'error' */ })
  }
  const schedule = () => {
    if (timer) clearInterval(timer)
    timer = updater && auto ? setInterval(check, CHECK_EVERY_MS) : null
  }

  // Only the site in the window's top frame may ask (never a source's frame).
  const fromSite = (event) => {
    const win = getWindow()
    return !!win && !win.isDestroyed() && event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame
  }

  ipcMain.handle('tf:update:get', (event) => (fromSite(event) ? snapshot() : null))

  ipcMain.handle('tf:update:set-auto', (event, on) => {
    if (!fromSite(event)) return null
    auto = on === true
    writeSettings({ autoUpdate: auto })
    if (updater) updater.autoInstallOnAppQuit = auto
    schedule()
    if (auto) check()
    publish(state)
    return snapshot()
  })

  ipcMain.handle('tf:update:check', (event) => {
    if (!fromSite(event)) return null
    check()
    return snapshot()
  })

  ipcMain.handle('tf:update:install', (event) => {
    if (!fromSite(event) || !updater || state.status !== 'ready') return null
    // Silent install, then the app opens again on the new version.
    setImmediate(() => {
      app.isQuitting = true
      updater.quitAndInstall(true, true)
    })
    return snapshot()
  })

  return {
    /** Once the window is open: the first check (when automatic), then every few hours. */
    start() {
      if (updater && auto) setTimeout(check, FIRST_CHECK_MS)
      schedule()
    },
  }
}

module.exports = { setupUpdates }
