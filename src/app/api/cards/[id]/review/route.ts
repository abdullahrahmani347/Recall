import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, notFound } from '@/lib/api-helpers'
import { review as fsrsReview, type Grade, type SchedulingState } from '@/lib/fsrs'

type Params = { params: Promise<{ id: string }> }

const gradeSchema = (
  body: unknown
): { grade?: Grade; responseTimeMs?: number; error?: string } => {
  if (typeof body !== 'object' || body === null) return { error: 'Invalid JSON' }
  const b = body as Record<string, unknown>
  const grade = b.grade as string
  if (!['again', 'hard', 'good', 'easy'].includes(grade)) {
    return { error: 'Invalid grade (must be again|hard|good|easy)' }
  }
  const responseTimeMs =
    typeof b.responseTimeMs === 'number' && b.responseTimeMs >= 0
      ? Math.min(b.responseTimeMs, 5 * 60 * 1000)
      : 0
  return { grade: grade as Grade, responseTimeMs }
}

/**
 * POST /api/cards/[id]/review
 * Body: { grade: 'again'|'hard'|'good'|'easy', responseTimeMs?: number }
 * Updates the card's SchedulingState using FSRS and appends a ReviewLog row.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const card = await db.flashcard.findFirst({
    where: { id },
    include: {
      deck: { select: { userId: true } },
      schedulingState: true,
    },
  })
  if (!card || card.deck.userId !== user!.id) return notFound('Card not found')

  const body = await req.json().catch(() => null)
  const parsed = gradeSchema(body)
  if (parsed.error || !parsed.grade) {
    return NextResponse.json({ error: parsed.error ?? 'Invalid grade' }, { status: 400 })
  }

  const now = new Date()
  const currentState: SchedulingState | null = card.schedulingState
    ? {
        dueDate: card.schedulingState.dueDate,
        stability: card.schedulingState.stability,
        difficulty: card.schedulingState.difficulty,
        interval: card.schedulingState.interval,
        repetitions: card.schedulingState.repetitions,
        lapses: card.schedulingState.lapses,
        lastReviewedAt: card.schedulingState.lastReviewedAt,
      }
    : null

  const result = fsrsReview(currentState, parsed.grade, now)

  // Upsert the scheduling state
  if (card.schedulingState) {
    await db.schedulingState.update({
      where: { cardId: id },
      data: {
        dueDate: result.state.dueDate,
        stability: result.state.stability,
        difficulty: result.state.difficulty,
        interval: result.state.interval,
        repetitions: result.state.repetitions,
        lapses: result.state.lapses,
        lastReviewedAt: result.state.lastReviewedAt,
      },
    })
  } else {
    await db.schedulingState.create({
      data: {
        cardId: id,
        dueDate: result.state.dueDate,
        stability: result.state.stability,
        difficulty: result.state.difficulty,
        interval: result.state.interval,
        repetitions: result.state.repetitions,
        lapses: result.state.lapses,
        lastReviewedAt: result.state.lastReviewedAt,
      },
    })
  }

  // Append-only review log (audit trail)
  await db.reviewLog.create({
    data: {
      cardId: id,
      userId: user!.id,
      reviewedAt: now,
      grade: parsed.grade,
      previousInterval: result.previousInterval,
      newInterval: result.newInterval,
      responseTimeMs: parsed.responseTimeMs ?? 0,
    },
  })

  return NextResponse.json({
    state: {
      cardId: id,
      dueDate: result.state.dueDate,
      stability: result.state.stability,
      difficulty: result.state.difficulty,
      interval: result.state.interval,
      repetitions: result.state.repetitions,
      lapses: result.state.lapses,
      lastReviewedAt: result.state.lastReviewedAt,
    },
    previousInterval: result.previousInterval,
    newInterval: result.newInterval,
  })
}
