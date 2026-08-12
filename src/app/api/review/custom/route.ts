import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'

/**
 * GET /api/review/custom?mode=cram|ahead|weak|tag&deckId=&tag=&days=1
 *
 * Modes:
 * - cram: all cards in a deck (or all decks), regardless of schedule
 * - ahead: cards due within the next N days (default 1)
 * - weak: cards with 3+ lapses
 * - tag: all cards from notes with a specific tag
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const url = new URL(req.url)
  const mode = url.searchParams.get('mode') ?? 'cram'
  const deckId = url.searchParams.get('deckId')
  const tag = url.searchParams.get('tag')
  const days = parseInt(url.searchParams.get('days') ?? '1', 10)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200)

  const now = new Date()
  const futureDate = new Date(now)
  futureDate.setDate(futureDate.getDate() + days)

  let whereClause: Record<string, unknown> = {
    deck: { userId: user!.id },
  }

  if (deckId) {
    whereClause = { ...whereClause, deckId }
  }

  if (mode === 'cram') {
    // All cards in the deck, regardless of schedule
  } else if (mode === 'ahead') {
    // Cards due within the next N days (including currently due)
    whereClause = {
      ...whereClause,
      OR: [
        { schedulingState: null },
        { schedulingState: { dueDate: { lte: futureDate } } },
      ],
    }
  } else if (mode === 'weak') {
    // Cards with 3+ lapses
    whereClause = {
      ...whereClause,
      schedulingState: { lapses: { gte: 3 } },
    }
  } else if (mode === 'tag' && tag) {
    // Cards from notes with the specified tag
    whereClause = {
      ...whereClause,
      sourceNote: { tags: { some: { tag: { name: tag } } } },
    }
  }

  const cards = await db.flashcard.findMany({
    where: { ...whereClause, isSuspended: false, isBuried: false },
    include: {
      schedulingState: true,
      deck: { select: { id: true, name: true, color: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return NextResponse.json({
    cards: cards.map((c) => ({
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
    })),
    total: cards.length,
    mode,
  })
}
