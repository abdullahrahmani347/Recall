import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, badRequest, notFound, markdownToPlainText } from '@/lib/api-helpers'
import { z } from 'zod'

const updateNoteSchema = z.object({
  title: z.string().max(500).optional(),
  contentMarkdown: z.string().optional(),
  notebookId: z.string().nullable().optional(),
  isArchived: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  tagIds: z.array(z.string()).optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  // Find the note owned by the user OR in a notebook the user collaborates on
  const note = await db.note.findFirst({
    where: {
      id,
      OR: [
        { userId: user!.id },
        { notebook: { collaborators: { some: { userId: user!.id } } } },
      ],
    },
    include: {
      tags: { include: { tag: true } },
      notebook: { include: { collaborators: true } },
      summaries: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  })
  if (!note) return notFound('Note not found')
  return NextResponse.json({ note })
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  // Find the note owned by the user OR in a notebook where the user is an editor
  const existing = await db.note.findFirst({
    where: {
      id,
      OR: [
        { userId: user!.id },
        {
          notebook: {
            collaborators: {
              some: { userId: user!.id, role: 'editor' },
            },
          },
        },
      ],
    },
  })
  if (!existing) return notFound('Note not found')

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const parsed = updateNoteSchema.safeParse(body)
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')
  }
  const data = parsed.data

  // Validate notebook ownership
  if (data.notebookId) {
    const nb = await db.notebook.findFirst({
      where: { id: data.notebookId, userId: user!.id },
    })
    if (!nb) return badRequest('Invalid notebook')
  }

  const update: Record<string, unknown> = {}
  if (data.title !== undefined) update.title = data.title
  if (data.contentMarkdown !== undefined) {
    update.contentMarkdown = data.contentMarkdown
    update.contentPlainText = markdownToPlainText(data.contentMarkdown)
  }
  if (data.notebookId !== undefined) update.notebookId = data.notebookId
  if (data.isArchived !== undefined) update.isArchived = data.isArchived
  if (data.isPinned !== undefined) update.isPinned = data.isPinned

  // Tags: replace if provided
  if (data.tagIds !== undefined) {
    await db.noteTag.deleteMany({ where: { noteId: id } })
    if (data.tagIds.length > 0) {
      await db.noteTag.createMany({
        data: data.tagIds.map((tagId) => ({ noteId: id, tagId })),
      })
    }
  }

  const note = await db.note.update({
    where: { id },
    data: update,
    include: {
      tags: { include: { tag: true } },
      notebook: true,
    },
  })

  return NextResponse.json({ note })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const existing = await db.note.findFirst({ where: { id, userId: user!.id } })
  if (!existing) return notFound('Note not found')

  await db.note.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
