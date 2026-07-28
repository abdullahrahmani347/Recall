import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'

/**
 * GET /api/reminders
 * Returns the user's due-card count + whether a reminder should fire now,
 * based on their reminderTime setting. The client uses this to decide
 * whether to show an in-app banner (and, when email is enabled, the
 * server would enqueue a digest — Phase 2 stubs the email send itself
 * but the scheduling decision is real).
 */
export async function GET() {
  const { user, response } = await requireUser()
  if (response) return response

  const settings = await db.settings.findUnique({ where: { userId: user!.id } })
  if (!settings?.reminderTime) {
    return NextResponse.json({ enabled: false, dueCount: 0, shouldRemind: false })
  }

  // Count due cards
  const cards = await db.flashcard.findMany({
    where: { deck: { userId: user!.id } },
    select: { schedulingState: { select: { dueDate: true } } },
  })
  const now = new Date()
  const dueCount = cards.filter(
    (c) => !c.schedulingState || c.schedulingState.dueDate <= now
  ).length

  // Determine if reminder should fire: compare current HH:MM (user TZ)
  // to reminderTime, within a 1-hour window.
  const tz = settings.timezone || 'UTC'
  let userNow: Date
  try {
    userNow = new Date(now.toLocaleString('en-US', { timeZone: tz }))
  } catch {
    userNow = now
  }
  const currentHHMM = `${String(userNow.getHours()).padStart(2, '0')}:${String(userNow.getMinutes()).padStart(2, '0')}`
  const [reminderH, reminderM] = settings.reminderTime.split(':').map(Number)
  const currentMin = userNow.getHours() * 60 + userNow.getMinutes()
  const reminderMin = reminderH * 60 + reminderM
  const withinWindow = currentMin >= reminderMin && currentMin < reminderMin + 60

  const shouldRemind = dueCount > 0 && withinWindow

  return NextResponse.json({
    enabled: true,
    reminderTime: settings.reminderTime,
    dueCount,
    shouldRemind,
    currentHHMM,
    emailEnabled: settings.reminderEmailEnabled,
    // The email send itself requires an SMTP provider — stubbed for Phase 2.
    // When a provider is wired in, this endpoint would enqueue a digest.
    emailSent: false,
  })
}
