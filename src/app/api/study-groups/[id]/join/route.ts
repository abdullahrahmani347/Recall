import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'

/**
 * POST /api/study-groups/[id]/join
 * Joins a study group by its notebook ID. Anyone with the group ID
 * can join as a viewer.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id: notebookId } = await params

  // Check if the notebook exists
  const notebook = await db.notebook.findUnique({ where: { id: notebookId } })
  if (!notebook) return NextResponse.json({ error: 'Study group not found' }, { status: 404 })

  // Check if already a member
  const existing = await db.collaborator.findFirst({
    where: { notebookId, userId: user!.id },
  })

  if (existing) {
    return NextResponse.json({ ok: true, message: 'Already a member', role: existing.role })
  }

  // Join as a viewer
  const collaborator = await db.collaborator.create({
    data: {
      notebookId,
      userId: user!.id,
      role: 'viewer',
      invitedBy: user!.id,
    },
  })

  return NextResponse.json({
    ok: true,
    message: `Joined study group: ${notebook.name}`,
    role: collaborator.role,
  })
}
