import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/marketplace/[id]
 * Get details of a published deck.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const published = await db.publishedDeck.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, avatarUrl: true } },
      deck: {
        select: {
          name: true,
          flashcards: { select: { id: true, front: true, back: true, cardType: true } },
        },
      },
    },
  })

  if (!published) return NextResponse.json({ error: 'Deck not found' }, { status: 404 })

  return NextResponse.json({
    id: published.id,
    title: published.title,
    description: published.description,
    category: published.category,
    tags: JSON.parse(published.tags),
    downloads: published.downloads,
    rating: published.rating,
    ratingCount: published.ratingCount,
    isFeatured: published.isFeatured,
    author: published.user,
    cards: published.deck.flashcards,
    createdAt: published.createdAt,
  })
}

/**
 * DELETE /api/marketplace/[id]
 * Remove a deck from the marketplace (only the owner can do this).
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const published = await db.publishedDeck.findUnique({ where: { id } })
  if (!published) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (published.userId !== user!.id) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  await db.publishedDeck.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
