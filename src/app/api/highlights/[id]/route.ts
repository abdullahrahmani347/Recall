import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, notFound } from '@/lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

/**
 * DELETE /api/highlights/[id]
 * Deletes a highlight and its associated flashcard (if any).
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const highlight = await db.highlight.findFirst({
    where: { id, userId: user!.id },
  })
  if (!highlight) return notFound('Highlight not found')

  // Delete the associated flashcard if it exists
  if (highlight.cardId) {
    await db.flashcard.deleteMany({ where: { id: highlight.cardId } })
  }

  await db.highlight.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
