import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, badRequest } from '@/lib/api-helpers'
import { z } from 'zod'

const createTagSchema = z.object({
  name: z.string().min(1).max(80),
  color: z.string().max(20).optional(),
})

export async function GET() {
  const { user, response } = await requireUser()
  if (response) return response

  const tags = await db.tag.findMany({
    where: { userId: user!.id },
    orderBy: { name: 'asc' },
    include: { _count: { select: { notes: true } } },
  })

  return NextResponse.json({
    tags: tags.map((t) => ({
      id: t.id,
      userId: t.userId,
      name: t.name,
      color: t.color,
      createdAt: t.createdAt,
      noteCount: t._count.notes,
    })),
  })
}

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = createTagSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  const existing = await db.tag.findFirst({
    where: { userId: user!.id, name: parsed.data.name },
  })
  if (existing) return NextResponse.json({ tag: existing })

  const tag = await db.tag.create({
    data: {
      userId: user!.id,
      name: parsed.data.name,
      color: parsed.data.color ?? '#FFB454',
    },
  })
  return NextResponse.json({ tag }, { status: 201 })
}
