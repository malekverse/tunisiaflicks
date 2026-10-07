// TunisiaFlicks service worker — deliberately minimal.
//
// It only does two things: lets the site be installed as an app, and shows a branded offline page
// when a page navigation fails because there's no network. It never caches app pages, scripts or
// API responses, so a new deploy is always picked up immediately (no stale-app bugs).
const VERSION = 'v1'
const CACHE = `tunisiaflicks-${VERSION}`
const OFFLINE_URL = '/offline.html'
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  // Page navigations only: go to the network, fall back to the offline page if it's unreachable.
  if (event.request.mode !== 'navigate') return
  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL))
  )
})
