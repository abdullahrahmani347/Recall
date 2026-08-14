'use client'

import { useEffect, useState } from 'react'
import { initSyncEngine } from '@/lib/sync-engine'
import { OfflineIndicator } from '@/components/app/offline-indicator'

/**
 * SyncProvider — initializes the offline sync engine and shows
 * the offline indicator when the user is not connected.
 */
export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
    const cleanup = initSyncEngine()
    return cleanup
  }, [])

  return (
    <>
      {children}
      {mounted && <OfflineIndicator />}
    </>
  )
}
