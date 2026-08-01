'use client'

import { useEffect } from 'react'

export function ServiceWorkerRegister() {
  useEffect(() => {
    // Safely check if service workers are supported
    if (typeof navigator === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') return
    
    try {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    } catch {
      // Silently fail
    }
  }, [])

  return null
}
