import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, badRequest } from '@/lib/api-helpers'
import { z } from 'zod'

const reorderSchema = z.object({
  deckIds: z.array(z.string()).min(1).max(100),
})

/**
 * POST /api/decks/reorder
 * Body: { deckIds: string[] } — the new order of deck IDs
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = reorderSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  const { deckIds } = parsed.data

  for (let i = 0; i < deckIds.length; i++) {
    await db.deck.updateMany({
      where: { id: deckIds[i], userId: user!.id },
      data: { sortOrder: i },
    })
  }

  return NextResponse.json({ ok: true })
}
