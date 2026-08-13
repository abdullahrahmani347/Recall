import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, badRequest } from '@/lib/api-helpers'
import ZAI from 'z-ai-web-dev-sdk'
import { z } from 'zod'

const schema = z.object({
  query: z.string().min(1).max(500),
})

/**
 * POST /api/ai/nl-search
 * Body: { query: string }
 *
 * Uses the AI to parse a natural language search query and translate it
 * into database query parameters, then executes the search.
 *
 * Example: "show me all cards about photosynthesis that I got wrong last week"
 * → { type: "cards", keywords: ["photosynthesis"], grade: "again", dateRange: "last-week" }
 *
 * Returns { results: { notes: [], cards: [] }, interpretation: string }
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = schema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  const settings = await db.settings.findUnique({ where: { userId: user!.id } })
  if (settings?.aiProcessingOptOut) {
    return NextResponse.json({ error: 'AI processing is disabled' }, { status: 403 })
  }

  const nlQuery = parsed.data.query

  const prompt = `Parse this natural language search query and return a JSON object with search parameters.

Query: "${nlQuery}"

Return JSON with this exact structure:
{
  "type": "notes" | "cards" | "all",
  "keywords": ["word1", "word2"],
  "grade": "again" | "hard" | "good" | "easy" | null,
  "dateRange": "today" | "yesterday" | "last-week" | "last-month" | null,
  "tag": "tag-name-or-null",
  "deckName": "deck-name-or-null",
  "explanation": "Brief one-sentence explanation of what the user is looking for"
}

Rules:
- Extract keywords for text search (ignore stop words like "show", "me", "all", "about", "that", "I")
- If the query mentions a grade (e.g. "got wrong", "failed" → "again"; "easy" → "easy"), set the grade field
- If the query mentions a time period, set dateRange
- If the query mentions a tag or category, set tag
- If the query mentions a deck or subject, set deckName
- type is "cards" if the query mentions cards/flashcards, "notes" if it mentions notes, "all" otherwise
- Return ONLY valid JSON, no markdown`

  try {
    const zai = await ZAI.create()
    const result = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a search query parser that outputs only valid JSON.' },
        { role: 'user', content: prompt },
      ],
    })

    const content = (result as any)?.choices?.[0]?.message?.content || (result as any)?.content || ''

    // Extract JSON
    let jsonStr = content.trim()
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim()

    let params: any
    try {
      params = JSON.parse(jsonStr)
    } catch {
      const objMatch = jsonStr.match(/\{[\s\S]*\}/)
      if (objMatch) {
        params = JSON.parse(objMatch[0])
      } else {
        throw new Error('Could not parse AI response as JSON')
      }
    }

    // Build date filter
    let dateFilter: { gte?: Date } | undefined
    if (params.dateRange) {
      const now = new Date()
      const start = new Date(now)
      switch (params.dateRange) {
        case 'today': start.setHours(0, 0, 0, 0); break
        case 'yesterday': start.setDate(start.getDate() - 1); break
        case 'last-week': start.setDate(start.getDate() - 7); break
        case 'last-month': start.setMonth(start.getMonth() - 1); break
      }
      dateFilter = { gte: start }
    }

    // Search notes
    const keywords = params.keywords || []
    const searchText = keywords.join(' ')

    const notesWhere: any = {
      userId: user!.id,
      isArchived: false,
    }

    if (searchText) {
      notesWhere.OR = [
        { title: { contains: searchText } },
        { contentPlainText: { contains: searchText } },
      ]
    }

    if (params.tag && params.tag !== 'null') {
      notesWhere.tags = { some: { tag: { name: { contains: params.tag } } } }
    }

    if (dateFilter) {
      notesWhere.updatedAt = dateFilter
    }

    // Search cards
    const cardsWhere: any = {
      deck: { userId: user!.id },
    }

    if (searchText) {
      cardsWhere.OR = [
        { front: { contains: searchText } },
        { back: { contains: searchText } },
      ]
    }

    if (params.deckName && params.deckName !== 'null') {
      cardsWhere.deck = { userId: user!.id, name: { contains: params.deckName } }
    }

    // If grade filter is specified, search review logs
    let cardsFromReviews: any[] = []
    if (params.grade && params.grade !== 'null' && dateFilter) {
      const reviewLogs = await db.reviewLog.findMany({
        where: {
          userId: user!.id,
          grade: params.grade,
          reviewedAt: dateFilter,
        },
        include: {
          card: {
            include: { deck: { select: { id: true, name: true, color: true } } },
          },
        },
        distinct: ['cardId'],
        take: 50,
      })
      cardsFromReviews = reviewLogs.map((r) => r.card).filter(Boolean)
    }

    const [notes, cards] = await Promise.all([
      (params.type === 'all' || params.type === 'notes')
        ? db.note.findMany({
            where: notesWhere,
            include: { tags: { include: { tag: true } } },
            orderBy: { updatedAt: 'desc' },
            take: 30,
          })
        : Promise.resolve([]),
      (params.type === 'all' || params.type === 'cards')
        ? params.grade && params.grade !== 'null'
          ? Promise.resolve(cardsFromReviews)
          : db.flashcard.findMany({
              where: cardsWhere,
              include: { deck: { select: { id: true, name: true, color: true } } },
              orderBy: { createdAt: 'desc' },
              take: 30,
            })
        : Promise.resolve([]),
    ])

    return NextResponse.json({
      results: { notes, cards },
      interpretation: params.explanation || `Searched for: ${searchText}`,
      params,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Natural language search failed' },
      { status: 502 }
    )
  }
}
