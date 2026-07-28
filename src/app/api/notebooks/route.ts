import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, badRequest } from '@/lib/api-helpers'
import { z } from 'zod'

const createNotebookSchema = z.object({
  name: z.string().min(1).max(120),
  color: z.string().max(20).optional(),
  parentId: z.string().nullable().optional(),
})

export async function GET() {
  const { user, response } = await requireUser()
  if (response) return response

  const notebooks = await db.notebook.findMany({
    where: { userId: user!.id },
    orderBy: { name: 'asc' },
    include: { _count: { select: { notes: true } } },
  })

  return NextResponse.json({
    notebooks: notebooks.map((n) => ({
      id: n.id,
      userId: n.userId,
      name: n.name,
      color: n.color,
      parentId: n.parentId,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      noteCount: n._count.notes,
    })),
  })
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = createNotebookSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  const notebook = await db.notebook.create({
    data: {
      userId: user!.id,
      name: parsed.data.name,
      color: parsed.data.color ?? '#34E7A8',
      parentId: parsed.data.parentId ?? null,
    },
  })
  return NextResponse.json({ notebook }, { status: 201 })
}
