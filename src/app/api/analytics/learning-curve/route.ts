import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'

/**
 * GET /api/analytics/learning-curve?deckId=...&limit=20
 * Returns forgetting curve data per card — shows how retention
 * decays over time based on the FSRS stability/difficulty parameters.
 *
 * For each card, we compute a projected forgetting curve:
 * - stability → how fast memory decays
 * - difficulty → affects the curve shape
 * - last interval → current position on the curve
 *
 * Returns: { cards: [{ id, front, stability, difficulty, interval, projectedRetention: [{ days, retention }] }] }
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const url = new URL(req.url)
  const deckId = url.searchParams.get('deckId')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 50)

  const cards = await db.flashcard.findMany({
    where: {
      deck: { userId: user!.id },
      ...(deckId ? { deckId } : {}),
      schedulingState: { isNot: null },
    },
    include: {
      schedulingState: true,
      deck: { select: { name: true } },
    },
    orderBy: { schedulingState: { stability: 'asc' } },
    take: limit,
  })

  const curves = cards.map((c) => {
    const s = c.schedulingState!
    const stability = s.stability || 0.4
    const difficulty = s.difficulty || 0.5

    // FSRS retention formula: R(t) = exp(-t / stability)
    // Modified by difficulty: higher difficulty → faster decay
    const adjustedStability = stability * (1.5 - difficulty) // easier cards decay slower
    const days = Array.from({ length: 30 }, (_, i) => i) // 0-29 days
    const projectedRetention = days.map((day) => ({
      day,
      retention: Math.round(Math.exp(-day / Math.max(adjustedStability, 0.01)) * 100),
    }))

    return {
      id: c.id,
      front: c.front.slice(0, 60),
      deckName: c.deck.name,
      stability: Math.round(stability * 100) / 100,
      difficulty: Math.round(difficulty * 100) / 100,
      interval: s.interval,
      repetitions: s.repetitions,
      lapses: s.lapses,
      currentRetention: projectedRetention[0].retention, // day 0 = today
      projectedRetention,
    }
  })

  return NextResponse.json({ cards: curves, total: curves.length })
}
