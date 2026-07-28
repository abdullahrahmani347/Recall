/**
 * Recall Collaboration Service — Phase 3
 *
 * WebSocket (socket.io) service that powers real-time collaboration:
 *   - Presence: who's currently viewing/editing each note
 *   - Live cursors: collaborator cursor positions in the note textarea
 *   - Content broadcast: when one user edits, others get a "note-updated" event
 *     so they can refresh (last-write-wins, per the Phase 1 storage decision).
 *   - Comment events: new/resolved comments broadcast to all viewers.
 *
 * Auth: clients send their userId + a signed session token on join. We trust
 * the Next.js app's httpOnly cookie for the real auth decision; this service
 * only needs to know "is this a valid user id" to broadcast presence. In a
 * production deployment, the gateway would verify the JWT before forwarding.
 *
 * The service is intentionally stateless beyond in-memory presence maps —
 * all persistent state lives in the Postgres/SQLite database via the main app.
 */

import { createServer } from 'http'
import { Server, type Socket } from 'socket.io'

interface PresenceUser {
  socketId: string
  userId: string
  name: string
  color: string // assigned per-session for cursor rendering
  cursor: { line: number; col: number } | null
  lastActive: number
}

interface NoteRoom {
  noteId: string
  users: Map<string, PresenceUser> // keyed by socketId
}

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// In-memory room registry: noteId → NoteRoom
const rooms = new Map<string, NoteRoom>()

// Per-socket lookup: socketId → { noteId, userId } for fast disconnect cleanup
const socketIndex = new Map<string, { noteId: string; userId: string }>()

// Color palette for cursor assignment — cycles through these per-join
const CURSOR_COLORS = [
  '#34E7A8', '#FFB454', '#4C8CFF', '#F5A623',
  '#E94560', '#7C5CFF', '#00D9FF', '#FF6B9D',
]
let colorIdx = 0

function getRoom(noteId: string): NoteRoom {
  let room = rooms.get(noteId)
  if (!room) {
    room = { noteId, users: new Map() }
    rooms.set(noteId, room)
  }
  return room
}

function broadcastPresence(noteId: string) {
  const room = rooms.get(noteId)
  if (!room) return
  const present = Array.from(room.users.values()).map((u) => ({
    userId: u.userId,
    name: u.name,
    color: u.color,
    cursor: u.cursor,
  }))
  io.to(`note:${noteId}`).emit('presence', { noteId, users: present })
}

io.on('connection', (socket: Socket) => {
  console.log(`[collab] connected: ${socket.id}`)

  socket.on(
    'join-note',
    (payload: { noteId: string; userId: string; name: string }) => {
      const { noteId, userId, name } = payload
      if (!noteId || !userId) return

      // Leave any previous note room
      const prev = socketIndex.get(socket.id)
      if (prev) {
        const prevRoom = rooms.get(prev.noteId)
        if (prevRoom) {
          prevRoom.users.delete(socket.id)
          if (prevRoom.users.size === 0) {
            rooms.delete(prev.noteId)
          } else {
            broadcastPresence(prev.noteId)
          }
        }
        socket.leave(`note:${prev.noteId}`)
      }

      // Join the new note room
      const room = getRoom(noteId)
      const color = CURSOR_COLORS[colorIdx++ % CURSOR_COLORS.length]
      room.users.set(socket.id, {
        socketId: socket.id,
        userId,
        name: name || 'Anonymous',
        color,
        cursor: null,
        lastActive: Date.now(),
      })
      socketIndex.set(socket.id, { noteId, userId })
      socket.join(`note:${noteId}`)

      // Send the current presence roster to the joiner
      broadcastPresence(noteId)
      console.log(`[collab] ${name} joined note:${noteId} (${room.users.size} viewers)`)
    }
  )

  socket.on(
    'cursor',
    (payload: { noteId: string; line: number; col: number }) => {
      const idx = socketIndex.get(socket.id)
      if (!idx || idx.noteId !== payload.noteId) return
      const room = rooms.get(payload.noteId)
      if (!room) return
      const user = room.users.get(socket.id)
      if (!user) return
      user.cursor = { line: payload.line, col: payload.col }
      user.lastActive = Date.now()
      // Broadcast cursor update to everyone else in the room
      socket.to(`note:${payload.noteId}`).emit('cursor', {
        userId: user.userId,
        name: user.name,
        color: user.color,
        cursor: user.cursor,
      })
    }
  )

  socket.on(
    'note-updated',
    (payload: { noteId: string; userId: string; title: string; contentMarkdown: string }) => {
      // Broadcast to other viewers that the note was edited — they can refresh
      socket.to(`note:${payload.noteId}`).emit('note-updated', {
        noteId: payload.noteId,
        userId: payload.userId,
        updatedAt: new Date().toISOString(),
      })
    }
  )

  socket.on(
    'comment',
    (payload: { noteId: string; userId: string; commentId: string; action: 'added' | 'resolved' | 'deleted' }) => {
      socket.to(`note:${payload.noteId}`).emit('comment', {
        noteId: payload.noteId,
        ...payload,
        at: new Date().toISOString(),
      })
    }
  )

  socket.on('leave-note', () => {
    const idx = socketIndex.get(socket.id)
    if (!idx) return
    const room = rooms.get(idx.noteId)
    if (room) {
      room.users.delete(socket.id)
      if (room.users.size === 0) {
        rooms.delete(idx.noteId)
      } else {
        broadcastPresence(idx.noteId)
      }
    }
    socket.leave(`note:${idx.noteId}`)
    socketIndex.delete(socket.id)
  })

  socket.on('disconnect', () => {
    const idx = socketIndex.get(socket.id)
    if (idx) {
      const room = rooms.get(idx.noteId)
      if (room) {
        room.users.delete(socket.id)
        if (room.users.size === 0) {
          rooms.delete(idx.noteId)
        } else {
          broadcastPresence(idx.noteId)
        }
      }
      socketIndex.delete(socket.id)
    }
    console.log(`[collab] disconnected: ${socket.id}`)
  })

  socket.on('error', (error: unknown) => {
    console.error(`[collab] socket error (${socket.id}):`, error)
  })
})

// Periodic cleanup of stale presence entries (no activity in 5 min)
setInterval(() => {
  const now = Date.now()
  for (const [noteId, room] of rooms) {
    for (const [socketId, user] of room.users) {
      if (now - user.lastActive > 5 * 60 * 1000) {
        // Force-disconnect the stale socket
        const s = io.sockets.sockets.get(socketId)
        if (s) s.disconnect(true)
      }
    }
  }
}, 60 * 1000)

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`[collab] Recall collaboration service running on port ${PORT}`)
})

process.on('SIGTERM', () => {
  console.log('[collab] SIGTERM received, shutting down...')
  httpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  console.log('[collab] SIGINT received, shutting down...')
  httpServer.close(() => process.exit(0))
})
