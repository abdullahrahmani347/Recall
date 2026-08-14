'use client'

import { getPendingSyncItems, removeSyncItem, markNoteSynced, type SyncQueueItem } from './offline-db'
import { api } from './api-client'

/**
 * Sync Engine — processes the offline sync queue when the user comes back online.
 *
 * Flow:
 * 1. Check if online (navigator.onLine)
 * 2. Get pending sync items from IndexedDB
 * 3. For each item, attempt the API call
 * 4. On success, remove from queue and mark as synced
 * 5. On failure, increment retry count (max 5 retries)
 */

let isSyncing = false
const MAX_RETRIES = 5

export async function processSyncQueue(): Promise<{ synced: number; failed: number }> {
  if (isSyncing) return { synced: 0, failed: 0 }
  if (typeof window === 'undefined' || !navigator.onLine) return { synced: 0, failed: 0 }

  isSyncing = true
  let synced = 0
  let failed = 0

  try {
    const items = await getPendingSyncItems()

    for (const item of items) {
      if (item.retries >= MAX_RETRIES) {
        // Remove items that have exceeded max retries
        if (item.id) await removeSyncItem(item.id)
        failed++
        continue
      }

      try {
        await processSyncItem(item)
        if (item.id) await removeSyncItem(item.id)
        synced++
      } catch (err) {
        console.error(`Sync failed for ${item.entityType} ${item.entityId}:`, err)
        failed++
        // Increment retry count
        if (item.id) {
          const { getDB } = await import('./offline-db')
          await getDB().syncQueue.update(item.id, { retries: item.retries + 1 })
        }
      }
    }
  } finally {
    isSyncing = false
  }

  if (synced > 0) {
    console.log(`[sync] Synced ${synced} items, ${failed} failed`)
  }

  return { synced, failed }
}

async function processSyncItem(item: SyncQueueItem): Promise<void> {
  const { action, entityType, entityId, payload } = item

  if (entityType === 'note') {
    if (action === 'create' || action === 'update') {
      try {
        await api(`/api/notes/${entityId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: payload.title,
            contentMarkdown: payload.contentMarkdown,
          }),
        })
        await markNoteSynced(entityId)
      } catch (err) {
        // If the note doesn't exist on the server (was created offline),
        // try creating it instead
        if (action === 'create') {
          await api('/api/notes', {
            method: 'POST',
            body: JSON.stringify({
              title: payload.title || 'Untitled',
              contentMarkdown: payload.contentMarkdown || '',
            }),
          })
          await markNoteSynced(entityId)
        } else {
          throw err
        }
      }
    } else if (action === 'delete') {
      await api(`/api/notes/${entityId}`, { method: 'DELETE' })
    }
  }
}

/**
 * Start the sync engine — listens for online events and processes
 * the queue periodically.
 */
export function initSyncEngine(): () => void {
  if (typeof window === 'undefined') return () => {}

  const onOnline = () => {
    console.log('[sync] Back online, processing sync queue...')
    processSyncQueue()
  }

  // Process queue every 60 seconds when online
  const interval = setInterval(() => {
    if (navigator.onLine) {
      processSyncQueue()
    }
  }, 60_000)

  window.addEventListener('online', onOnline)

  // Process any pending items on load
  processSyncQueue()

  return () => {
    window.removeEventListener('online', onOnline)
    clearInterval(interval)
  }
}
