import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/study-rooms/[id]
 * Get study room details with members.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const room = await db.studyRoom.findUnique({
    where: { id },
    include: {
      hostUser: { select: { id: true, name: true, avatarUrl: true } },
      members: {
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
  })

  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  if (!room.isPublic) {
    const isMember = room.members.some(m => m.userId === user!.id)
    if (!isMember) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  return NextResponse.json({
    id: room.id,
    name: room.name,
    description: room.description,
    host: room.hostUser,
    status: room.status,
    isPublic: room.isPublic,
    maxMembers: room.maxMembers,
    deckId: room.deckId,
    startedAt: room.startedAt,
    members: room.members.map(m => ({
      id: m.userId,
      name: m.user.name,
      avatarUrl: m.user.avatarUrl,
      role: m.role,
      joinedAt: m.joinedAt,
    })),
  })
}

/**
 * DELETE /api/study-rooms/[id]
 * End a study room (host only).
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const room = await db.studyRoom.findUnique({ where: { id } })
  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  if (room.hostUserId !== user!.id) return NextResponse.json({ error: 'Only the host can end the room' }, { status: 403 })

  await db.studyRoom.update({
    where: { id },
    data: { status: 'completed', endedAt: new Date() },
  })

  return NextResponse.json({ ok: true, message: 'Study room ended' })
}
