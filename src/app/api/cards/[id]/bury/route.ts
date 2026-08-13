import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'

/**
 * POST /api/cards/[id]/bury
 * Buries a card until tomorrow (resets at midnight UTC).
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params

  const card = await db.flashcard.findFirst({
    where: { id, deck: { userId: user!.id } },
  })
  if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 })

  await db.flashcard.update({
    where: { id },
    data: { isBuried: true },
  })

  return NextResponse.json({ ok: true })
}
