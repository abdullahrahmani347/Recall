import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'

/**
 * GET /api/social/leaderboard?range=weekly|monthly|alltime
 * Returns a leaderboard of users ranked by review count + streak.
 * Only shows users who have opted into social (have at least 1 review log).
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const url = new URL(req.url)
  const range = url.searchParams.get('range') ?? 'weekly'

  const now = new Date()
  const startDate = new Date(now)
  if (range === 'weekly') startDate.setDate(startDate.getDate() - 7)
  else if (range === 'monthly') startDate.setMonth(startDate.getMonth() - 1)
  else startDate.setMonth(startDate.getMonth() - 12) // all-time = last 12 months

  // Aggregate reviews per user in the range
  const reviewLogs = await db.reviewLog.findMany({
    where: { reviewedAt: { gte: startDate } },
    select: { userId: true, grade: true, responseTimeMs: true, reviewedAt: true },
  })

  // Build per-user stats
  const userStats = new Map<string, { reviews: number; correct: number; streak: number }>()

  for (const log of reviewLogs) {
    const stats = userStats.get(log.userId) || { reviews: 0, correct: 0, streak: 0 }
    stats.reviews++
    if (log.grade === 'good' || log.grade === 'easy') stats.correct++
    userStats.set(log.userId, stats)
  }

  // Calculate streaks per user (simple: count distinct days in the range)
  const userDays = new Map<string, Set<string>>()
  for (const log of reviewLogs) {
    const dayKey = log.reviewedAt.toISOString().slice(0, 10)
    if (!userDays.has(log.userId)) userDays.set(log.userId, new Set())
    userDays.get(log.userId)!.add(dayKey)
  }

  // Get user info for top users
  const topUserIds = Array.from(userStats.entries())
    .sort((a, b) => b[1].reviews - a[1].reviews)
    .slice(0, 50)
    .map(([id]) => id)

  const users = await db.user.findMany({
    where: { id: { in: topUserIds } },
    select: { id: true, name: true, email: true, avatarUrl: true },
  })

  const userMap = new Map(users.map(u => [u.id, u]))

  const leaderboard = topUserIds.map((id, i) => {
    const stats = userStats.get(id)!
    const days = userDays.get(id)?.size || 0
    const u = userMap.get(id)
    return {
      rank: i + 1,
      id,
      name: u?.name || 'Anonymous',
      email: u?.email,
      avatarUrl: u?.avatarUrl,
      reviews: stats.reviews,
      correct: stats.correct,
      retentionRate: stats.reviews > 0 ? Math.round((stats.correct / stats.reviews) * 100) : 0,
      streakDays: days,
      isCurrentUser: id === user!.id,
    }
  })

  return NextResponse.json({ leaderboard, range })
}
