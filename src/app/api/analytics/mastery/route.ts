import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'

/**
 * GET /api/analytics/mastery
 * Returns subject mastery data as a radar chart format.
 *
 * Groups cards by deck (subject) and computes mastery score per deck:
 * - Retention rate (correct / total reviews)
 * - Coverage (learned cards / total cards)
 * - Stability (avg stability of scheduled cards)
 *
 * Returns: { subjects: [{ name, mastery, retention, coverage, stability, cardCount }] }
 */
export async function GET() {
  const { user, response } = await requireUser()
  if (response) return response

  const decks = await db.deck.findMany({
    where: { userId: user!.id },
    include: {
      flashcards: {
        include: {
          schedulingState: true,
          reviewLogs: { select: { grade: true } },
        },
      },
    },
  })

  const subjects = decks.map((deck) => {
    const cards = deck.flashcards
    const totalCards = cards.length
    const learnedCards = cards.filter((c) => c.schedulingState && c.schedulingState.repetitions > 0).length
    const scheduledCards = cards.filter((c) => c.schedulingState)

    // Retention: from review logs
    const allLogs = cards.flatMap((c) => c.reviewLogs)
    const correctLogs = allLogs.filter((l) => l.grade === 'good' || l.grade === 'easy').length
    const retentionRate = allLogs.length > 0 ? (correctLogs / allLogs.length) * 100 : 0

    // Stability: average of all scheduled cards
    const avgStability = scheduledCards.length > 0
      ? scheduledCards.reduce((s, c) => s + (c.schedulingState?.stability || 0), 0) / scheduledCards.length
      : 0

    // Coverage: learned / total
    const coverage = totalCards > 0 ? (learnedCards / totalCards) * 100 : 0

    // Mastery: weighted combination (40% retention + 40% coverage + 20% stability)
    const stabilityScore = Math.min(100, avgStability * 20) // stability ~5 days → 100
    const mastery = Math.round(retentionRate * 0.4 + coverage * 0.4 + stabilityScore * 0.2)

    return {
      name: deck.name,
      color: deck.color,
      mastery,
      retention: Math.round(retentionRate),
      coverage: Math.round(coverage),
      stability: Math.round(avgStability * 100) / 100,
      cardCount: totalCards,
      learnedCards,
    }
  })

  return NextResponse.json({
    subjects: subjects.sort((a, b) => b.mastery - a.mastery),
    averageMastery: subjects.length > 0
      ? Math.round(subjects.reduce((s, sub) => s + sub.mastery, 0) / subjects.length)
      : 0,
  })
}
