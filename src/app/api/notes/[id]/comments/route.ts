import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, notFound, badRequest } from '@/lib/api-helpers'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

const createCommentSchema = z.object({
  body: z.string().min(1).max(5000),
  anchorText: z.string().max(500).nullable().optional(),
})

/**
 * GET /api/notes/[id]/comments
 * Returns all comments on a note, newest first. The note owner and any
 * collaborator on the note's notebook can view comments.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const note = await db.note.findFirst({
    where: { id },
    include: { notebook: { include: { collaborators: true } } },
  })
  if (!note) return notFound('Note not found')

  // Access check: owner, or collaborator on the notebook
  const isOwner = note.userId === user!.id
  const isCollab = note.notebook?.collaborators.some((c) => c.userId === user!.id)
  if (!isOwner && !isCollab) return notFound('Note not found')

  const comments = await db.comment.findMany({
    where: { noteId: id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      noteId: c.noteId,
      userId: c.userId,
      userName: c.user.name,
      userEmail: c.user.email,
      body: c.body,
      anchorText: c.anchorText,
      resolved: c.resolved,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
  })
}

/**
 * POST /api/notes/[id]/comments
 * Body: { body, anchorText? }
 * Adds a comment to the note. Anyone with read access can comment.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const note = await db.note.findFirst({
    where: { id },
    include: { notebook: { include: { collaborators: true } } },
  })
  if (!note) return notFound('Note not found')

  const isOwner = note.userId === user!.id
  const isCollab = note.notebook?.collaborators.some((c) => c.userId === user!.id)
  if (!isOwner && !isCollab) return notFound('Note not found')

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = createCommentSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  const comment = await db.comment.create({
    data: {
      noteId: id,
      userId: user!.id,
      body: parsed.data.body,
      anchorText: parsed.data.anchorText ?? null,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  })

  return NextResponse.json(
    {
      comment: {
        id: comment.id,
        noteId: comment.noteId,
        userId: comment.userId,
        userName: comment.user.name,
        userEmail: comment.user.email,
        body: comment.body,
        anchorText: comment.anchorText,
        resolved: comment.resolved,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
      },
    },
    { status: 201 }
  )
}
