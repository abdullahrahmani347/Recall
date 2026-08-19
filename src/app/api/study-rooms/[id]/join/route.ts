import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/study-rooms/[id]/join
 * Join a public study room.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const room = await db.studyRoom.findUnique({
    where: { id },
    include: { _count: { select: { members: true } } },
  })

  if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 })
  if (room.status !== 'waiting') return NextResponse.json({ error: 'Room is not open for joining' }, { status: 400 })
  if (room._count.members >= room.maxMembers) return NextResponse.json({ error: 'Room is full' }, { status: 400 })

  // Check if already a member
  const existing = await db.studyRoomMember.findUnique({
    where: { roomId_userId: { roomId: id, userId: user!.id } },
  })

  if (existing) {
    return NextResponse.json({ ok: true, message: 'Already a member' })
  }

  await db.studyRoomMember.create({
    data: { roomId: id, userId: user!.id, role: 'member' },
  })

  return NextResponse.json({ ok: true, message: `Joined ${room.name}` }, { status: 201 })
}
