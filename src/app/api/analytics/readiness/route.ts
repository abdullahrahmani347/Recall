import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'

/**
 * GET /api/analytics/readiness?examDate=2024-01-15&deckIds=...
 * Returns a predicted exam readiness score based on:
 *
 * 1. Retention rate — how well you remember reviewed cards
 * 2. Coverage — how many cards you've learned vs total
 * 3. Due load — how many cards are due now (high due = behind)
 * 4. Stability trend — are your cards getting more stable?
 *
 * Score: 0-100 (0 = not ready, 100 = fully prepared)
 */
export async function GET(req: Request) {
  const { user, response } = await requireUser()
  if (response) return response

  const url = new URL(req.url)
  const examDateParam = url.searchParams.get('examDate')
  const deckIdsParam = url.searchParams.get('deckIds')

  if (!examDateParam) {
    return NextResponse.json({ error: 'examDate is required (YYYY-MM-DD)' }, { status: 400 })
  }

  const examDate = new Date(examDateParam)
  const daysUntilExam = Math.max(1, Math.ceil((examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))

  const deckFilter = deckIdsParam
    ? { id: { in: deckIdsParam.split(',') }, userId: user!.id }
    : { userId: user!.id }

  const cards = await db.flashcard.findMany({
    where: { deck: deckFilter as any },
    include: {
      schedulingState: true,
      reviewLogs: { select: { grade: true, reviewedAt: true } },
    },
  })

  if (cards.length === 0) {
    return NextResponse.json({ error: 'No cards found' }, { status: 400 })
  }

  // 1. Coverage: learned cards / total
  const learnedCards = cards.filter((c) => c.schedulingState && c.schedulingState.repetitions > 0).length
  const coverage = (learnedCards / cards.length) * 100

  // 2. Retention: from review logs
  const allLogs = cards.flatMap((c) => c.reviewLogs)
  const correctLogs = allLogs.filter((l) => l.grade === 'good' || l.grade === 'easy').length
  const retentionRate = allLogs.length > 0 ? (correctLogs / allLogs.length) * 100 : 0

  // 3. Due load: cards due now (high due = behind on reviews)
  const now = new Date()
  const dueCards = cards.filter((c) => {
    if (!c.schedulingState) return true // never reviewed = due
    return c.schedulingState.dueDate <= now
  }).length
  const dueRate = (dueCards / cards.length) * 100
  const duePenalty = Math.min(100, dueRate) // more due = lower readiness

  // 4. Stability: average stability of learned cards
  const scheduledCards = cards.filter((c) => c.schedulingState)
  const avgStability = scheduledCards.length > 0
    ? scheduledCards.reduce((s, c) => s + (c.schedulingState!.stability || 0), 0) / scheduledCards.length
    : 0
  const stabilityScore = Math.min(100, avgStability * 15)

  // 5. Days until exam factor — more time = more readiness opportunity
  const timeFactor = Math.min(1, daysUntilExam / 14) // 14+ days = full time factor

  // Final score: weighted combination
  // - 35% coverage (have you learned everything?)
  // - 30% retention (do you remember what you learned?)
  // - 20% stability (is your memory strong?)
  // - 15% due penalty (are you behind on reviews?)
  const readiness = Math.round(
    coverage * 0.35 +
    retentionRate * 0.30 +
    stabilityScore * 0.20 +
    (100 - duePenalty) * 0.15
  )

  // Per-deck breakdown
  const deckBreakdown = new Map<string, { name: string; total: number; learned: number; due: number; retention: number }>()

  for (const card of cards) {
    const key = card.deckId
    if (!deckBreakdown.has(key)) {
      deckBreakdown.set(key, { name: key, total: 0, learned: 0, due: 0, retention: 0 })
    }
    const entry = deckBreakdown.get(key)!
    entry.total++
    if (card.schedulingState && card.schedulingState.repetitions > 0) entry.learned++
    if (!card.schedulingState || card.schedulingState.dueDate <= now) entry.due++
    const logs = card.reviewLogs
    const correct = logs.filter((l) => l.grade === 'good' || l.grade === 'easy').length
    entry.retention = logs.length > 0 ? (correct / logs.length) * 100 : 0
  }

  // Get deck names
  const decks = await db.deck.findMany({
    where: { id: { in: Array.from(deckBreakdown.keys()) } },
    select: { id: true, name: true },
  })
  const deckNames = new Map(decks.map((d) => [d.id, d.name]))

  const breakdown = Array.from(deckBreakdown.entries()).map(([id, data]) => ({
    deckId: id,
    deckName: deckNames.get(id) || 'Unknown',
    totalCards: data.total,
    learnedCards: data.learned,
    dueCards: data.due,
    retention: Math.round(data.retention),
    coverage: Math.round((data.learned / data.total) * 100),
  }))

  // Recommendations
  const recommendations: string[] = []
  if (coverage < 50) recommendations.push('You haven\'t learned half the cards yet. Focus on new cards.')
  if (retentionRate < 70) recommendations.push('Your retention is below 70%. Review difficult cards more frequently.')
  if (dueRate > 40) recommendations.push(`${dueCards} cards are due. Clear your review queue before learning new cards.`)
  if (avgStability < 2) recommendations.push('Your memory stability is low. Cards will be forgotten quickly — review more.')
  if (daysUntilExam <= 7 && dueCards > 0) recommendations.push('Exam is soon! Switch to cram mode for due cards.')
  if (readiness >= 80) recommendations.push('You\'re well prepared! Do a final review pass on weak areas.')

  return NextResponse.json({
    readiness,
    daysUntilExam,
    metrics: {
      coverage: Math.round(coverage),
      retentionRate: Math.round(retentionRate),
      avgStability: Math.round(avgStability * 100) / 100,
      totalCards: cards.length,
      learnedCards,
      dueCards,
      dueRate: Math.round(dueRate),
    },
    breakdown,
    recommendations,
    timeFactor: Math.round(timeFactor * 100),
  })
}
