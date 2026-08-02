import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'

/**
 * GET /api/ai/knowledge-gaps
 * Finds cards the user has struggled with — high lapse counts, low
 * retention, repeatedly graded "again". Returns the card + its source
 * note (if any) so the UI can suggest "revisit the source note."
 */
export async function GET() {
  const { user, response } = await requireUser()
  if (response) return response

  // Find cards with 2+ lapses, sorted by lapses desc
  const struggling = await db.flashcard.findMany({
    where: {
      deck: { userId: user!.id },
      schedulingState: { lapses: { gte: 2 } },
    },
    include: {
      schedulingState: true,
      deck: { select: { id: true, name: true, color: true } },
      sourceNote: {
        select: { id: true, title: true, contentPlainText: true },
      },
    },
    orderBy: {
      schedulingState: { lapses: 'desc' },
    },
    take: 10,
  })

  const gaps = struggling.map((card) => {
    const lapses = card.schedulingState?.lapses ?? 0
    const reps = card.schedulingState?.repetitions ?? 0
    const retentionRate = reps > 0 ? Math.round(((reps - lapses) / reps) * 100) : 0

    return {
      cardId: card.id,
      front: card.front.slice(0, 120),
      back: card.back.slice(0, 120),
      deckName: card.deck.name,
      deckColor: card.deck.color,
      lapses,
      repetitions: reps,
      retentionRate,
      sourceNote: card.sourceNote
        ? {
            id: card.sourceNote.id,
            title: card.sourceNote.title,
          }
        : null,
      lastReviewedAt: card.schedulingState?.lastReviewedAt ?? null,
    }
  })

  return NextResponse.json({ gaps })
}
