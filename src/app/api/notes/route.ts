import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, badRequest, markdownToPlainText } from '@/lib/api-helpers'
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

  return NextResponse.json({ note }, { status: 201 })
}
