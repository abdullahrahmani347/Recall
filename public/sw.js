// Recall Service Worker — proper cache-first PWA strategy.
// Cache version tied to build date. Static assets cached on install.
// Navigation: network-first with offline fallback. Assets: cache-first.

const CACHE_VERSION = 'recall-v3-2026-08-01'
const CACHE_NAME = `recall-${CACHE_VERSION}`

// App shell — the minimal set of files needed for offline use
const APP_SHELL = [
  '/',
  '/favicon.svg',
  '/logo.svg',
  '/apple-touch-icon.svg',
  '/manifest.webmanifest',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Use addAll but ignore failures for individual files
      Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Only handle GET
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // Skip cross-origin
  if (url.origin !== self.location.origin) return

  // Skip API calls — always fetch fresh
  if (url.pathname.startsWith('/api/')) return

  // Navigation requests: network-first, fall back to cached shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the latest page
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put('/', clone))
          return response
        })
        .catch(() =>
          // Offline: serve cached shell
          caches.match('/').then((cached) =>
            cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
          )
        )
    )
    return
  }

  // Static assets: cache-first, fall back to network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        // Only cache successful responses
        if (response.ok && response.type === 'basic') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      }).catch(() => cached || new Response('', { status: 408 }))
    })
  )
})

// Listen for messages from the client (e.g., "skip waiting")
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
