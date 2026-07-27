import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, notFound, badRequest } from '@/lib/api-helpers'
import { z } from 'zod'

const createCardSchema = z.object({
  cardType: z.enum(['basic', 'cloze']).default('basic'),
  front: z.string().min(1).max(5000),
  back: z.string().min(1).max(5000),
  sourceNoteId: z.string().nullable().optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const deck = await db.deck.findFirst({ where: { id, userId: user!.id } })
  if (!deck) return notFound('Deck not found')

  const cards = await db.flashcard.findMany({
    where: { deckId: id },
    include: { schedulingState: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({ cards })
}

export async function POST(req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const deck = await db.deck.findFirst({ where: { id, userId: user!.id } })
  if (!deck) return notFound('Deck not found')

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = createCardSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  // Validate sourceNoteId ownership if provided
  if (parsed.data.sourceNoteId) {
    const note = await db.note.findFirst({
      where: { id: parsed.data.sourceNoteId, userId: user!.id },
    })
    if (!note) return badRequest('Invalid source note')
  }

  const card = await db.flashcard.create({
    data: {
      deckId: id,
      sourceNoteId: parsed.data.sourceNoteId ?? null,
      cardType: parsed.data.cardType,
      front: parsed.data.front,
      back: parsed.data.back,
      schedulingState: { create: {} }, // default state — due now
    },
    include: { schedulingState: true },
  })

  return NextResponse.json({ card }, { status: 201 })
}
