// TunisiaFlicks desktop — an Electron shell that runs the hardened torrent-stream player
// (player-service) on the viewer's own machine and opens its ad-free player UI.
//
// Why desktop: the torrenting happens on the viewer's machine (not a central server), so there is
// no central bandwidth bill and no server acting as distributor. The window loads the LOCAL service
// over http://127.0.0.1 (same origin), so there is no HTTPS→localhost mixed-content problem and no
// privileged bridge exposed to third-party ad embeds.
//
// Phase 2 (not here): load the real tunisiaflicks site and expose the local player to it through a
// locked-down contextIsolation preload bridge, so users browse the catalogue and play locally.

const { app, BrowserWindow, shell, Menu } = require('electron')
const path = require('node:path')
const net = require('node:net')
const http = require('node:http')
const { spawn } = require('node:child_process')

// In a packaged app the service is unpacked under resources/player-service; in dev it's a sibling.
const SERVICE_DIR = app.isPackaged
  ? path.join(process.resourcesPath, 'player-service')
  : path.join(__dirname, '..', 'player-service')
const SERVICE_ENTRY = path.join(SERVICE_DIR, 'server.js')

let serviceProcess = null
let mainWindow = null
let servicePort = 0

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

/** Start player-service as a child process using Electron's bundled Node (ELECTRON_RUN_AS_NODE). */
async function startService() {
  servicePort = await freePort()
  serviceProcess = spawn(process.execPath, [SERVICE_ENTRY], {
    cwd: SERVICE_DIR,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PORT: String(servicePort), HOST: '127.0.0.1' },
    stdio: 'inherit',
  })
  serviceProcess.on('exit', (code) => { if (code && !app.isQuitting) console.error('[service] exited', code) })
  await waitForService(servicePort)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0d0c0f',
    title: 'TunisiaFlicks',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,   // renderer can't touch Node; the only bridge is preload's safe API
      sandbox: true,
      nodeIntegration: false,
    },
  })
  mainWindow.loadURL(`http://127.0.0.1:${servicePort}/`)

  // Open any off-site link (e.g. a magnet source) in the real browser, not inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`http://127.0.0.1:${servicePort}`)) { shell.openExternal(url); return { action: 'deny' } }
    return { action: 'allow' }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

// Single instance — a second launch focuses the existing window instead of starting a 2nd service.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus() }
  })

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null)
    try {
      await startService()
      createWindow()
    } catch (err) {
      const { dialog } = require('electron')
      dialog.showErrorBox('TunisiaFlicks', `Couldn't start the local player.\n\n${err.message}`)
      app.quit()
    }
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
  })

  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

  app.on('before-quit', () => {
    app.isQuitting = true
    if (serviceProcess) { try { serviceProcess.kill() } catch {} }
  })
}
