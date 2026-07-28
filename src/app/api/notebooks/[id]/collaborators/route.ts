import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, notFound, badRequest } from '@/lib/api-helpers'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/notebooks/[id]/collaborators
 * Lists all collaborators on a notebook. The notebook owner and any
 * collaborator can view this list.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  // Verify access: owner OR collaborator
  const notebook = await db.notebook.findFirst({ where: { id } })
  if (!notebook) return notFound('Notebook not found')

  const isOwner = notebook.userId === user!.id
  const collab = await db.collaborator.findFirst({
    where: { notebookId: id, userId: user!.id },
  })
  if (!isOwner && !collab) return notFound('Notebook not found')

  const collaborators = await db.collaborator.findMany({
    where: { notebookId: id },
    include: { user: { select: { id: true, email: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json({
    collaborators: collaborators.map((c) => ({
      id: c.id,
      notebookId: c.notebookId,
      userId: c.userId,
      name: c.user.name,
      email: c.user.email,
      role: c.role,
      createdAt: c.createdAt,
    })),
    owner: {
      id: notebook.userId,
      // We don't have the owner's email/name here without another query;
      // the client can infer from the auth user.
    },
  })
}

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['editor', 'viewer']).default('editor'),
})

/**
 * POST /api/notebooks/[id]/collaborators
 * Body: { email, role }
 * Invites an existing user (by email) to collaborate on a notebook.
 * Only the notebook owner can invite.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const notebook = await db.notebook.findFirst({ where: { id } })
  if (!notebook) return notFound('Notebook not found')
  if (notebook.userId !== user!.id) {
    return NextResponse.json({ error: 'Only the owner can invite collaborators' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = inviteSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  const { email, role } = parsed.data
  const invitee = await db.user.findUnique({ where: { email } })
  if (!invitee) {
    return NextResponse.json(
      { error: 'No user found with that email. Ask them to create a Recall account first.' },
      { status: 404 }
    )
  }
  if (invitee.id === user!.id) {
    return badRequest("You can't invite yourself")
  }

  // Check for existing collaboration
  const existing = await db.collaborator.findFirst({
    where: { notebookId: id, userId: invitee.id },
  })
  if (existing) {
    // Update role if different
    if (existing.role !== role) {
      await db.collaborator.update({ where: { id: existing.id }, data: { role } })
    }
    return NextResponse.json({ collaborator: existing, alreadyExists: true })
  }

  const collaborator = await db.collaborator.create({
    data: {
      notebookId: id,
      userId: invitee.id,
      role,
      invitedBy: user!.id,
    },
    include: { user: { select: { id: true, email: true, name: true } } },
  })

  return NextResponse.json(
    {
      collaborator: {
        id: collaborator.id,
        notebookId: collaborator.notebookId,
        userId: collaborator.userId,
        name: collaborator.user.name,
        email: collaborator.user.email,
        role: collaborator.role,
        createdAt: collaborator.createdAt,
      },
    },
    { status: 201 }
  )
}
