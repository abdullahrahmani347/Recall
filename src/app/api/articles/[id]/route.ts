import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, notFound, badRequest } from '@/lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/articles/[id]
 * Returns the article with all sections and highlights.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const article = await db.article.findFirst({
    where: { id, userId: user!.id },
    include: {
      sections: {
        orderBy: { order: 'asc' },
        include: {
          highlights: true,
        },
      },
    },
  })
  if (!article) return notFound('Article not found')

  return NextResponse.json({ article })
}

/**
 * DELETE /api/articles/[id]
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const article = await db.article.findFirst({ where: { id, userId: user!.id } })
  if (!article) return notFound('Article not found')

  await db.article.delete({ where: { id } })
  return new NextResponse(null, { status: 204 })
}
