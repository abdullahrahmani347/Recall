import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'

/**
 * GET /api/social/buddies/search?q=...
 * Search for users by name or email to send study buddy requests.
 * Excludes self and existing buddies.
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json({ users: [] })

  // Get IDs of existing buddies and pending requests to exclude
  const [buddies, sentReqs] = await Promise.all([
    db.studyBuddy.findMany({
      where: { OR: [{ fromUserId: user!.id }, { toUserId: user!.id }] },
      select: { fromUserId: true, toUserId: true },
    }),
    db.studyBuddyRequest.findMany({
      where: { fromUserId: user!.id, status: 'pending' },
      select: { toUserId: true },
    }),
  ])

  const excludeIds = new Set<string>([user!.id])
  buddies.forEach(b => { excludeIds.add(b.fromUserId); excludeIds.add(b.toUserId) })
  sentReqs.forEach(r => excludeIds.add(r.toUserId))

  const users = await db.user.findMany({
    where: {
      id: { notIn: Array.from(excludeIds) },
      OR: [
        { name: { contains: q } },
        { email: { contains: q } },
      ],
    },
    select: { id: true, name: true, email: true, avatarUrl: true },
    take: 10,
  })

  return NextResponse.json({ users })
}
