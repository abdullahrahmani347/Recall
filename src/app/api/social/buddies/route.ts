import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'

/**
 * GET /api/social/buddies
 * Returns the user's accepted study buddies + pending requests.
 */
export async function GET() {
  const { user, response } = await requireUser()
  if (response) return response

  const [accepted, pendingFrom, pendingTo] = await Promise.all([
    db.studyBuddy.findMany({
      where: { status: 'accepted', OR: [{ fromUserId: user!.id }, { toUserId: user!.id }] },
      include: {
        fromUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
        toUser: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    }),
    db.studyBuddyRequest.findMany({
      where: { fromUserId: user!.id, status: 'pending' },
      include: { toUser: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),
    db.studyBuddyRequest.findMany({
      where: { toUserId: user!.id, status: 'pending' },
      include: { fromUser: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),
  ])

  const buddies = accepted.map(b => {
    const other = b.fromUserId === user!.id ? b.toUser : b.fromUser
    return { id: other.id, name: other.name, email: other.email, avatarUrl: other.avatarUrl }
  })

  return NextResponse.json({
    buddies,
    pendingSent: pendingFrom.map(r => ({ id: r.id, to: r.toUser, message: r.message, createdAt: r.createdAt })),
    pendingReceived: pendingTo.map(r => ({ id: r.id, from: r.fromUser, message: r.message, createdAt: r.createdAt })),
  })
}
