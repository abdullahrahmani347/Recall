import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, badRequest } from '@/lib/api-helpers'
import { z } from 'zod'

const reorderSchema = z.object({
  noteIds: z.array(z.string()).min(1).max(100),
})

/**
 * POST /api/notes/reorder
 * Body: { noteIds: string[] } — the new order of note IDs
 * Updates the sortOrder field for each note.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = reorderSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  const { noteIds } = parsed.data

  // Update sortOrder for each note
  for (let i = 0; i < noteIds.length; i++) {
    await db.note.updateMany({
      where: { id: noteIds[i], userId: user!.id },
      data: { sortOrder: i },
    })
  }

  return NextResponse.json({ ok: true })
}
