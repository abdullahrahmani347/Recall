import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'

/**
 * GET /api/graph
 * Returns the full knowledge graph for the current user:
 * - nodes: all non-archived notes (id, title, updatedAt)
 * - edges: all NoteLink rows (from → to)
 *
 * Used by the graph view to render a force-directed visualization.
 */
export async function GET() {
  const { user, response } = await requireUser()
  if (response) return response

  const [notes, links] = await Promise.all([
    db.note.findMany({
      where: { userId: user!.id, isArchived: false },
      select: {
        id: true,
        title: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    }),
    db.noteLink.findMany({
      where: { fromNote: { userId: user!.id } },
      select: {
        fromNoteId: true,
        toNoteId: true,
      },
    }),
  ])

  return NextResponse.json({
    nodes: notes.map((n) => ({
      id: n.id,
      label: n.title || 'Untitled',
      updatedAt: n.updatedAt,
    })),
    edges: links.map((l) => ({
      source: l.fromNoteId,
      target: l.toNoteId,
    })),
  })
}
