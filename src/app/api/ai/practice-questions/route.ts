import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, badRequest } from '@/lib/api-helpers'
import ZAI from 'z-ai-web-dev-sdk'
import { z } from 'zod'

const schema = z.object({
  deckId: z.string(),
  count: z.number().int().min(1).max(5).default(3),
})

/**
 * POST /api/ai/practice-questions
 * Body: { deckId, count }
 *
 * Generates scenario-based practice questions from the cards in a deck.
 * Unlike simple flashcards, these test application/understanding:
 * "Given a card with stability=2.5 and difficulty=0.7, what interval
 * would FSRS assign?"
 *
 * Returns an array of questions with model answers.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const parsed = schema.safeParse(body)
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? 'Invalid input')

  const { deckId, count } = parsed.data

  const settings = await db.settings.findUnique({ where: { userId: user!.id } })
  if (settings?.aiProcessingOptOut) {
    return NextResponse.json({ error: 'AI processing is disabled' }, { status: 403 })
  }

  const deck = await db.deck.findFirst({
    where: { id: deckId, userId: user!.id },
    include: {
      flashcards: {
        take: 20,
        select: { front: true, back: true },
      },
    },
  })
  if (!deck) return badRequest('Deck not found')

  if (deck.flashcards.length === 0) {
    return NextResponse.json({ questions: [] })
  }

  const cardSummaries = deck.flashcards
    .map((c, i) => `${i + 1}. Q: ${c.front}\n   A: ${c.back}`)
    .join('\n')

  try {
    const zai = await ZAI.create()
    const prompt = `Based on these flashcards from the "${deck.name}" deck, generate ${count} scenario-based practice questions that test APPLICATION and UNDERSTANDING (not rote recall). Each question should require synthesizing multiple concepts.

Return ONLY a JSON array of { "question": string, "answer": string } objects.

Flashcards:
${cardSummaries}`

    const completion = (await zai.chat.completions.create({
      model: 'glm-4-flash',
      messages: [
        { role: 'system', content: 'You are an expert exam writer. Output only valid JSON arrays.' },
        { role: 'user', content: prompt },
      ],
      stream: false,
    })) as { choices: { message: { content: string } }[] }

    const raw = completion.choices?.[0]?.message?.content ?? ''
    const questions = parseQuestions(raw)

    return NextResponse.json({ questions })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI request failed' },
      { status: 502 }
    )
  }
}

function parseQuestions(raw: string): { question: string; answer: string }[] {
  let text = raw.trim()
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) text = fence[1].trim()
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1) return []
  try {
    const arr = JSON.parse(text.slice(start, end + 1))
    if (!Array.isArray(arr)) return []
    return arr
      .filter((x): x is { question: string; answer: string } =>
        typeof x === 'object' && x !== null &&
        typeof x.question === 'string' && typeof x.answer === 'string'
      )
      .map((x) => ({
        question: x.question.slice(0, 2000),
        answer: x.answer.slice(0, 5000),
      }))
  } catch {
    return []
  }
}
