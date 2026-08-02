import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, notFound, badRequest } from '@/lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

/**
 * PATCH /api/articles/[id]/sections?sectionId=xxx
 * Body: { isRead: boolean }
 * Marks a section as read/unread.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const url = new URL(req.url)
  const sectionId = url.searchParams.get('sectionId')
  if (!sectionId) return badRequest('sectionId required')

  const article = await db.article.findFirst({ where: { id, userId: user!.id } })
  if (!article) return notFound('Article not found')

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')

  const section = await db.articleSection.findFirst({
    where: { id: sectionId, articleId: id },
  })
  if (!section) return notFound('Section not found')

  const updated = await db.articleSection.update({
    where: { id: sectionId },
    data: { isRead: body.isRead ?? !section.isRead },
  })

  return NextResponse.json({ section: updated })
}
