import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, badRequest } from '@/lib/api-helpers'
import { z } from 'zod'

/**
 * GET /api/marketplace?category=...&q=...&page=1
 * Browse public community decks.
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const url = new URL(req.url)
  const category = url.searchParams.get('category') || 'all'
  const q = url.searchParams.get('q')
  const page = parseInt(url.searchParams.get('page') ?? '1', 10)
  const limit = 20

  const where: any = {}
  if (category !== 'all') where.category = category
  if (q) where.OR = [{ title: { contains: q } }, { description: { contains: q } }]

  const [decks, total] = await Promise.all([
    db.publishedDeck.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        deck: { select: { id: true, name: true, flashcards: { select: { id: true } } } },
      },
      orderBy: [{ isFeatured: 'desc' }, { downloads: 'desc' }, { rating: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.publishedDeck.count({ where }),
  ])

  return NextResponse.json({
    decks: decks.map(d => ({
      id: d.id,
      title: d.title,
      description: d.description,
      category: d.category,
      tags: JSON.parse(d.tags),
      downloads: d.downloads,
      rating: d.rating,
      ratingCount: d.ratingCount,
      isFeatured: d.isFeatured,
      author: d.user,
      deckId: d.deckId,
      cardCount: d.deck?.flashcards.length ?? 0,
      createdAt: d.createdAt,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  })
}

const publishSchema = z.object({
  deckId: z.string(),
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  category: z.enum(['science', 'language', 'medical', 'law', 'tech', 'general']).default('general'),
  tags: z.array(z.string()).max(10).optional(),
})

/**
 * POST /api/marketplace
 * Publish a deck to the public marketplace.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = publishSchema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  const deck = await db.deck.findFirst({ where: { id: parsed.data.deckId, userId: user!.id } })
  if (!deck) return NextResponse.json({ error: 'Deck not found' }, { status: 404 })

  // Check if already published
  const existing = await db.publishedDeck.findUnique({ where: { deckId: parsed.data.deckId } })
  if (existing) return badRequest('Deck already published')

  const published = await db.publishedDeck.create({
    data: {
      deckId: parsed.data.deckId,
      userId: user!.id,
      title: parsed.data.title,
      description: parsed.data.description || '',
      category: parsed.data.category,
      tags: JSON.stringify(parsed.data.tags || []),
    },
  })

  return NextResponse.json({ ok: true, publishedId: published.id }, { status: 201 })
}
