import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, notFound, badRequest } from '@/lib/api-helpers'
import { z } from 'zod'

const updateDeckSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  color: z.string().max(20).optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const deck = await db.deck.findFirst({
    where: { id, userId: user!.id },
    include: {
      flashcards: {
        include: { schedulingState: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!deck) return notFound('Deck not found')
  return NextResponse.json({ deck })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const existing = await db.deck.findFirst({ where: { id, userId: user!.id } })
  if (!existing) return notFound('Deck not found')

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = updateDeckSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  const deck = await db.deck.update({ where: { id }, data: parsed.data })
  return NextResponse.json({ deck })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const existing = await db.deck.findFirst({ where: { id, userId: user!.id } })
  if (!existing) return notFound('Deck not found')

  await db.deck.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
