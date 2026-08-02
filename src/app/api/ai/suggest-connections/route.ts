import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, badRequest } from '@/lib/api-helpers'
import ZAI from 'z-ai-web-dev-sdk'

/**
 * POST /api/ai/suggest-connections
 * Body: { noteId }
 *
 * Uses the LLM to find semantic connections between the given note
 * and the user's other notes. Returns suggested [[wiki links]]
 * with a reason for each connection.
 *
 * Unlike the TF-IDF "related notes" (which is keyword-based), this
 * uses the LLM to understand conceptual relationships.
 */
export async function POST(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const body = await req.json().catch(() => null)
  if (!body) return badRequest('Invalid JSON')
  const noteId = body.noteId as string
  if (!noteId) return badRequest('noteId required')

  const settings = await db.settings.findUnique({ where: { userId: user!.id } })
  if (settings?.aiProcessingOptOut) {
    return NextResponse.json({ error: 'AI processing is disabled' }, { status: 403 })
  }

  // Get the source note
  const sourceNote = await db.note.findFirst({
    where: { id: noteId, userId: user!.id },
    select: { id: true, title: true, contentPlainText: true },
  })
  if (!sourceNote) return badRequest('Note not found')

  // Get other notes (exclude the source, limit to 50 most recent)
  const otherNotes = await db.note.findMany({
    where: { userId: user!.id, id: { not: noteId }, isArchived: false },
    select: { id: true, title: true, contentPlainText: true },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })

  if (otherNotes.length === 0) {
    return NextResponse.json({ suggestions: [] })
  }

  // Check existing links to avoid suggesting duplicates
  const existingLinks = await db.noteLink.findMany({
    where: { fromNoteId: noteId },
    select: { toNoteId: true },
  })
  const linkedIds = new Set(existingLinks.map((l) => l.toNoteId))

  // Filter out already-linked notes
  const candidates = otherNotes.filter((n) => !linkedIds.has(n.id))
  if (candidates.length === 0) {
    return NextResponse.json({ suggestions: [] })
  }

  // Build a compact list of candidate notes
  const noteList = candidates
    .map((n, i) => `[${i}] "${n.title}" — ${n.contentPlainText.slice(0, 150)}`)
    .join('\n')

  try {
    const zai = await ZAI.create()
    const prompt = `Source note: "${sourceNote.title}" — ${sourceNote.contentPlainText.slice(0, 500)}

Other notes:
${noteList}

Find up to 3 notes from the list above that are conceptually related to the source note (not just keyword matches — think about underlying concepts, themes, or applications). For each, explain WHY they're connected in one sentence.

Return ONLY a JSON array of { "index": number, "reason": string } where index is the [N] from the list above.`

    const completion = (await zai.chat.completions.create({
      model: 'glm-4-flash',
      messages: [
        { role: 'system', content: 'You are a knowledge management assistant. Output only valid JSON arrays.' },
        { role: 'user', content: prompt },
      ],
      stream: false,
    })) as { choices: { message: { content: string } }[] }

    const raw = completion.choices?.[0]?.message?.content ?? ''
    const parsed = parseSuggestions(raw)

    // Map indices back to note IDs
    const suggestions = parsed
      .filter((s) => s.index >= 0 && s.index < candidates.length)
      .map((s) => ({
        noteId: candidates[s.index].id,
        noteTitle: candidates[s.index].title,
        reason: s.reason,
      }))

    return NextResponse.json({ suggestions })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI request failed' },
      { status: 502 }
    )
  }
}

function parseSuggestions(raw: string): { index: number; reason: string }[] {
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
      .filter((x): x is { index: number; reason: string } =>
        typeof x === 'object' && x !== null &&
        typeof x.index === 'number' && typeof x.reason === 'string'
      )
      .map((x) => ({ index: x.index, reason: x.reason.slice(0, 300) }))
  } catch {
    return []
  }
}
