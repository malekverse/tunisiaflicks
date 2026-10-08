// TunisiaFlicks service worker — deliberately minimal.
//
// It lets the site be installed as an app, shows a branded offline page when a page navigation
// fails because there's no network, and displays push notifications (daily pick, release alerts). It never caches app pages, scripts or
// API responses, so a new deploy is always picked up immediately (no stale-app bugs).
const VERSION = 'v3'
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

// Push payload (lib/push.ts): { title, body, url, image?, tag? }
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'TunisiaFlicks', body: event.data ? event.data.text() : '' }
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'TunisiaFlicks', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      image: data.image,
      tag: data.tag,
      data: { url: data.url || '/' },
    })
  )
})

// Focus an open TunisiaFlicks tab (navigating it to the link) or open a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin)
  if (target.origin !== self.location.origin) return
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => new URL(client.url).origin === target.origin)
      // navigate() only works on pages this worker controls; otherwise open a new window.
      if (open) return open.focus().then((client) => (client || open).navigate(target.href)).catch(() => self.clients.openWindow(target.href))
      return self.clients.openWindow(target.href)
    })
  )
})
