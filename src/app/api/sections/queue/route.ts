import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'

/**
 * GET /api/sections/queue
 * Returns article sections that are due for review (incremental reading).
 * Sections with no schedule are "new" (due now).
 * Sections with a schedule are due if dueDate <= now.
 */
export async function GET() {
  const { user, response } = await requireUser()
  if (response) return response

  const now = new Date()

  const sections = await db.articleSection.findMany({
    where: { article: { userId: user!.id } },
    include: {
      article: { select: { id: true, title: true } },
      sectionSchedule: true,
    },
    orderBy: [{ articleId: 'asc' }, { order: 'asc' }],
  })

  const due = sections
    .filter((s) => {
      if (!s.sectionSchedule) return true // never scheduled = new
      return s.sectionSchedule.dueDate <= now
    })
    .map((s) => ({
      id: s.id,
      articleId: s.articleId,
      articleTitle: s.article.title,
      order: s.order,
      heading: s.heading,
      content: s.content,
      isRead: s.isRead,
      interval: s.sectionSchedule?.interval ?? 0,
      repetitions: s.sectionSchedule?.repetitions ?? 0,
      dueDate: s.sectionSchedule?.dueDate ?? now,
    }))

  return NextResponse.json({ sections: due, total: due.length })
}
