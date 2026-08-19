import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'

/**
 * GET /api/analytics/compare?range=week|month
 * Compares current period stats vs previous period.
 *
 * For range=week: compares last 7 days vs the 7 days before that.
 * For range=month: compares last 30 days vs the 30 days before that.
 *
 * Returns: { current: {...}, previous: {...}, changes: {...} }
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const url = new URL(req.url)
  const range = url.searchParams.get('range') ?? 'week'
  const days = range === 'month' ? 30 : 7

  const now = new Date()
  const currentStart = new Date(now)
  currentStart.setDate(currentStart.getDate() - days)
  const previousStart = new Date(currentStart)
  previousStart.setDate(previousStart.getDate() - days)

  const [currentLogs, previousLogs] = await Promise.all([
    db.reviewLog.findMany({
      where: { userId: user!.id, reviewedAt: { gte: currentStart } },
      select: { grade: true, responseTimeMs: true, reviewedAt: true },
    }),
    db.reviewLog.findMany({
      where: { userId: user!.id, reviewedAt: { gte: previousStart, lt: currentStart } },
      select: { grade: true, responseTimeMs: true, reviewedAt: true },
    }),
  ])

  const computeStats = (logs: typeof currentLogs) => {
    const total = logs.length
    const correct = logs.filter((l) => l.grade === 'good' || l.grade === 'easy').length
    const again = logs.filter((l) => l.grade === 'again').length
    const avgMs = total > 0 ? Math.round(logs.reduce((s, l) => s + l.responseTimeMs, 0) / total) : 0
    const uniqueDays = new Set(logs.map((l) => l.reviewedAt.toISOString().slice(0, 10))).size
    const retentionRate = total > 0 ? Math.round((correct / total) * 100) : 0

    // Per-day average
    const dayBuckets = new Map<string, number>()
    for (const log of logs) {
      const dayKey = log.reviewedAt.toISOString().slice(0, 10)
      dayBuckets.set(dayKey, (dayBuckets.get(dayKey) || 0) + 1)
    }
    const avgPerDay = dayBuckets.size > 0 ? Math.round(total / dayBuckets.size) : 0

    return {
      totalReviews: total,
      correctReviews: correct,
      againReviews: again,
      retentionRate,
      avgResponseMs: avgMs,
      avgPerDay,
      activeDays: uniqueDays,
    }
  }

  const current = computeStats(currentLogs)
  const previous = computeStats(previousLogs)

  const changes = {
    totalReviews: current.totalReviews - previous.totalReviews,
    retentionRate: current.retentionRate - previous.retentionRate,
    avgResponseMs: current.avgResponseMs - previous.avgResponseMs,
    avgPerDay: current.avgPerDay - previous.avgPerDay,
    activeDays: current.activeDays - previous.activeDays,
  }

  return NextResponse.json({
    range,
    current,
    previous,
    changes,
    trend: changes.totalReviews > 0 ? 'up' : changes.totalReviews < 0 ? 'down' : 'flat',
  })
}
