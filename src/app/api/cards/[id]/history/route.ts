import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, notFound } from '@/lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/cards/[id]/history
 * Returns the last 10 review logs for a card.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const card = await db.flashcard.findFirst({
    where: { id },
    include: { deck: { select: { userId: true } } },
  })
  if (!card || card.deck.userId !== user!.id) return notFound('Card not found')

  const logs = await db.reviewLog.findMany({
    where: { cardId: id, userId: user!.id },
    orderBy: { reviewedAt: 'desc' },
    take: 10,
    select: {
      id: true,
      reviewedAt: true,
      grade: true,
      previousInterval: true,
      newInterval: true,
      responseTimeMs: true,
    },
  })

  return NextResponse.json({ history: logs })
}
