'use client'

import { useEffect, useState } from 'react'
import { WifiOff, CloudOff } from 'lucide-react'

/**
 * OfflineIndicator — shows a banner when the user is offline.
 * Also shows a "syncing..." indicator when there are pending
 * sync items being processed.
 */
export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine)

    // Set initial status
    updateOnlineStatus()

    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)

    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
    }
  }, [])

  // Check for pending sync items
  useEffect(() => {
    if (!isOnline) return
    const checkQueue = async () => {
      try {
        const { getPendingSyncItems } = await import('@/lib/offline-db')
        const items = await getPendingSyncItems()
        setIsSyncing(items.length > 0)
      } catch {
        // ignore
      }
    }
    checkQueue()
    const interval = setInterval(checkQueue, 5000)
    return () => clearInterval(interval)
  }, [isOnline])

  if (isOnline && !isSyncing) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
      {!isOnline && (
        <div className="flex items-center gap-2 rounded-full border border-grade-again/30 bg-grade-again/10 px-4 py-2 text-xs font-medium text-grade-again shadow-floating">
          <WifiOff className="h-3.5 w-3.5" />
          You're offline. Changes will sync when you reconnect.
        </div>
      )}
      {isOnline && isSyncing && (
        <div className="flex items-center gap-2 rounded-full border border-accent-brand/30 bg-accent-brand/10 px-4 py-2 text-xs font-medium text-accent-brand shadow-floating">
          <CloudOff className="h-3.5 w-3.5 animate-pulse" />
          Syncing changes…
        </div>
      )}
    </div>
  )
}
