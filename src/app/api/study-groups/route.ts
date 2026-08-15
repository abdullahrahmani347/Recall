import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, badRequest } from '@/lib/api-helpers'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  deckIds: z.array(z.string()).min(1).max(10),
})

/**
 * POST /api/study-groups
 * Creates a study group — a shared collection of decks that multiple
 * users can review together. The creator becomes the group owner.
 *
 * Study groups enable collaborative study sessions where members can:
 * - See each other's progress on shared decks
 * - Compete on streaks and review counts
 * - Share notes and flashcards
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = schema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  const { name, description, deckIds } = parsed.data

  // Verify all decks belong to the user
  const decks = await db.deck.findMany({
    where: { id: { in: deckIds }, userId: user!.id },
  })
  if (decks.length !== deckIds.length) {
    return badRequest('One or more decks not found or not owned by you')
  }

  // Create a notebook to represent the study group
  const notebook = await db.notebook.create({
    data: {
      userId: user!.id,
      name: `Study Group: ${name}`,
      color: '#4C8CFF',
    },
  })

  // The creator is automatically a collaborator (owner)
  await db.collaborator.create({
    data: {
      notebookId: notebook.id,
      userId: user!.id,
      role: 'editor',
      invitedBy: user!.id,
    },
  })

  return NextResponse.json({
    ok: true,
    groupId: notebook.id,
    name,
    description,
    deckIds,
    message: 'Study group created. Share the group notebook with collaborators to invite them.',
  }, { status: 201 })
}

/**
 * GET /api/study-groups
 * Returns all study groups the user is part of.
 */
export async function GET() {
  const { user, response } = await requireUser()
  if (response) return response

  const groups = await db.collaborator.findMany({
    where: { userId: user!.id },
    include: {
      notebook: {
        select: { id: true, name: true, color: true },
      },
    },
  })

  return NextResponse.json({
    groups: groups.map(g => ({
      id: g.notebook.id,
      name: g.notebook.name.replace(/^Study Group: /, ''),
      color: g.notebook.color,
      role: g.role,
    })),
  })
}
