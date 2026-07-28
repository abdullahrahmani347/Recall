import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, badRequest } from '@/lib/api-helpers'
import { z } from 'zod'

const bulkSchema = z.object({
  deckId: z.string(),
  cards: z
    .array(
      z.object({
        front: z.string().min(1).max(5000),
        back: z.string().min(1).max(5000),
        sourceNoteId: z.string().optional(),
      })
    )
    .min(1)
    .max(50),
})

/**
 * POST /api/cards/bulk
 * Body: { deckId, cards: [{ front, back, sourceNoteId? }] }
 *
 * Creates multiple flashcards in a single transaction. Used by the
 * "Generate cards from this note" flow — the user reviews AI suggestions
 * and accepts a subset, which is then bulk-created in their chosen deck.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = bulkSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
  }

  const { deckId, cards } = parsed.data

  // Validate deck ownership
  const deck = await db.deck.findFirst({ where: { id: deckId, userId: user!.id } })
  if (!deck) return badRequest('Invalid deck')

  // Validate sourceNoteId ownership if provided
  const validNoteIds = new Set<string>()
  const notesWithSource = cards.filter((c) => c.sourceNoteId)
  if (notesWithSource.length > 0) {
    const notes = await db.note.findMany({
      where: {
        id: { in: notesWithSource.map((c) => c.sourceNoteId!) },
        userId: user!.id,
      },
      select: { id: true },
    })
    notes.forEach((n) => validNoteIds.add(n.id))
  }

  const created = await db.$transaction(
    cards.map((card) =>
      db.flashcard.create({
        data: {
          deckId,
          sourceNoteId:
            card.sourceNoteId && validNoteIds.has(card.sourceNoteId)
              ? card.sourceNoteId
              : null,
          cardType: 'basic',
          front: card.front,
          back: card.back,
          schedulingState: { create: {} },
        },
        select: { id: true },
      })
    )
  )

  return NextResponse.json({ created: created.length, ids: created.map((c) => c.id) }, { status: 201 })
}
