import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, badRequest } from '@/lib/api-helpers'
import { z } from 'zod'

const schema = z.object({
  toUserId: z.string().min(1),
  message: z.string().max(200).optional(),
})

/**
 * POST /api/social/buddies/request
 * Send a study buddy request to another user.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = schema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  const { toUserId, message } = parsed.data
  if (toUserId === user!.id) return badRequest('Cannot send request to yourself')

  const target = await db.user.findUnique({ where: { id: toUserId } })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Check if already buddies or request exists
  const existing = await db.studyBuddy.findFirst({
    where: { status: 'accepted', OR: [{ fromUserId: user!.id, toUserId }, { fromUserId: toUserId, toUserId: user!.id }] },
  })
  if (existing) return badRequest('Already study buddies')

  const existingReq = await db.studyBuddyRequest.findUnique({
    where: { fromUserId_toUserId: { fromUserId: user!.id, toUserId } },
  })
  if (existingReq) return badRequest('Request already sent')

  // Check reverse request — auto-accept
  const reverseReq = await db.studyBuddyRequest.findUnique({
    where: { fromUserId_toUserId: { fromUserId: toUserId, toUserId: user!.id } },
  })
  if (reverseReq && reverseReq.status === 'pending') {
    // Both want to connect — accept
    await db.studyBuddyRequest.update({ where: { id: reverseReq.id }, data: { status: 'accepted' } })
    await db.studyBuddy.create({
      data: { fromUserId: user!.id, toUserId, status: 'accepted' },
    })
    return NextResponse.json({ ok: true, message: 'Study buddy connection established!' })
  }

  await db.studyBuddyRequest.create({
    data: { fromUserId: user!.id, toUserId, message: message || '' },
  })

  return NextResponse.json({ ok: true, message: 'Request sent' }, { status: 201 })
}

/**
 * PATCH /api/social/buddies/request
 * Accept or decline a study buddy request.
 * Body: { requestId: string, action: 'accept' | 'decline' }
 */
export async function PATCH(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const { requestId, action } = body as { requestId: string; action: 'accept' | 'decline' }
  if (!requestId || !action) return badRequest('Missing requestId or action')

  const request = await db.studyBuddyRequest.findUnique({ where: { id: requestId } })
  if (!request) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  if (request.toUserId !== user!.id) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  if (action === 'accept') {
    await db.studyBuddyRequest.update({ where: { id: requestId }, data: { status: 'accepted' } })
    await db.studyBuddy.create({
      data: { fromUserId: request.fromUserId, toUserId: request.toUserId, status: 'accepted' },
    })
    return NextResponse.json({ ok: true, message: 'Study buddy added!' })
  } else {
    await db.studyBuddyRequest.update({ where: { id: requestId }, data: { status: 'declined' } })
    return NextResponse.json({ ok: true, message: 'Request declined' })
  }
}
