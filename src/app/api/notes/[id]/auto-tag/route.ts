import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, notFound } from '@/lib/api-helpers'
import ZAI from 'z-ai-web-dev-sdk'

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/notes/[id]/auto-tag
 * Analyzes the note content with the LLM and suggests up to 5 tags
 * based on the content. Returns tag names + suggested colors.
 *
 * Honors aiProcessingOptOut.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const note = await db.note.findFirst({
    where: { id, userId: user!.id },
    select: { id: true, title: true, contentPlainText: true },
  })
  if (!note) return notFound('Note not found')

  const settings = await db.settings.findUnique({ where: { userId: user!.id } })
  if (settings?.aiProcessingOptOut) {
    return NextResponse.json({ error: 'AI processing is disabled' }, { status: 403 })
  }

  // Get existing tags so we don't suggest duplicates
  const existingTags = await db.tag.findMany({
    where: { userId: user!.id },
    select: { name: true },
  })
  const existingNames = new Set(existingTags.map((t) => t.name.toLowerCase()))

  try {
    const zai = await ZAI.create()
    const prompt = `Analyze this note and suggest up to 5 concise tags (1-2 words each, lowercase). Return ONLY a JSON array of strings.

Existing tags (don't suggest these): ${JSON.stringify(Array.from(existingNames))}

Note title: ${note.title || 'Untitled'}
Note content: ${note.contentPlainText.slice(0, 2000)}`

    const completion = (await zai.chat.completions.create({
      model: 'glm-4-flash',
      messages: [
        { role: 'system', content: 'You are a tagging assistant. Output only a JSON array of strings.' },
        { role: 'user', content: prompt },
      ],
      stream: false,
    })) as { choices: { message: { content: string } }[] }

    const raw = completion.choices?.[0]?.message?.content ?? ''
    const tags = parseTagArray(raw).filter((t: string) => !existingNames.has(t.toLowerCase()))

    // Assign colors from a palette
    const colors = ['#34E7A8', '#FFB454', '#4C8CFF', '#F5A623', '#F0554B']
    const suggestions = tags.slice(0, 5).map((name: string, i: number) => ({
      name,
      color: colors[i % colors.length],
    }))

    return NextResponse.json({ suggestions })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'AI request failed' },
      { status: 502 }
    )
  }
}

function parseTagArray(raw: string): string[] {
  let text = raw.trim()
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) text = fence[1].trim()
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end === -1) return []
  try {
    const arr = JSON.parse(text.slice(start, end + 1))
    if (!Array.isArray(arr)) return []
    return arr.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length <= 60)
  } catch {
    return []
  }
}
