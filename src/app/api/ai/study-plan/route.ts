import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, badRequest } from '@/lib/api-helpers'
import ZAI from 'z-ai-web-dev-sdk'
import { z } from 'zod'

const schema = z.object({
  examDate: z.string().min(1), // ISO date string
  deckIds: z.array(z.string()).min(1),
  dailyNewCardLimit: z.number().min(1).max(100).optional(),
  dailyReviewLimit: z.number().min(1).max(500).optional(),
})

/**
 * POST /api/ai/study-plan
 * Generates a day-by-day study plan using the z-ai-web-dev-sdk LLM.
 *
 * Input: exam date, deck IDs, optional daily limits
 * Output: { plan: [{ date, newCards, reviewCards, deckFocus, activity }] }
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

  const { examDate, deckIds, dailyNewCardLimit, dailyReviewLimit } = parsed.data
  const newLimit = dailyNewCardLimit ?? settings?.dailyNewCardLimit ?? 20
  const reviewLimit = dailyReviewLimit ?? settings?.dailyReviewLimit ?? 200

  // Gather deck stats
  const decks = await db.deck.findMany({
    where: { id: { in: deckIds }, userId: user!.id },
    include: {
      flashcards: {
        select: { schedulingState: { select: { dueDate: true, repetitions: true } } },
      },
    },
  })

  const deckStats = decks.map((d) => {
    const total = d.flashcards.length
    const newCards = d.flashcards.filter((c) => !c.schedulingState).length
    const dueNow = d.flashcards.filter(
      (c) => c.schedulingState && c.schedulingState.dueDate <= new Date()
    ).length
    const learned = d.flashcards.filter(
      (c) => c.schedulingState && c.schedulingState.repetitions > 0
    ).length
    return { id: d.id, name: d.name, color: d.color, total, newCards, dueNow, learned }
  })

  const totalCards = deckStats.reduce((s, d) => s + d.total, 0)
  const totalNew = deckStats.reduce((s, d) => s + d.newCards, 0)

  // Calculate days until exam
  const now = new Date()
  const exam = new Date(examDate)
  const daysUntilExam = Math.max(1, Math.ceil((exam.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))

  // Build prompt
  const prompt = `You are a study planning assistant. Create a day-by-day study plan.

Context:
- Exam date: ${examDate}
- Days until exam: ${daysUntilExam}
- Daily new card limit: ${newLimit}
- Daily review limit: ${reviewLimit}

Decks:
${deckStats.map((d) => `- "${d.name}": ${d.total} total cards, ${d.newCards} new, ${d.dueNow} due now, ${d.learned} learned`).join('\n')}

Total: ${totalCards} cards (${totalNew} new).

Create a JSON study plan as an array of day objects. Each day has:
- "day": day number (1 to ${daysUntilExam})
- "date": ISO date string (YYYY-MM-DD)
- "newCards": number of new cards to learn that day
- "reviewCards": estimated number of reviews that day
- "deckFocus": name of the deck to prioritize that day
- "activity": one of "new-learning", "review-heavy", "mixed", "practice-test", "light-review", "rest"

Rules:
- Distribute new cards so all ${totalNew} are learned before the exam
- Don't exceed ${newLimit} new cards per day
- Schedule practice-test days periodically (every 3-4 days)
- Include 1-2 rest/light-review days
- The last 2 days before the exam should be review-heavy (no new cards)

Return ONLY a JSON array, no markdown, no explanation.`

  try {
    const zai = await ZAI.create()
    const result = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a study planning assistant that outputs only valid JSON.' },
        { role: 'user', content: prompt },
      ],
    })

    const content = (result as any)?.choices?.[0]?.message?.content || (result as any)?.content || ''

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content.trim()
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim()

    let plan: any[]
    try {
      plan = JSON.parse(jsonStr)
    } catch {
      // Try to find array in the text
      const arrayMatch = jsonStr.match(/\[[\s\S]*\]/)
      if (arrayMatch) {
        plan = JSON.parse(arrayMatch[0])
      } else {
        throw new Error('Could not parse AI response as JSON')
      }
    }

    return NextResponse.json({
      plan,
      summary: {
        daysUntilExam,
        totalCards,
        totalNew,
        decks: deckStats,
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Study plan generation failed' },
      { status: 502 }
    )
  }
}
