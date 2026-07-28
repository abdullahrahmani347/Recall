import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, badRequest } from '@/lib/api-helpers'
import { z } from 'zod'

const createDeckSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  color: z.string().max(20).optional(),
})

export async function GET() {
  const { user, response } = await requireUser()
  if (response) return response

  const decks = await db.deck.findMany({
    where: { userId: user!.id },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { flashcards: true } },
      flashcards: {
        select: { schedulingState: { select: { dueDate: true } } },
      },
    },
  })

  const now = new Date()
  return NextResponse.json({
    decks: decks.map((d) => ({
      id: d.id,
      userId: d.userId,
      name: d.name,
      description: d.description,
      color: d.color,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      cardCount: d._count.flashcards,
      dueCount: d.flashcards.filter((f) => {
        if (!f.schedulingState) return true // never reviewed → due now
        return f.schedulingState.dueDate <= now
      }).length,
    })),
  })
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = createDeckSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  const deck = await db.deck.create({
    data: {
      userId: user!.id,
      name: parsed.data.name,
      description: parsed.data.description ?? '',
      color: parsed.data.color ?? '#34E7A8',
    },
  })
  return NextResponse.json({ deck }, { status: 201 })
}
