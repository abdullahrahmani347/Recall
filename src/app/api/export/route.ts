import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'

/**
 * GET /api/export?format=markdown|json
 * Returns the user's full library as a single downloadable file.
 * - `json`: a single JSON document with notes/tags/notebooks/decks/cards.
 * - `markdown`: a single .md file with notes concatenated by `---` separators.
 *
 * Large exports (>1MB) would ideally be queued and emailed per §9 of the
 * brief; for the MVP we just stream synchronously.
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const url = new URL(req.url)
  const format = url.searchParams.get('format') ?? 'json'

  const [notes, tags, notebooks, decks, cards] = await Promise.all([
    db.note.findMany({
      where: { userId: user!.id },
      include: { tags: { include: { tag: true } }, notebook: true },
      orderBy: { createdAt: 'asc' },
    }),
    db.tag.findMany({ where: { userId: user!.id } }),
    db.notebook.findMany({ where: { userId: user!.id } }),
    db.deck.findMany({ where: { userId: user!.id } }),
    db.flashcard.findMany({
      where: { deck: { userId: user!.id } },
      include: { deck: { select: { name: true } } },
    }),
  ])

  if (format === 'markdown') {
    const md = notes
      .map((n) => {
        const tagLine = n.tags.length
          ? `\n\n*Tags: ${n.tags.map((t) => t.tag.name).join(', ')}*`
          : ''
        return `# ${n.title}\n\n${n.contentMarkdown}${tagLine}\n\n---\n`
      })
      .join('\n')

    return new NextResponse(md, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': 'attachment; filename="recall-export.md"',
      },
    })
  }

  // JSON export
  const payload = {
    exportedAt: new Date().toISOString(),
    version: 1,
    notes: notes.map((n) => ({
      title: n.title,
      contentMarkdown: n.contentMarkdown,
      notebook: n.notebook?.name ?? null,
      tags: n.tags.map((t) => t.tag.name),
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
    })),
    tags: tags.map((t) => ({ name: t.name, color: t.color })),
    notebooks: notebooks.map((nb) => ({ name: nb.name, color: nb.color })),
    decks: decks.map((d) => ({
      name: d.name,
      description: d.description,
      color: d.color,
      cards: cards
        .filter((c) => c.deckId === d.id)
        .map((c) => ({
          cardType: c.cardType,
          front: c.front,
          back: c.back,
        })),
    })),
  }

  return NextResponse.json(payload, {
    headers: {
      'Content-Disposition': 'attachment; filename="recall-export.json"',
    },
  })
}
