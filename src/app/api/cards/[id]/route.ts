import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, notFound, badRequest } from '@/lib/api-helpers'
import { z } from 'zod'

const updateCardSchema = z.object({
  front: z.string().min(1).max(5000).optional(),
  back: z.string().min(1).max(5000).optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const card = await db.flashcard.findFirst({
    where: { id },
    include: { deck: { select: { userId: true } } },
  })
  if (!card || card.deck.userId !== user!.id) return notFound('Card not found')

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = updateCardSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  const updated = await db.flashcard.update({
    where: { id },
    data: parsed.data,
    include: { schedulingState: true },
  })
  return NextResponse.json({ card: updated })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const card = await db.flashcard.findFirst({
    where: { id },
    include: { deck: { select: { userId: true } } },
  })
  if (!card || card.deck.userId !== user!.id) return notFound('Card not found')

  await db.flashcard.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
