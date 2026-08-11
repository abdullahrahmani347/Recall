import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, badRequest } from '@/lib/api-helpers'
import { z } from 'zod'

const schema = z.object({
  deckId: z.string(),
  imageUrl: z.string(),
  occlusions: z.array(z.object({
    id: z.string(), x: z.number(), y: z.number(), w: z.number(), h: z.number(), label: z.string().default(''),
  })).min(1).max(20),
})

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response
  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = schema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
  const { deckId, imageUrl, occlusions } = parsed.data
  const deck = await db.deck.findFirst({ where: { id: deckId, userId: user!.id } })
  if (!deck) return badRequest('Invalid deck')
  const created: string[] = []
  for (const occ of occlusions) {
    const card = await db.flashcard.create({
      data: {
        deckId, cardType: 'image-occlusion', front: imageUrl,
        back: occ.label || `Region at (${occ.x.toFixed(0)}, ${occ.y.toFixed(0)})`,
        imageUrl, occlusions: JSON.stringify(occ),
      },
    })
    await db.schedulingState.create({ data: { cardId: card.id } })
    created.push(card.id)
  }
  return NextResponse.json({ created: created.length, ids: created }, { status: 201 })
}
