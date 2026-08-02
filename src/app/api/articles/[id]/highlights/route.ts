import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, notFound, badRequest } from '@/lib/api-helpers'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

const highlightSchema = z.object({
  sectionId: z.string(),
  text: z.string().min(1).max(5000),
  note: z.string().max(2000).nullable().optional(),
  cardType: z.enum(['cloze', 'basic']).default('cloze'),
  createCard: z.boolean().default(true),
})

/**
 * POST /api/articles/[id]/highlights
 * Body: { sectionId, text, note?, cardType, createCard }
 *
 * Creates a highlight on a section. If createCard is true, also creates
 * a Flashcard from the highlight:
 * - cloze: wraps the highlighted text in {{c1::...}} within the section content
 * - basic: front = "What is the key point from [article title]?", back = highlight text
 *
 * The card is added to an "Article Highlights" deck (auto-created).
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const article = await db.article.findFirst({ where: { id, userId: user!.id } })
  if (!article) return notFound('Article not found')

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = highlightSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  const { sectionId, text, note, cardType, createCard } = parsed.data

  const section = await db.articleSection.findFirst({
    where: { id: sectionId, articleId: id },
  })
  if (!section) return notFound('Section not found')

  // Create the highlight
  let cardId: string | null = null

  if (createCard) {
    // Find or create "Article Highlights" deck
    let deck = await db.deck.findFirst({
      where: { userId: user!.id, name: 'Article Highlights' },
    })
    if (!deck) {
      deck = await db.deck.create({
        data: {
          userId: user!.id,
          name: 'Article Highlights',
          description: 'Cards created from article highlights',
          color: '#4C8CFF',
        },
      })
    }

    // Create the flashcard
    const front = cardType === 'cloze'
      ? section.content.replace(
          text,
          `{{c1::${text}}}`
        )
      : `From "${article.title}": What did you highlight?`

    const back = cardType === 'cloze' ? '1' : text

    const flashcard = await db.flashcard.create({
      data: {
        deckId: deck.id,
        cardType,
        front,
        back,
      },
    })

    // Create scheduling state
    await db.schedulingState.create({
      data: { cardId: flashcard.id },
    })

    cardId = flashcard.id
  }

  const highlight = await db.highlight.create({
    data: {
      sectionId,
      userId: user!.id,
      text,
      note: note ?? null,
      cardType,
      cardId,
    },
  })

  return NextResponse.json({ highlight }, { status: 201 })
}

/**
 * GET /api/articles/[id]/highlights
 * Returns all highlights for an article.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const article = await db.article.findFirst({ where: { id, userId: user!.id } })
  if (!article) return notFound('Article not found')

  const highlights = await db.highlight.findMany({
    where: { section: { articleId: id }, userId: user!.id },
    include: { section: { select: { heading: true, order: true } } },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ highlights })
}
