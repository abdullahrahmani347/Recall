import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, badRequest } from '@/lib/api-helpers'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  deckId: z.string().optional(),
  isPublic: z.boolean().default(true),
  maxMembers: z.number().int().min(2).max(50).default(10),
})

/**
 * GET /api/study-rooms?status=waiting|active
 * List public study rooms.
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const url = new URL(req.url)
  const status = url.searchParams.get('status') || 'waiting'

  const rooms = await db.studyRoom.findMany({
    where: { status, isPublic: true },
    include: {
      hostUser: { select: { id: true, name: true, avatarUrl: true } },
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  return NextResponse.json({
    rooms: rooms.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      host: r.hostUser,
      memberCount: r._count.members,
      maxMembers: r.maxMembers,
      status: r.status,
      deckId: r.deckId,
      createdAt: r.createdAt,
    })),
  })
}

/**
 * POST /api/study-rooms
 * Create a new study room.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  const room = await db.studyRoom.create({
    data: {
      hostUserId: user!.id,
      name: parsed.data.name,
      description: parsed.data.description || '',
      deckId: parsed.data.deckId || null,
      isPublic: parsed.data.isPublic,
      maxMembers: parsed.data.maxMembers,
    },
  })

  // Host is automatically a member
  await db.studyRoomMember.create({
    data: {
      roomId: room.id,
      userId: user!.id,
      role: 'host',
    },
  })

  return NextResponse.json({
    id: room.id,
    name: room.name,
    status: room.status,
    message: 'Study room created!',
  }, { status: 201 })
}
