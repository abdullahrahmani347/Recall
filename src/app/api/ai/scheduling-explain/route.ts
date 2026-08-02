import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, notFound } from '@/lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/ai/scheduling-explain?cardId=xxx
 *
 * Explains WHY a card is due today using its FSRS scheduling state:
 * - Last reviewed date
 * - Current stability, difficulty, interval
 * - Estimated recall probability right now
 * - What happens if delayed by 1 day
 *
 * This is pure computation (no LLM call) — the FSRS formula is
 * deterministic, so we can compute the explanation locally.
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const url = new URL(req.url)
  const cardId = url.searchParams.get('cardId')
  if (!cardId) return notFound('cardId required')

  const card = await db.flashcard.findFirst({
    where: { id: cardId },
    include: {
      schedulingState: true,
      deck: { select: { userId: true } },
    },
  })
  if (!card || card.deck.userId !== user!.id) return notFound('Card not found')

  const s = card.schedulingState
  if (!s) {
    return NextResponse.json({
      explanation: 'This card has never been reviewed. It\'s due now so you can start learning it.',
      isNew: true,
    })
  }

  const now = new Date()
  const lastReviewed = s.lastReviewedAt ? new Date(s.lastReviewedAt) : null
  const elapsedDays = lastReviewed
    ? Math.round((now.getTime() - lastReviewed.getTime()) / (1000 * 60 * 60 * 24))
    : 0

  // FSRS retrievability formula: R = (1 + t/(9*s))^(-1)
  const stability = s.stability
  const retrievability = Math.pow(1 + elapsedDays / (9 * stability), -1)
  const recallPct = Math.round(retrievability * 100)

  // What if delayed by 1 more day?
  const tomorrowElapsed = elapsedDays + 1
  const tomorrowR = Math.pow(1 + tomorrowElapsed / (9 * stability), -1)
  const tomorrowPct = Math.round(tomorrowR * 100)
  const dropPct = recallPct - tomorrowPct

  // Difficulty description
  const difficultyDesc =
    s.difficulty < 3 ? 'easy for you' :
    s.difficulty < 6 ? 'moderate' :
    s.difficulty < 8 ? 'challenging' :
    'very difficult'

  // Build the explanation
  const parts: string[] = []

  if (lastReviewed) {
    parts.push(`You last reviewed this card ${elapsedDays} day${elapsedDays === 1 ? '' : 's'} ago.`)
  }

  parts.push(`Its stability is ${stability.toFixed(1)} (how durable the memory is) and difficulty is ${s.difficulty.toFixed(1)} (${difficultyDesc}).`)

  parts.push(`Right now, your probability of recalling this correctly is approximately ${recallPct}%.`)

  if (dropPct > 0) {
    parts.push(`If you delay by one more day, that drops to ${tomorrowPct}% (a ${dropPct} percentage point loss).`)
  }

  if (s.lapses > 0) {
    parts.push(`You've forgotten this card ${s.lapses} time${s.lapses === 1 ? '' : 's'} before — reviewing it now while it's still somewhat fresh is optimal.`)
  }

  parts.push(`The FSRS scheduler set the interval to ${Math.round(s.interval)} day${Math.round(s.interval) === 1 ? '' : 's'} based on your past ${s.repetitions} review${s.repetitions === 1 ? '' : 's'}.`)

  return NextResponse.json({
    explanation: parts.join(' '),
    stats: {
      stability: Number(stability.toFixed(2)),
      difficulty: Number(s.difficulty.toFixed(2)),
      interval: Math.round(s.interval),
      repetitions: s.repetitions,
      lapses: s.lapses,
      elapsedDays,
      recallProbability: recallPct,
      tomorrowProbability: tomorrowPct,
      dropIfDelayed: dropPct,
    },
  })
}
