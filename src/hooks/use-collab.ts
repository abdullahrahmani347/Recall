'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, type Socket } from 'socket.io-client'
import type { PresenceUser } from '@/lib/types'

/**
 * useCollab — socket.io hook for real-time note collaboration.
 *
 * Connects to the collab mini-service on port 3003 (via the Caddy gateway's
 * XTransformPort mechanism). Manages:
 *   - Joining/leaving the note's "room"
 *   - Tracking presence (who else is viewing)
 *   - Broadcasting + receiving live cursor positions
 *   - Broadcasting + receiving note-updated events (so other viewers see edits)
 *   - Broadcasting + receiving comment events
 *
 * The socket is created lazily — only when `noteId` is non-null — and
 * cleaned up on unmount or when noteId changes.
 */
export function useCollab(
  noteId: string | null,
  user: { id: string; name: string | null } | null,
  options: {
    onNoteUpdated?: (payload: { userId: string; updatedAt: string }) => void
    onComment?: (payload: { commentId: string; action: 'added' | 'resolved' | 'deleted' }) => void
  } = {}
) {
  const [isConnected, setIsConnected] = useState(false)
  const [presence, setPresence] = useState<PresenceUser[]>([])
  const [cursors, setCursors] = useState<
    Record<string, PresenceUser & { cursor: { line: number; col: number } }>
  >({})
  const socketRef = useRef<Socket | null>(null)
  // Store latest callbacks in a ref so the effect doesn't re-run when the
  // parent re-renders with new closure identities. Updated via useEffect.
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })

  // Connect + join the note room
  useEffect(() => {
    if (!noteId || !user) return

    // Connect via the gateway with XTransformPort
    const socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      setIsConnected(true)
      socket.emit('join-note', {
        noteId,
        userId: user.id,
        name: user.name ?? 'Anonymous',
      })
    })

    socket.on('disconnect', () => {
      setIsConnected(false)
      setPresence([])
      setCursors({})
    })

    socket.on('connect_error', () => {
      setIsConnected(false)
    })

    // Presence roster updates
    socket.on('presence', (payload: { noteId: string; users: PresenceUser[] }) => {
      if (payload.noteId !== noteId) return
      setPresence(payload.users)
      // Prune cursors for users no longer present
      const presentIds = new Set(payload.users.map((u) => u.userId))
      setCursors((prev) => {
        const next: typeof prev = {}
        for (const [id, c] of Object.entries(prev)) {
          if (presentIds.has(id)) next[id] = c
        }
        return next
      })
    })

    // Individual cursor updates
    socket.on('cursor', (payload: PresenceUser & { cursor: { line: number; col: number } }) => {
      if (payload.userId === user.id) return // ignore our own
      setCursors((prev) => ({ ...prev, [payload.userId]: payload }))
    })

    // Note-updated broadcast from another viewer
    socket.on('note-updated', (payload: { userId: string; updatedAt: string }) => {
      if (payload.userId === user.id) return
      optionsRef.current.onNoteUpdated?.(payload)
    })

    // Comment events
    socket.on('comment', (payload: { commentId: string; action: 'added' | 'resolved' | 'deleted' }) => {
      optionsRef.current.onComment?.(payload)
    })

    return () => {
      socket.emit('leave-note')
      socket.disconnect()
      socketRef.current = null
      setIsConnected(false)
      setPresence([])
      setCursors({})
    }
  }, [noteId, user?.id, user?.name])

  // Broadcast cursor position (throttled by the caller)
  const sendCursor = useCallback(
    (line: number, col: number) => {
      if (!noteId || !user || !socketRef.current?.connected) return
      socketRef.current.emit('cursor', { noteId, line, col })
    },
    [noteId, user]
  )

  // Broadcast that we edited the note (so others can refresh)
  const broadcastNoteUpdate = useCallback(
    () => {
      if (!noteId || !user || !socketRef.current?.connected) return
      socketRef.current.emit('note-updated', {
        noteId,
        userId: user.id,
        title: '',
        contentMarkdown: '',
      })
    },
    [noteId, user]
  )

  // Broadcast a comment event
  const broadcastComment = useCallback(
    (commentId: string, action: 'added' | 'resolved' | 'deleted') => {
      if (!noteId || !user || !socketRef.current?.connected) return
      socketRef.current.emit('comment', { noteId, userId: user.id, commentId, action })
    },
    [noteId, user]
  )

  return {
    isConnected,
    presence,
    cursors,
    sendCursor,
    broadcastNoteUpdate,
    broadcastComment,
  }
}
