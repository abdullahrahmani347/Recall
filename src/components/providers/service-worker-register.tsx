'use client'

import { useEffect } from 'react'

/**
 * ServiceWorkerRegister — registers the service worker on mount.
 * Only runs in production (not during dev) to avoid caching issues.
 * Must be a client component because it uses useEffect.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Silently fail — SW is a progressive enhancement
    })
  }, [])

  return null
}
