import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'

/**
 * POST /api/streak/freeze
 * Uses a streak freeze if the user missed yesterday and has freezes available.
 * This prevents the streak from resetting to zero.
 *
 * Logic:
 * - Check if user reviewed yesterday. If yes, no freeze needed.
 * - Check if user reviewed today. If yes, streak is safe.
 * - If user missed yesterday AND has a freeze available, consume it.
 * - Grant 1 new freeze every 7 days (max 1 stored).
 */
export async function POST() {
  const { user, response } = await requireUser()
  if (response) return response

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)

  const settings = await db.settings.findUnique({ where: { userId: user!.id } })
  if (!settings) return NextResponse.json({ error: 'Settings not found' }, { status: 404 })

  // Get all review logs
  const logs = await db.reviewLog.findMany({
    where: { userId: user!.id },
    select: { reviewedAt: true },
  })

  const reviewDays = new Set(
    logs.map((r) => {
      const d = new Date(r.reviewedAt)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })
  )

  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const yesterdayKey = `${startOfYesterday.getFullYear()}-${String(startOfYesterday.getMonth() + 1).padStart(2, '0')}-${String(startOfYesterday.getDate()).padStart(2, '0')}`

  const reviewedToday = reviewDays.has(todayKey)
  const reviewedYesterday = reviewDays.has(yesterdayKey)

  // If reviewed yesterday or today, no freeze needed
  if (reviewedYesterday || reviewedToday) {
    return NextResponse.json({ freezeUsed: false, message: 'No freeze needed', streakFreezes: settings.streakFreezes })
  }

  // User missed yesterday — check if we can use a freeze
  if (settings.streakFreezes > 0 && settings.lastFreezeDate !== yesterdayKey) {
    await db.settings.update({
      where: { userId: user!.id },
      data: {
        streakFreezes: settings.streakFreezes - 1,
        lastFreezeDate: yesterdayKey,
      },
    })
    return NextResponse.json({
      freezeUsed: true,
      message: 'Streak freeze used! Your streak is protected.',
      streakFreezes: settings.streakFreezes - 1,
    })
  }

  // No freeze available
  return NextResponse.json({
    freezeUsed: false,
    message: 'No streak freeze available. Streak may have reset.',
    streakFreezes: settings.streakFreezes,
  })
}

/**
 * GET /api/streak/freeze
 * Returns the user's current streak freeze count and whether a freeze
 * would be applied if they missed today.
 */
export async function GET() {
  const { user, response } = await requireUser()
  if (response) return response

  const settings = await db.settings.findUnique({ where: { userId: user!.id } })
  if (!settings) return NextResponse.json({ error: 'Settings not found' }, { status: 404 })

  // Grant a new freeze every 7 days since last freeze use (max 1 stored)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  let freezes = settings.streakFreezes
  let granted = false

  if (settings.lastFreezeDate) {
    const lastFreeze = new Date(settings.lastFreezeDate)
    const daysSinceFreeze = Math.floor((startOfToday.getTime() - lastFreeze.getTime()) / (1000 * 60 * 60 * 24))
    if (daysSinceFreeze >= 7 && freezes < 1) {
      freezes = 1
      granted = true
      await db.settings.update({
        where: { userId: user!.id },
        data: { streakFreezes: 1 },
      })
    }
  } else if (freezes < 1) {
    // First time — grant initial freeze if user has been active
    const logCount = await db.reviewLog.count({ where: { userId: user!.id } })
    if (logCount > 0) {
      freezes = 1
      granted = true
      await db.settings.update({
        where: { userId: user!.id },
        data: { streakFreezes: 1 },
      })
    }
  }

  return NextResponse.json({
    streakFreezes: freezes,
    freezeGranted: granted,
  })
}
