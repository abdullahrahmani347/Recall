import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, badRequest } from '@/lib/api-helpers'
import { review, type Grade, type SchedulingState } from '@/lib/fsrs'
import { z } from 'zod'

const schema = z.object({
  grade: z.enum(['again', 'hard', 'good', 'easy']),
})

/**
 * POST /api/sections/[id]/review
 * Grades an article section for spaced repetition (incremental reading).
 * Creates or updates the SectionSchedule using FSRS.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id: sectionId } = await params
  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = schema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  // Verify ownership
  const section = await db.articleSection.findFirst({
    where: { id: sectionId, article: { userId: user!.id } },
  })
  if (!section) return NextResponse.json({ error: 'Section not found' }, { status: 404 })

  const grade = parsed.data.grade as Grade
  const now = new Date()

  // Get or create schedule
  let existing = await db.sectionSchedule.findUnique({ where: { sectionId } })
  if (!existing) {
    existing = await db.sectionSchedule.create({
      data: { sectionId, dueDate: now },
    })
  }

  // Build SchedulingState for the review function
  const stateForReview: SchedulingState | null = existing.lastReviewedAt
    ? {
        dueDate: existing.dueDate,
        stability: existing.stability,
        difficulty: existing.difficulty,
        interval: existing.interval,
        repetitions: existing.repetitions,
        lapses: existing.lapses,
        lastReviewedAt: existing.lastReviewedAt,
      }
    : null

  // Compute next schedule using FSRS
  const result = review(stateForReview, grade, now)

  const updated = await db.sectionSchedule.update({
    where: { sectionId },
    data: {
      dueDate: result.state.dueDate,
      stability: result.state.stability,
      difficulty: result.state.difficulty,
      interval: result.state.interval,
      repetitions: result.state.repetitions,
      lapses: result.state.lapses,
      lastReviewedAt: now,
    },
  })

  // Mark section as read
  await db.articleSection.update({
    where: { id: sectionId },
    data: { isRead: true },
  })

  return NextResponse.json({
    dueDate: updated.dueDate,
    interval: updated.interval,
    repetitions: updated.repetitions,
  })
}
