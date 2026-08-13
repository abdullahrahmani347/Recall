import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'

/**
 * POST /api/cards/[id]/suspend
 * Suspends a card indefinitely (hidden from review until unsuspended).
 * Pass { suspend: false } in body to unsuspend.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const suspend = body.suspend !== false // default true

  const card = await db.flashcard.findFirst({
    where: { id, deck: { userId: user!.id } },
  })
  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 })

  await db.flashcard.update({
    where: { id },
    data: { isSuspended: suspend },
  })

  return NextResponse.json({ ok: true, isSuspended: suspend })
}
