import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, notFound } from '@/lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/notes/[id]/summarize
 * Creates a Summary row in `pending` status and returns its id.
 * The client then opens `GET /api/notes/[id]/summary/stream` to receive tokens.
 *
 * Honors the per-user `aiProcessingOptOut` flag from §12 of the brief —
 * if the user has opted out, we refuse the request with a clear message
 * rather than silently sending their note content to a third-party LLM.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const note = await db.note.findFirst({
    where: { id, userId: user!.id },
  })
  if (!note) return notFound('Note not found')

  const settings = await db.settings.findUnique({ where: { userId: user!.id } })
  if (settings?.aiProcessingOptOut) {
    return NextResponse.json(
      { error: 'AI processing is disabled in your settings. Enable it to summarize notes.' },
      { status: 403 }
    )
  }

  // Mark any existing in-flight summaries as superseded (status='failed')
  await db.summary.updateMany({
    where: { noteId: id, status: { in: ['pending', 'streaming'] } },
    data: { status: 'failed' },
  })

  const summary = await db.summary.create({
    data: {
      noteId: id,
      status: 'pending',
      modelUsed: 'z-ai-glm',
    },
  })

  return NextResponse.json({ summaryId: summary.id, status: 'pending' })
}
