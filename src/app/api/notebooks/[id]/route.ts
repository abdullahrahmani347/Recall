import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, notFound, badRequest } from '@/lib/api-helpers'
import { z } from 'zod'

const updateNotebookSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  color: z.string().max(20).optional(),
  parentId: z.string().nullable().optional(),
})

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const existing = await db.notebook.findFirst({ where: { id, userId: user!.id } })
  if (!existing) return notFound('Notebook not found')

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = updateNotebookSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  const notebook = await db.notebook.update({ where: { id }, data: parsed.data })
  return NextResponse.json({ notebook })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const existing = await db.notebook.findFirst({ where: { id, userId: user!.id } })
  if (!existing) return notFound('Notebook not found')

  await db.notebook.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
