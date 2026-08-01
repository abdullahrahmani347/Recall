// Self-destructing service worker — removes any existing SW and caches.
// This prevents stale cached JS from crashing the app after rebuilds.
self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
  )
})
self.addEventListener('activate', (e) => {
  e.waitUntil(
    Promise.all([
      self.registration.unregister(),
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
      self.clients.claim()
    ])
  )
})
self.addEventListener('fetch', (e) => {
  // Pass through — never intercept
})
