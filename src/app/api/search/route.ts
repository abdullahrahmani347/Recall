import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'

/**
 * GET /api/search?q=...&type=notes|cards|all&tagId=...
 * Full-text-ish search across notes and cards. SQLite LIKE is the
 * cheapest non-trivial search we can run on the MVP; pgvector-backed
 * semantic search is a Phase 2 item per §12 of the brief.
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  const type = url.searchParams.get('type') ?? 'all'
  const tagId = url.searchParams.get('tagId')

  if (!q) return NextResponse.json({ notes: [], cards: [] })

  const notes = (type === 'all' || type === 'notes')
    ? await db.note.findMany({
        where: {
          userId: user!.id,
          isArchived: false,
          ...(tagId ? { tags: { some: { tagId } } } : {}),
          OR: [
            { title: { contains: q } },
            { contentPlainText: { contains: q } },
          ],
        },
        include: { tags: { include: { tag: true } }, notebook: true },
        orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
        take: 30,
      })
    : []

  const cards = (type === 'all' || type === 'cards')
    ? await db.flashcard.findMany({
        where: {
          deck: { userId: user!.id },
          OR: [{ front: { contains: q } }, { back: { contains: q } }],
        },
        include: { deck: { select: { id: true, name: true, color: true } } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      })
    : []

  return NextResponse.json({ notes, cards })
}
