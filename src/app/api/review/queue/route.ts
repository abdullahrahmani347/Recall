import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'

/**
 * GET /api/review/queue?deckId=...
 * Returns due cards (dueDate <= now OR never reviewed), ranked:
 *   1. Lapsed cards (lapses > 0) first
 *   2. Overdue cards by due date ascending
 *   3. Never-reviewed cards
 *
 * Caps to the user's `dailyReviewLimit` setting by default.
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const url = new URL(req.url)
  const deckId = url.searchParams.get('deckId')
  const limitParam = url.searchParams.get('limit')
  const settings = await db.settings.findUnique({ where: { userId: user!.id } })
  const limit = limitParam
    ? Math.min(parseInt(limitParam, 10) || 50, 200)
    : Math.min(settings?.dailyReviewLimit ?? 50, 200)

  const now = new Date()
  const cards = await db.flashcard.findMany({
    where: {
      ...(deckId ? { deckId } : { deck: { userId: user!.id } }),
      deck: { userId: user!.id },
    },
    include: {
      schedulingState: true,
      deck: { select: { id: true, name: true, color: true } },
    },
  })

  const due = cards
    .filter((c) => {
      if (!c.schedulingState) return true // never reviewed
      return c.schedulingState.dueDate <= now
    })
    .map((c) => ({
      id: c.id,
      deckId: c.deckId,
      sourceNoteId: c.sourceNoteId,
      cardType: c.cardType,
      front: c.front,
      back: c.back,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      deck: c.deck,
      schedulingState: c.schedulingState
        ? {
            cardId: c.schedulingState.cardId,
            dueDate: c.schedulingState.dueDate,
            stability: c.schedulingState.stability,
            difficulty: c.schedulingState.difficulty,
            interval: c.schedulingState.interval,
            repetitions: c.schedulingState.repetitions,
            lapses: c.schedulingState.lapses,
            lastReviewedAt: c.schedulingState.lastReviewedAt,
          }
        : null,
    }))
    .sort((a, b) => {
      // Lapsed first
      const aL = a.schedulingState?.lapses ?? 0
      const bL = b.schedulingState?.lapses ?? 0
      if (aL > 0 && bL === 0) return -1
      if (bL > 0 && aL === 0) return 1
      // Then by due date (never-reviewed treated as earliest)
      const aD = a.schedulingState?.dueDate?.getTime() ?? 0
      const bD = b.schedulingState?.dueDate?.getTime() ?? 0
      return aD - bD
    })
    .slice(0, limit)

  return NextResponse.json({ cards: due, total: due.length })
}
