import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'

/**
 * GET /api/forecast
 * Returns upcoming review load for the next 14 days + completion estimates.
 *
 * Computes:
 * - dailyDue: array of { date, count } for next 14 days
 * - totalDue: total cards due across all decks
 * - todayCount: cards due today
 * - tomorrowCount: cards due tomorrow
 * - nextHeavyDay: the day with the most cards due (date + count)
 * - estimatedDaysToClear: at current pace (avg reviews/day over last 7 days),
 *   how many days until all currently-due cards are cleared
 */
export async function GET() {
  const { user, response } = await requireUser()
  if (response) return response

  // Get all cards with their scheduling state
  const cards = await db.flashcard.findMany({
    where: { deck: { userId: user!.id } },
    select: {
      schedulingState: { select: { dueDate: true } },
    },
  })

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  // Build 14-day forecast
  const dailyDue: { date: string; count: number }[] = []
  for (let i = 0; i < 14; i++) {
    const day = new Date(now)
    day.setDate(day.getDate() + i)
    const nextDay = new Date(day)
    nextDay.setDate(nextDay.getDate() + 1)

    const count = cards.filter((c) => {
      if (!c.schedulingState) return i === 0 // never reviewed = due today
      const due = new Date(c.schedulingState.dueDate)
      return due >= day && due < nextDay
    }).length

    dailyDue.push({
      date: day.toISOString().slice(0, 10),
      count,
    })
  }

  // Total due (all cards with dueDate <= now or never reviewed)
  const totalDue = cards.filter((c) => {
    if (!c.schedulingState) return true
    return c.schedulingState.dueDate <= new Date()
  }).length

  // Today and tomorrow counts
  const todayCount = dailyDue[0]?.count ?? 0
  const tomorrowCount = dailyDue[1]?.count ?? 0

  // Next heavy day (max count in the forecast, excluding today)
  let nextHeavyDay: { date: string; count: number } | null = null
  for (let i = 1; i < dailyDue.length; i++) {
    if (!nextHeavyDay || dailyDue[i].count > nextHeavyDay.count) {
      nextHeavyDay = dailyDue[i]
    }
  }

  // Average reviews/day over last 7 days
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const recentReviews = await db.reviewLog.count({
    where: {
      userId: user!.id,
      reviewedAt: { gte: sevenDaysAgo },
    },
  })
  const avgPerDay = recentReviews / 7

  // Estimated days to clear current backlog
  const estimatedDaysToClear = avgPerDay > 0
    ? Math.ceil(totalDue / avgPerDay)
    : null

  return NextResponse.json({
    dailyDue,
    totalDue,
    todayCount,
    tomorrowCount,
    nextHeavyDay: nextHeavyDay && nextHeavyDay.count > 0 ? nextHeavyDay : null,
    avgPerDay: Math.round(avgPerDay * 10) / 10,
    estimatedDaysToClear,
  })
}
