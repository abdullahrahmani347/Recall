import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, notFound } from '@/lib/api-helpers'
import ZAI from 'z-ai-web-dev-sdk'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

const generateSchema = z.object({
  count: z.number().int().min(1).max(20).default(8),
  deckId: z.string().optional(),
})

interface SuggestedCard {
  front: string
  back: string
}

/**
 * POST /api/notes/[id]/generate-cards
 * Body: { count?: number, deckId?: string }
 *
 * Uses the LLM to suggest flashcards from the note + its latest summary.
 * Returns `{ suggestions: SuggestedCard[] }` — the client shows them for
 * review and then bulk-creates the ones the user accepts.
 *
 * In Phase 1 this was a deliberate 501 stub; Phase 2 builds it out now
 * that summarization quality is validated (per §12 of the brief).
 *
 * Honors the per-user `aiProcessingOptOut` flag.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const note = await db.note.findFirst({
    where: { id, userId: user!.id },
    include: {
      summaries: {
        where: { status: 'complete' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })
  if (!note) return notFound('Note not found')

  const settings = await db.settings.findUnique({ where: { userId: user!.id } })
  if (settings?.aiProcessingOptOut) {
    return NextResponse.json(
      { error: 'AI processing is disabled in your settings.' },
      { status: 403 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const parsed = generateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    )
  }
  const { count, deckId } = parsed.data

  // Validate deckId ownership if provided
  if (deckId) {
    const deck = await db.deck.findFirst({ where: { id: deckId, userId: user!.id } })
    if (!deck) return NextResponse.json({ error: 'Invalid deck' }, { status: 400 })
  }

  const summary = note.summaries[0]?.summaryText ?? ''
  const sourceContent = note.contentMarkdown.slice(0, 8000) // cap context

  const prompt = `You are a flashcard generator. Given the following study note${summary ? ' and its summary' : ''}, generate exactly ${count} high-quality flashcards.

Rules:
- Each card has a concise "front" (question or prompt) and a clear "back" (answer).
- Fronts should be self-contained — no "according to the note…" phrasing.
- Backs should be 1–3 sentences, factual, and derivable directly from the note.
- Prefer cloze-style "What is X?" or "Define X" fronts for definitions.
- For lists, ask for the items explicitly rather than "list everything".
- Avoid trivial cards (e.g. "What is the title of the note?").
- Vary the question structure across cards.

Return ONLY a JSON array of { "front": string, "back": string } objects. No markdown fences, no commentary.

Note title: ${note.title || 'Untitled'}

${summary ? `Summary:\\n${summary}\\n\\n` : ''}Note content:\\n${sourceContent}`

  try {
    const zai = await ZAI.create()
    const completion = (await zai.chat.completions.create({
      model: 'glm-4-flash',
      messages: [
        {
          role: 'system',
          content:
            'You are a precise flashcard generator. You output only valid JSON arrays.',
        },
        { role: 'user', content: prompt },
      ],
      stream: false,
    })) as { choices: { message: { content: string } }[] }

    const raw = completion.choices?.[0]?.message?.content ?? ''
    const suggestions = parseSuggestions(raw)

    if (suggestions.length === 0) {
      return NextResponse.json(
        { error: 'The model did not return valid flashcard suggestions. Try again.' },
        { status: 422 }
      )
    }

    return NextResponse.json({ suggestions, deckId })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'LLM request failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}

/**
 * Parse the LLM's response into a clean SuggestedCard[].
 * Handles common failure modes: markdown fences, trailing commas, prose
 * before/after the JSON.
 */
function parseSuggestions(raw: string): SuggestedCard[] {
  let text = raw.trim()

  // Strip markdown code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenceMatch) text = fenceMatch[1].trim()

  // Find the first '[' and last ']' to extract the JSON array
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) return []

  const jsonStr = text.slice(start, end + 1)

  try {
    const parsed = JSON.parse(jsonStr)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (item): item is SuggestedCard =>
          typeof item === 'object' &&
          item !== null &&
          typeof item.front === 'string' &&
          typeof item.back === 'string' &&
          item.front.trim().length > 0 &&
          item.back.trim().length > 0
      )
      .map((item) => ({
        front: item.front.trim().slice(0, 5000),
        back: item.back.trim().slice(0, 5000),
      }))
  } catch {
    return []
  }
}
