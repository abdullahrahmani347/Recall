import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'

/**
 * GET /api/stats
 * Aggregated counts for the home screen: notes count, decks count,
 * due cards today, reviewed-today count, current streak (consecutive
 * days with at least one review).
 */
export async function GET() {
  const { user, response } = await requireUser()
  if (response) return response

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const [noteCount, deckCount, cardCount, todayReviews] = await Promise.all([
    db.note.count({ where: { userId: user!.id, isArchived: false } }),
    db.deck.count({ where: { userId: user!.id } }),
    db.flashcard.count({ where: { deck: { userId: user!.id } } }),
    db.reviewLog.count({
      where: { userId: user!.id, reviewedAt: { gte: startOfToday } },
    }),
  ])

  // Due cards (across all decks)
  const dueCards = await db.flashcard.findMany({
    where: { deck: { userId: user!.id } },
    select: { schedulingState: { select: { dueDate: true } } },
  })
  const dueCount = dueCards.filter(
    (c) => !c.schedulingState || c.schedulingState.dueDate <= now
  ).length

  // Streak: walk back day-by-day from today, count consecutive days with ≥1 review
  const allReviews = await db.reviewLog.findMany({
    where: { userId: user!.id },
    select: { reviewedAt: true },
    orderBy: { reviewedAt: 'desc' },
  })

  let streak = 0
  if (allReviews.length > 0) {
    const reviewDays = new Set(
      allReviews.map((r) => {
        const d = new Date(r.reviewedAt)
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      })
    )
    const cursor = new Date(startOfToday)
    // If user hasn't reviewed today, allow streak to continue from yesterday
    const todayKey = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`
    if (!reviewDays.has(todayKey)) {
      cursor.setDate(cursor.getDate() - 1)
    }
    // Get streak freeze info — if a freeze was used, skip one missing day
    const settings = await db.settings.findUnique({ where: { userId: user!.id } })
    let freezeUsed = false
    while (true) {
      const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`
      if (reviewDays.has(key)) {
        streak++
        cursor.setDate(cursor.getDate() - 1)
      } else if (!freezeUsed && settings?.lastFreezeDate) {
        // Check if this missed day matches the freeze date
        const freezeDate = settings.lastFreezeDate
        const cursorDateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
        if (cursorDateStr === freezeDate) {
          // Skip this day — freeze protects it
          freezeUsed = true
          cursor.setDate(cursor.getDate() - 1)
          continue
        }
        break
      } else {
        break
      }
    }
  }

  const settingsData = await db.settings.findUnique({ where: { userId: user!.id } })

  return NextResponse.json({
    noteCount,
    deckCount,
    cardCount,
    dueCount,
    todayReviews,
    streak,
    streakFreezes: settingsData?.streakFreezes ?? 0,
  })
}
