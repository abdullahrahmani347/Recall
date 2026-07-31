import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, notFound } from '@/lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/notes/[id]/backlinks
 * Returns all notes that link TO this note (backlinks).
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const note = await db.note.findFirst({
    where: { id, userId: user!.id },
    select: { id: true },
  })
  if (!note) return notFound('Note not found')

  const backlinks = await db.noteLink.findMany({
    where: { toNoteId: id },
    include: {
      fromNote: {
        select: {
          id: true,
          title: true,
          contentPlainText: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    backlinks: backlinks.map((bl) => ({
      id: bl.fromNote.id,
      title: bl.fromNote.title,
      contentPlainText: bl.fromNote.contentPlainText.slice(0, 200),
      updatedAt: bl.fromNote.updatedAt,
    })),
  })
}
