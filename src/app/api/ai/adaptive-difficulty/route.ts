import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'

/**
 * GET /api/ai/adaptive-difficulty
 *
 * Analyzes each card's review history (response time + grade patterns)
 * and returns adaptive difficulty suggestions.
 *
 * Logic:
 * - If avg response time < 3000ms AND grade is usually "easy" → suggest "too easy"
 * - If avg response time > 20000ms OR grade is usually "again" → suggest "too hard"
 * - If response time is decreasing over time → "improving"
 * - Otherwise → "on track"
 *
 * Returns { cards: [{ id, front, avgResponseTimeMs, lastGrade, suggestion, confidence }] }
 */
export async function GET() {
  const { user, response } = await requireUser()
  if (response) return response

  // Get all cards with their review logs (last 10 per card)
  const cards = await db.flashcard.findMany({
    where: { deck: { userId: user!.id } },
    include: {
      reviewLogs: {
        orderBy: { reviewedAt: 'desc' },
        take: 10,
      },
    },
    take: 200, // limit to prevent huge queries
  })

  const suggestions = cards
    .filter((c) => c.reviewLogs.length > 0)
    .map((c) => {
      const logs = c.reviewLogs
      const avgResponseMs = logs.reduce((s, l) => s + l.responseTimeMs, 0) / logs.length
      const easyCount = logs.filter((l) => l.grade === 'easy').length
      const againCount = logs.filter((l) => l.grade === 'again').length
      const goodCount = logs.filter((l) => l.grade === 'good').length
      const lastGrade = logs[0]?.grade || 'good'

      // Check if response time is trending down (improving)
      const recentAvg = logs.slice(0, 3).reduce((s, l) => s + l.responseTimeMs, 0) / Math.min(3, logs.length)
      const olderAvg = logs.slice(3).length > 0
        ? logs.slice(3).reduce((s, l) => s + l.responseTimeMs, 0) / logs.slice(3).length
        : recentAvg
      const improving = recentAvg < olderAvg * 0.8

      let suggestion: 'too-easy' | 'too-hard' | 'improving' | 'on-track'
      let confidence: number // 0-1

      if (avgResponseMs < 3000 && easyCount / logs.length > 0.5) {
        suggestion = 'too-easy'
        confidence = Math.min(0.95, 0.5 + (easyCount / logs.length) * 0.5)
      } else if (avgResponseMs > 20000 || againCount / logs.length > 0.4) {
        suggestion = 'too-hard'
        confidence = Math.min(0.95, 0.4 + (againCount / logs.length) * 0.6)
      } else if (improving) {
        suggestion = 'improving'
        confidence = 0.7
      } else {
        suggestion = 'on-track'
        confidence = 0.6
      }

      return {
        id: c.id,
        front: c.front.slice(0, 80),
        avgResponseTimeMs: Math.round(avgResponseMs),
        reviewCount: logs.length,
        lastGrade,
        easyRatio: Math.round((easyCount / logs.length) * 100),
        againRatio: Math.round((againCount / logs.length) * 100),
        goodRatio: Math.round((goodCount / logs.length) * 100),
        suggestion,
        confidence: Math.round(confidence * 100) / 100,
      }
    })
    .filter((s) => s.suggestion !== 'on-track') // only show actionable suggestions

  return NextResponse.json({
    cards: suggestions,
    total: suggestions.length,
  })
}
