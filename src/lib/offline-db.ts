import Dexie, { type Table } from 'dexie'

/**
 * Offline note cache — stores notes locally in IndexedDB for offline access.
 * When the user is offline, the app reads from this cache. When online,
 * changes are synced back to the server via the sync queue.
 */

export interface CachedNote {
  id: string
  title: string
  contentMarkdown: string
  contentPlainText: string
  isArchived: boolean
  isPinned: boolean
  updatedAt: string
  notebookId: string | null
  // Sync metadata
  _syncStatus: 'synced' | 'pending' | 'conflict'
  _localUpdatedAt: number // Date.now() when last edited locally
}

export interface SyncQueueItem {
  id?: number
  action: 'create' | 'update' | 'delete'
  entityType: 'note' | 'deck' | 'card'
  entityId: string
  payload: any
  createdAt: number
  retries: number
}

export class RecallDB extends Dexie {
  notes!: Table<CachedNote, string>
  syncQueue!: Table<SyncQueueItem, number>

  constructor() {
    super('recall-db')
    this.version(1).stores({
      notes: 'id, updatedAt, _syncStatus, _localUpdatedAt',
      syncQueue: '++id, action, entityType, entityId, createdAt',
    })
  }
}

let dbInstance: RecallDB | null = null

export function getDB(): RecallDB {
  if (!dbInstance) {
    dbInstance = new RecallDB()
  }
  return dbInstance
}

/**
 * Cache a note in IndexedDB (called after fetching from server).
 */
export async function cacheNote(note: CachedNote): Promise<void> {
  try {
    await getDB().notes.put(note)
  } catch (e) {
    console.error('Failed to cache note:', e)
  }
}

/**
 * Cache multiple notes at once.
 */
export async function cacheNotes(notes: CachedNote[]): Promise<void> {
  try {
    await getDB().notes.bulkPut(notes)
  } catch (e) {
    console.error('Failed to cache notes:', e)
  }
}

/**
 * Get a note from the cache.
 */
export async function getCachedNote(id: string): Promise<CachedNote | undefined> {
  try {
    return await getDB().notes.get(id)
  } catch {
    return undefined
  }
}

/**
 * Get all cached notes (for offline browsing).
 */
export async function getAllCachedNotes(): Promise<CachedNote[]> {
  try {
    return await getDB().notes.where('_syncStatus').notEqual('deleted').toArray()
  } catch {
    return []
  }
}

/**
 * Update a note locally and add to sync queue.
 */
export async function updateNoteLocally(
  id: string,
  changes: Partial<CachedNote>
): Promise<void> {
  const db = getDB()
  const existing = await db.notes.get(id)
  if (!existing) return

  const updated: CachedNote = {
    ...existing,
    ...changes,
    _syncStatus: 'pending',
    _localUpdatedAt: Date.now(),
  }

  await db.notes.put(updated)
  await db.syncQueue.add({
    action: 'update',
    entityType: 'note',
    entityId: id,
    payload: changes,
    createdAt: Date.now(),
    retries: 0,
  })
}

/**
 * Create a note locally (offline).
 */
export async function createNoteLocally(note: CachedNote): Promise<void> {
  const db = getDB()
  note._syncStatus = 'pending'
  note._localUpdatedAt = Date.now()
  await db.notes.put(note)
  await db.syncQueue.add({
    action: 'create',
    entityType: 'note',
    entityId: note.id,
    payload: note,
    createdAt: Date.now(),
    retries: 0,
  })
}

/**
 * Get pending sync items.
 */
export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  try {
    return await getDB().syncQueue.toArray()
  } catch {
    return []
  }
}

/**
 * Remove a sync item after successful sync.
 */
export async function removeSyncItem(id: number): Promise<void> {
  try {
    await getDB().syncQueue.delete(id)
  } catch (e) {
    console.error('Failed to remove sync item:', e)
  }
}

/**
 * Mark a note as synced.
 */
export async function markNoteSynced(id: string): Promise<void> {
  try {
    await getDB().notes.update(id, { _syncStatus: 'synced' })
  } catch (e) {
    console.error('Failed to mark note as synced:', e)
  }
}

/**
 * Clear all cached data (on logout).
 */
export async function clearCache(): Promise<void> {
  try {
    await getDB().delete()
    dbInstance = null
  } catch (e) {
    console.error('Failed to clear cache:', e)
  }
}
