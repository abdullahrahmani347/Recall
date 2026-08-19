import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'

/**
 * GET /api/analytics/time-of-day
 * Returns a 24-hour heatmap of review performance.
 * Shows: for each hour (0-23), how many reviews + average correctness.
 *
 * Helps identify optimal study times.
 */
export async function GET() {
  const { user, response } = await requireUser()
  if (response) return response

  const logs = await db.reviewLog.findMany({
    where: { userId: user!.id },
    select: { reviewedAt: true, grade: true, responseTimeMs: true },
  })

  // Build 24-hour buckets
  const hours = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    totalReviews: 0,
    correct: 0,
    again: 0,
    avgResponseMs: 0,
    responseTimes: [] as number[],
  }))

  for (const log of logs) {
    const hour = log.reviewedAt.getHours()
    const bucket = hours[hour]
    bucket.totalReviews++
    if (log.grade === 'good' || log.grade === 'easy') bucket.correct++
    if (log.grade === 'again') bucket.again++
    if (log.responseTimeMs > 0) bucket.responseTimes.push(log.responseTimeMs)
  }

  // Calculate averages
  const heatmap = hours.map((h) => {
    const avgMs = h.responseTimes.length > 0
      ? Math.round(h.responseTimes.reduce((s, t) => s + t, 0) / h.responseTimes.length)
      : 0
    const retentionRate = h.totalReviews > 0 ? Math.round((h.correct / h.totalReviews) * 100) : 0
    return {
      hour: h.hour,
      label: `${h.hour.toString().padStart(2, '0')}:00`,
      totalReviews: h.totalReviews,
      correct: h.correct,
      again: h.again,
      retentionRate,
      avgResponseMs: avgMs,
    }
  })

  // Find peak hours (top 3 by review count)
  const peakHours = [...heatmap]
    .filter((h) => h.totalReviews > 0)
    .sort((a, b) => b.totalReviews - a.totalReviews)
    .slice(0, 3)
    .map((h) => h.hour)

  // Find best performance hours (top 3 by retention, min 5 reviews)
  const bestHours = [...heatmap]
    .filter((h) => h.totalReviews >= 5)
    .sort((a, b) => b.retentionRate - a.retentionRate)
    .slice(0, 3)
    .map((h) => h.hour)

  return NextResponse.json({
    heatmap,
    peakHours,
    bestHours,
    totalReviews: logs.length,
    summary: {
      morning: heatmap.slice(5, 12).reduce((s, h) => s + h.totalReviews, 0),
      afternoon: heatmap.slice(12, 18).reduce((s, h) => s + h.totalReviews, 0),
      evening: heatmap.slice(18, 24).reduce((s, h) => s + h.totalReviews, 0),
      night: [...heatmap.slice(0, 5)].reduce((s, h) => s + h.totalReviews, 0),
    },
  })
}
