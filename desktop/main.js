// TunisiaFlicks desktop — the TunisiaFlicks site in its own window, plus the ad-free local player.
//
// The window loads the real site (TF_SITE_URL, default https://tunisiaflicks.vercel.app), so the
// desktop app is the same TunisiaFlicks — the same UI, account, lists, profiles, everything — and
// it never drifts from the web. What the desktop adds:
//
// - The local torrent player (../player-service), started on a free loopback port. The site sees its
//   address through the preload bridge (window.tunisiaflicksDesktop.player) and offers it as one more
//   source in its player, next to the third-party ones (/embed/… on the service, framed by the site).
// - No popups: a new window or a navigation away from the site only opens (in the real browser) when
//   the viewer clicked something on the site itself. Popups fired from inside a source's frame — the
//   ads — go nowhere.
// - Desktop manners: dark title bar, the window remembers its size, F11 / Alt+arrows / mouse back
//   and forward buttons / Ctrl+R / zoom keys, an offline screen that retries by itself.
// - Updates (updater.js): new versions of the app download in the background and install on quit,
//   unless the viewer turned that off in the site's settings.

const { app, BrowserWindow, shell, Menu, ipcMain, nativeTheme } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const net = require('node:net')
const http = require('node:http')
const { spawn } = require('node:child_process')
const { setupUpdates } = require('./updater')

const SITE_URL = process.env.TF_SITE_URL || 'https://tunisiaflicks.vercel.app'
const SITE_ORIGIN = new URL(SITE_URL).origin

// In a packaged app the service is unpacked under resources/player-service; in dev it's a sibling.
const SERVICE_DIR = app.isPackaged
  ? path.join(process.resourcesPath, 'player-service')
  : path.join(__dirname, '..', 'player-service')
const SERVICE_ENTRY = path.join(SERVICE_DIR, 'server.js')

let serviceProcess = null
let servicePort = 0
let serviceRestarts = 0
let mainWindow = null
/** Last time the viewer clicked or pressed a key on the site itself (not inside a source's frame). */
let lastGesture = 0
const GESTURE_MS = 1500

const serviceOrigin = () => `http://127.0.0.1:${servicePort}`

// ---- the local player service ----------------------------------------------------------------

/** Find a free loopback port so two installs / another app never collide on a fixed one. */
function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

/** Poll the service's /health until it answers (or time out). */
function waitForService(port, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/health', timeout: 1500 }, (res) => {
        res.resume()
        if (res.statusCode === 200) return resolve()
        retry()
      })
      req.on('error', retry)
      req.on('timeout', () => { req.destroy(); retry() })
    }
    const retry = () => (Date.now() > deadline ? reject(new Error('player-service did not start in time')) : setTimeout(tick, 400))
    tick()
  })
}

/** Start player-service with Electron's bundled Node (ELECTRON_RUN_AS_NODE); restart it if it dies. */
function spawnService() {
  serviceProcess = spawn(process.execPath, [SERVICE_ENTRY], {
    cwd: SERVICE_DIR,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: String(servicePort),
      HOST: '127.0.0.1',
      // Where the player keeps the viewer's add-ons, next to the app's own settings.
      DATA_DIR: path.join(app.getPath('userData'), 'player'),
      // The site the window shows may frame the player and drive it.
      ALLOWED_ORIGINS: [process.env.ALLOWED_ORIGINS, 'https://tunisiaflicks.vercel.app', 'http://localhost:3000', SITE_ORIGIN].filter(Boolean).join(','),
    },
    stdio: 'inherit',
  })
  serviceProcess.on('exit', (code) => {
    serviceProcess = null
    if (app.isQuitting) return
    console.error('[service] exited', code)
    if (serviceRestarts++ < 3) setTimeout(spawnService, 1000)
  })
}

// ---- the window ------------------------------------------------------------------------------

const stateFile = () => path.join(app.getPath('userData'), 'window-state.json')
function readWindowState() {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')) } catch { return {} }
}
function saveWindowState() {
  if (!mainWindow) return
  try {
    fs.writeFileSync(stateFile(), JSON.stringify({ bounds: mainWindow.getNormalBounds(), maximized: mainWindow.isMaximized() }))
  } catch { /* not fatal */ }
}

/** Pages the window itself may show: the site, Google's sign-in, the local player, the offline page. */
function belongsInApp(url) {
  try {
    const u = new URL(url)
    if (u.origin === SITE_ORIGIN || u.origin === serviceOrigin() || u.protocol === 'file:') return true
    return u.protocol === 'https:' && (/(^|\.)google\.com$/.test(u.hostname) || u.hostname === 'accounts.youtube.com')
  } catch {
    return false
  }
}

/** Off-site: to the real browser, but only when the viewer asked for it (a click on the site). */
function openOutside(url) {
  if (Date.now() - lastGesture > GESTURE_MS) return   // fired from inside a source's frame: an ad
  if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) shell.openExternal(url)
}

function showOffline() {
  mainWindow?.loadFile(path.join(__dirname, 'app', 'offline.html'), { query: { site: SITE_URL } })
}

function createWindow() {
  const state = readWindowState()
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    ...(state.bounds || {}),
    minWidth: 380,
    minHeight: 560,
    show: false,
    backgroundColor: '#000000',
    title: 'TunisiaFlicks',
    icon: path.join(__dirname, 'app', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // the site can't touch Node; the only bridge is preload's small API
      sandbox: true,
      nodeIntegration: false,
      autoplayPolicy: 'no-user-gesture-required',   // a picked source starts playing on its own
      additionalArguments: [`--tf-player=${serviceOrigin()}`, `--tf-version=${app.getVersion()}`],
    },
  })
  if (state.maximized) mainWindow.maximize()
  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.loadURL(SITE_URL)

  const contents = mainWindow.webContents

  // New windows (target=_blank links, share buttons, popups) never open inside the app.
  contents.setWindowOpenHandler(({ url }) => {
    if (new URL(url).origin === SITE_ORIGIN) contents.loadURL(url)
    else openOutside(url)
    return { action: 'deny' }
  })

  // The window stays on the site; anything else goes to the browser (if the viewer asked).
  contents.on('will-navigate', (event, url) => {
    if (belongsInApp(url)) return
    event.preventDefault()
    openOutside(url)
  })

  // No connection (or the site is down): a calm offline screen that retries by itself.
  contents.on('did-fail-load', (_event, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 /* aborted: a new navigation took over */) return
    if (url.startsWith('file:')) return
    showOffline()
  })

  // Desktop keys. (The app menu is gone, so its accelerators are too: these replace them.)
  contents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    const ctrl = input.control || input.meta
    const key = input.key
    let handled = true
    if (key === 'F11') mainWindow.setFullScreen(!mainWindow.isFullScreen())
    else if (input.alt && key === 'ArrowLeft') contents.navigationHistory.canGoBack() && contents.navigationHistory.goBack()
    else if (input.alt && key === 'ArrowRight') contents.navigationHistory.canGoForward() && contents.navigationHistory.goForward()
    else if (key === 'F5' || (ctrl && key.toLowerCase() === 'r')) contents.reload()
    else if (ctrl && (key === '=' || key === '+')) contents.setZoomLevel(Math.min(contents.getZoomLevel() + 0.5, 4))
    else if (ctrl && key === '-') contents.setZoomLevel(Math.max(contents.getZoomLevel() - 0.5, -3))
    else if (ctrl && key === '0') contents.setZoomLevel(0)
    else if (!app.isPackaged && ctrl && input.shift && key.toLowerCase() === 'i') contents.toggleDevTools()
    else handled = false
    if (handled) event.preventDefault()
  })

  // Mouse back / forward buttons (Windows).
  mainWindow.on('app-command', (_event, command) => {
    if (command === 'browser-backward' && contents.navigationHistory.canGoBack()) contents.navigationHistory.goBack()
    if (command === 'browser-forward' && contents.navigationHistory.canGoForward()) contents.navigationHistory.goForward()
  })

  mainWindow.on('close', saveWindowState)
  mainWindow.on('closed', () => { mainWindow = null })
}

// The preload reports clicks/keys on the site itself (never from a source's frame).
ipcMain.on('tf:gesture', (event) => {
  if (mainWindow && event.sender === mainWindow.webContents && event.senderFrame === mainWindow.webContents.mainFrame) lastGesture = Date.now()
})
ipcMain.on('tf:retry', (event) => {
  if (mainWindow && event.sender === mainWindow.webContents) mainWindow.loadURL(SITE_URL)
})

// ---- app lifecycle ---------------------------------------------------------------------------

// Single instance — a second launch focuses the existing window instead of starting a 2nd service.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus() }
  })

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null)
    nativeTheme.themeSource = 'dark'   // dark title bar, dark scrollbars, dark native controls
    // A plain Chrome user agent: Google's sign-in refuses browsers that announce themselves as
    // Electron, and the site needs nothing from the UA (it reads the preload bridge instead).
    app.userAgentFallback = app.userAgentFallback.replace(/\s(Electron|tunisiaflicks-desktop|TunisiaFlicks)\/\S+/gi, '')

    servicePort = await freePort()
    spawnService()
    // The site loads while the service warms up; the player is only needed once a title is opened.
    waitForService(servicePort).catch((err) => console.error('[service]', err.message))
    const updates = setupUpdates({ getWindow: () => mainWindow })
    createWindow()
    updates.start()

    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
  })

  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

  app.on('before-quit', () => {
    app.isQuitting = true
    if (serviceProcess) { try { serviceProcess.kill() } catch {} }
  })
}
