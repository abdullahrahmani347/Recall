import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, notFound } from '@/lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

/**
 * DELETE /api/collaborators/[id]
 * Removes a collaborator from a notebook. Only the notebook owner can
 * remove collaborators.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const collaborator = await db.collaborator.findUnique({
    where: { id },
    include: { notebook: true },
  })
  if (!collaborator) return notFound('Collaborator not found')

  // Only the notebook owner can remove collaborators.
  // A collaborator can also remove themselves (leave the notebook).
  if (
    collaborator.notebook.userId !== user!.id &&
    collaborator.userId !== user!.id
  ) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  await db.collaborator.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
