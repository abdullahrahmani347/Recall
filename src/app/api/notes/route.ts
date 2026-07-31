import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, badRequest, markdownToPlainText } from '@/lib/api-helpers'
import { extractInlineCards, extractLinks } from '@/lib/inline-parser'
import { z } from 'zod'

const createNoteSchema = z.object({
  title: z.string().max(500).default(''),
  contentMarkdown: z.string().default(''),
  notebookId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).optional(),
  isPinned: z.boolean().optional(),
})

export async function GET(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const url = new URL(req.url)
  const notebookId = url.searchParams.get('notebookId')
  const tagId = url.searchParams.get('tagId')
  const archived = url.searchParams.get('archived') === 'true'
  const q = url.searchParams.get('q')

  const notes = await db.note.findMany({
    where: {
      userId: user!.id,
      isArchived: archived,
      ...(notebookId ? { notebookId } : {}),
      ...(tagId ? { tags: { some: { tagId } } } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { contentPlainText: { contains: q } },
            ],
          }
        : {}),
    },
    include: {
      tags: { include: { tag: true } },
      notebook: true,
      summaries: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
  })

  return NextResponse.json({ notes })
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const parsed = createNoteSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
  }

  const { title, contentMarkdown, notebookId, tagIds, isPinned } = parsed.data

  // Validate notebook ownership if provided
  if (notebookId) {
    const nb = await db.notebook.findFirst({
      where: { id: notebookId, userId: user!.id },
    })
    if (!nb) return badRequest('Invalid notebook')
  }

  const note = await db.note.create({
    data: {
      userId: user!.id,
      title: title || 'Untitled',
      contentMarkdown,
      contentPlainText: markdownToPlainText(contentMarkdown),
      notebookId: notebookId ?? null,
      isPinned: isPinned ?? false,
      tags: tagIds?.length
        ? {
            create: tagIds.map((tagId) => ({
              tag: { connect: { id: tagId } },
            })),
          }
        : undefined,
    },
    include: {
      tags: { include: { tag: true } },
      notebook: true,
    },
  })

  // Tier 1: Sync inline cards and bidirectional links
  await syncInlineContent(note.id, user!.id, contentMarkdown)

  return NextResponse.json({ note }, { status: 201 })
}

/**
 * Sync inline cards (Term :: Definition) and wiki links ([[Title]])
 * from the note's markdown content to the database.
 *
 * - Inline cards: creates Flashcard rows in a default "Inline" deck
 *   (auto-created if it doesn't exist)
 * - Wiki links: creates NoteLink rows, auto-creating stub notes
 *   for targets that don't exist yet
 */
async function syncInlineContent(noteId: string, userId: string, markdown: string) {
  const cards = extractInlineCards(markdown)
  const links = extractLinks(markdown)

  // Sync inline cards
  if (cards.length > 0) {
    // Find or create an "Inline Cards" deck for this user
    let deck = await db.deck.findFirst({
      where: { userId, name: 'Inline Cards' },
    })
    if (!deck) {
      deck = await db.deck.create({
        data: { userId, name: 'Inline Cards', description: 'Auto-created from inline note syntax', color: '#34E7A8' },
      })
    }

    // Delete old inline cards from this note, then recreate
    await db.flashcard.deleteMany({
      where: { deckId: deck.id, sourceNoteId: noteId },
    })

    // Create cards individually with scheduling state
    for (const card of cards) {
      const flashcard = await db.flashcard.create({
        data: {
          deckId: deck.id,
          sourceNoteId: noteId,
          cardType: 'basic',
          front: card.front,
          back: card.back,
        },
      })
      await db.schedulingState.create({
        data: { cardId: flashcard.id },
      })
    }
  } else {
    // No inline cards — clean up any that existed before
    const inlineDeck = await db.deck.findFirst({
      where: { userId, name: 'Inline Cards' },
    })
    if (inlineDeck) {
      await db.flashcard.deleteMany({
        where: { deckId: inlineDeck.id, sourceNoteId: noteId },
      })
    }
  }

  // Sync wiki links
  // Delete old links from this note
  await db.noteLink.deleteMany({ where: { fromNoteId: noteId } })

  for (const link of links) {
    // Find or create the target note (stub if new)
    let targetNote = await db.note.findFirst({
      where: {
        userId,
        title: { equals: link.targetTitle },
      },
    })

    if (!targetNote) {
      // Create a stub note for the link target
      targetNote = await db.note.create({
        data: {
          userId,
          title: link.targetTitle,
          contentMarkdown: '',
          contentPlainText: '',
        },
      })
    }

    // Create the link (ignore duplicates — the unique constraint handles it)
    await db.noteLink.upsert({
      where: {
        fromNoteId_toNoteId: { fromNoteId: noteId, toNoteId: targetNote.id },
      },
      update: {},
      create: { fromNoteId: noteId, toNoteId: targetNote.id },
    })
  }
}
