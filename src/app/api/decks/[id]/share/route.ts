import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, badRequest } from '@/lib/api-helpers'
import { z } from 'zod'

const schema = z.object({
  userEmail: z.string().email(),
  role: z.enum(['viewer', 'editor']).default('viewer'),
})

/**
 * POST /api/decks/[id]/share
 * Shares a deck with another user by email. The recipient gets
 * read-only (viewer) or edit (editor) access.
 *
 * This creates a Notebook-level collaboration (the deck's notebook
 * becomes shared). If the deck has no notebook, a shared one is created.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id: deckId } = await params
  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = schema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  // Verify deck ownership
  const deck = await db.deck.findFirst({ where: { id: deckId, userId: user!.id } })
  if (!deck) return NextResponse.json({ error: 'Deck not found' }, { status: 404 })

  // Find the recipient user by email
  const recipient = await db.user.findUnique({ where: { email: parsed.data.userEmail } })
  if (!recipient) return NextResponse.json({ error: 'User not found with that email' }, { status: 404 })
  if (recipient.id === user!.id) return badRequest('You cannot share with yourself')

  // Ensure deck has a notebook (create shared notebook if needed)
  // For deck sharing without a notebook, we create a synthetic shared notebook
  // In a full implementation, we'd add a DeckShare model — for MVP we use notebooks
  let notebookId: string | null = null

  // Check if any note in this deck has a notebook
  const noteWithNotebook = await db.note.findFirst({
    where: { flashcards: { some: { deckId } }, notebookId: { not: null } },
    select: { notebookId: true },
  })

  if (noteWithNotebook?.notebookId) {
    notebookId = noteWithNotebook.notebookId
  } else {
    // Create a shared notebook for this deck
    const nb = await db.notebook.create({
      data: {
        userId: user!.id,
        name: `Shared: ${deck.name}`,
        color: deck.color,
      },
    })
    notebookId = nb.id
  }

  // Check if collaboration already exists
  const existing = await db.collaborator.findFirst({
    where: { notebookId: notebookId!, userId: recipient.id },
  })

  if (existing) {
    // Update role if different
    if (existing.role !== parsed.data.role) {
      await db.collaborator.update({
        where: { id: existing.id },
        data: { role: parsed.data.role },
      })
      return NextResponse.json({ ok: true, message: `Updated role to ${parsed.data.role}` })
    }
    return NextResponse.json({ ok: true, message: 'Already shared' })
  }

  // Create collaboration
  await db.collaborator.create({
    data: {
      notebookId: notebookId!,
      userId: recipient.id,
      role: parsed.data.role,
      invitedBy: user!.id,
    },
  })

  return NextResponse.json({
    ok: true,
    message: `Shared with ${recipient.email} as ${parsed.data.role}`,
    sharedWith: { email: recipient.email, name: recipient.name, role: parsed.data.role },
  })
}

/**
 * GET /api/decks/[id]/share
 * Returns all collaborators for a shared deck.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id: deckId } = await params

  const deck = await db.deck.findFirst({ where: { id: deckId, userId: user!.id } })
  if (!deck) return NextResponse.json({ error: 'Deck not found' }, { status: 404 })

  // Find collaborators via the deck's notebook
  const noteWithNotebook = await db.note.findFirst({
    where: { flashcards: { some: { deckId } }, notebookId: { not: null } },
    select: { notebookId: true },
  })

  if (!noteWithNotebook?.notebookId) {
    return NextResponse.json({ collaborators: [] })
  }

  const collaborators = await db.collaborator.findMany({
    where: { notebookId: noteWithNotebook.notebookId },
    include: { user: { select: { email: true, name: true, avatarUrl: true } } },
  })

  return NextResponse.json({
    collaborators: collaborators.map(c => ({
      id: c.id,
      email: c.user.email,
      name: c.user.name,
      avatarUrl: c.user.avatarUrl,
      role: c.role,
    })),
  })
}
