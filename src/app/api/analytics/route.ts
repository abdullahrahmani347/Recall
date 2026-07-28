import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'

interface DayBucket {
  date: string // YYYY-MM-DD
  reviewed: number
  correct: number // good + easy
  again: number
  newCards: number
}

interface GradeDistribution {
  again: number
  hard: number
  good: number
  easy: number
}

interface DeckStat {
  id: string
  name: string
  color: string
  totalCards: number
  dueCards: number
  matureCards: number // interval > 21 days
  youngCards: number // interval 1–21 days
}

/**
 * GET /api/analytics?range=30d|90d|365d
 *
 * Returns:
 * - dailyBuckets: per-day review counts + correct/again split for the range
 * - retentionRate: overall (correct / total) for the range
 * - gradeDistribution: again/hard/good/easy tally
 * - streak: current consecutive-day streak
 * - totalReviews: all-time
 * - deckStats: per-deck maturity breakdown
 * - avgResponseTimeMs: mean per-card response time
 */
export async function GET(req: Request) {
  const { user, response } = await requireUser()
  if (response) return response

  const url = new URL(req.url)
  const range = url.searchParams.get('range') ?? '30d'
  const days = range === '90d' ? 90 : range === '365d' ? 365 : 30

  const now = new Date()
  const start = new Date(now)
  start.setDate(start.getDate() - days)
  start.setHours(0, 0, 0, 0)

  // Fetch review logs for the range
  const logs = await db.reviewLog.findMany({
    where: { userId: user!.id, reviewedAt: { gte: start } },
    select: { reviewedAt: true, grade: true, responseTimeMs: true, cardId: true },
    orderBy: { reviewedAt: 'asc' },
  })

  // Build daily buckets
  const bucketMap = new Map<string, DayBucket>()
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    bucketMap.set(key, {
      date: key,
      reviewed: 0,
      correct: 0,
      again: 0,
      newCards: 0,
    })
  }

  const gradeDist: GradeDistribution = { again: 0, hard: 0, good: 0, easy: 0 }
  let totalResponseTime = 0
  let responseCount = 0

  // Track first-seen cards for "newCards" metric
  const seenCards = new Set<string>()

  for (const log of logs) {
    const key = log.reviewedAt.toISOString().slice(0, 10)
    const bucket = bucketMap.get(key)
    if (!bucket) continue

    bucket.reviewed++
    if (log.grade === 'good' || log.grade === 'easy') bucket.correct++
    if (log.grade === 'again') bucket.again++
    if (!seenCards.has(log.cardId)) {
      seenCards.add(log.cardId)
      bucket.newCards++
    }

    gradeDist[log.grade as keyof GradeDistribution]++
    if (log.responseTimeMs > 0 && log.responseTimeMs < 5 * 60 * 1000) {
      totalResponseTime += log.responseTimeMs
      responseCount++
    }
  }

  const dailyBuckets = Array.from(bucketMap.values())
  const totalReviews = logs.length
  const totalCorrect = dailyBuckets.reduce((s, b) => s + b.correct, 0)
  const retentionRate = totalReviews > 0 ? totalCorrect / totalReviews : 0

  // Current streak: walk back from today
  const allLogs = await db.reviewLog.findMany({
    where: { userId: user!.id },
    select: { reviewedAt: true },
    orderBy: { reviewedAt: 'desc' },
  })
  let streak = 0
  if (allLogs.length > 0) {
    const reviewDays = new Set(
      allLogs.map((r) => r.reviewedAt.toISOString().slice(0, 10))
    )
    const cursor = new Date()
    cursor.setHours(0, 0, 0, 0)
    const todayKey = cursor.toISOString().slice(0, 10)
    if (!reviewDays.has(todayKey)) {
      cursor.setDate(cursor.getDate() - 1)
    }
    while (true) {
      const key = cursor.toISOString().slice(0, 10)
      if (reviewDays.has(key)) {
        streak++
        cursor.setDate(cursor.getDate() - 1)
      } else break
    }
  }

  // Per-deck stats
  const decks = await db.deck.findMany({
    where: { userId: user!.id },
    include: {
      flashcards: {
        select: {
          schedulingState: { select: { dueDate: true, interval: true } },
        },
      },
    },
  })

  const deckStats: DeckStat[] = decks.map((d) => {
    const nowMs = Date.now()
    let due = 0
    let mature = 0
    let young = 0
    for (const f of d.flashcards) {
      const s = f.schedulingState
      if (!s) {
        due++
        continue
      }
      if (s.dueDate.getTime() <= nowMs) due++
      if (s.interval > 21) mature++
      else if (s.interval >= 1) young++
    }
    return {
      id: d.id,
      name: d.name,
      color: d.color,
      totalCards: d.flashcards.length,
      dueCards: due,
      matureCards: mature,
      youngCards: young,
    }
  })

  return NextResponse.json({
    range,
    days,
    dailyBuckets,
    retentionRate: Number(retentionRate.toFixed(4)),
    totalReviews,
    gradeDistribution: gradeDist,
    streak,
    avgResponseTimeMs: responseCount > 0 ? Math.round(totalResponseTime / responseCount) : 0,
    deckStats,
  })
}
