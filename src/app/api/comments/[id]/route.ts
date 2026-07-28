import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, notFound, badRequest } from '@/lib/api-helpers'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

const updateCommentSchema = z.object({
  body: z.string().min(1).max(5000).optional(),
  resolved: z.boolean().optional(),
})

/**
 * PATCH /api/comments/[id]
 * Body: { body?, resolved? }
 * Updates a comment. The comment author can edit the body; anyone with
 * note access can toggle resolved.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const comment = await db.comment.findFirst({
    where: { id },
    include: {
      note: {
        include: { notebook: { include: { collaborators: true } } },
      },
    },
  })
  if (!comment) return notFound('Comment not found')

  // Access check
  const isOwner = comment.note.userId === user!.id
  const isCollab = comment.note.notebook?.collaborators.some((c) => c.userId === user!.id)
  if (!isOwner && !isCollab) return notFound('Comment not found')

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = updateCommentSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  // Only the comment author can edit the body
  if (parsed.data.body !== undefined && comment.userId !== user!.id) {
    return NextResponse.json({ error: 'Only the author can edit the comment body' }, { status: 403 })
  }

  const updated = await db.comment.update({
    where: { id },
    data: parsed.data,
    include: { user: { select: { id: true, name: true, email: true } } },
  })

  return NextResponse.json({
    comment: {
      id: updated.id,
      noteId: updated.noteId,
      userId: updated.userId,
      userName: updated.user.name,
      userEmail: updated.user.email,
      body: updated.body,
      anchorText: updated.anchorText,
      resolved: updated.resolved,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    },
  })
}

/**
 * DELETE /api/comments/[id]
 * Deletes a comment. The comment author or the note owner can delete.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const comment = await db.comment.findFirst({
    where: { id },
    include: { note: true },
  })
  if (!comment) return notFound('Comment not found')

  const isAuthor = comment.userId === user!.id
  const isNoteOwner = comment.note.userId === user!.id
  if (!isAuthor && !isNoteOwner) {
    return NextResponse.json({ error: 'Not authorized to delete this comment' }, { status: 403 })
  }

  await db.comment.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
