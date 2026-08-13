import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'
import ZAI from 'z-ai-web-dev-sdk'

/**
 * GET /api/ai/concept-map
 *
 * Uses the AI to extract key concepts from all notes and build a
 * visual concept map showing how ideas connect — even across notes
 * that don't have explicit [[links]].
 *
 * Process:
 * 1. Gather all notes' text (limited to ~50 notes for context window)
 * 2. Ask the LLM to extract key concepts and their relationships
 * 3. Return nodes (concepts) and edges (relationships)
 *
 * Returns { nodes: [{ id, label, noteIds }], edges: [{ source, target, label }] }
 */
export async function GET() {
  const { user, response } = await requireUser()
  if (response) return response

  const settings = await db.settings.findUnique({ where: { userId: user!.id } })
  if (settings?.aiProcessingOptOut) {
    return NextResponse.json({ error: 'AI processing is disabled' }, { status: 403 })
  }

  // Gather notes (limit to 50 for context window)
  const notes = await db.note.findMany({
    where: { userId: user!.id, isArchived: false },
    select: { id: true, title: true, contentPlainText: true },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })

  if (notes.length === 0) {
    return NextResponse.json({ nodes: [], edges: [], message: 'No notes found' })
  }

  // Build a compact representation for the LLM
  const notesText = notes
    .map((n, i) => `[Note ${i + 1}] ${n.title}\n${n.contentPlainText.slice(0, 500)}`)
    .join('\n\n---\n\n')

  const prompt = `Analyze the following notes and extract key concepts and their relationships.

Notes:
${notesText}

Return a JSON object with this exact structure:
{
  "nodes": [
    { "id": "concept-1", "label": "Concept Name", "noteIndices": [1, 3] }
  ],
  "edges": [
    { "source": "concept-1", "target": "concept-2", "label": "related to" }
  ]
}

Rules:
- Extract 5-15 key concepts (nodes)
- Each node's "noteIndices" refers to the note numbers (1-based) that mention this concept
- Create 3-10 edges showing how concepts relate
- Keep labels short (1-3 words)
- Return ONLY valid JSON, no markdown or explanation`

  try {
    const zai = await ZAI.create()
    const result = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: 'You are a knowledge graph assistant that outputs only valid JSON.' },
        { role: 'user', content: prompt },
      ],
    })

    const content = (result as any)?.choices?.[0]?.message?.content || (result as any)?.content || ''

    // Extract JSON from response
    let jsonStr = content.trim()
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim()

    let parsed: { nodes: any[]; edges: any[] }
    try {
      parsed = JSON.parse(jsonStr)
    } catch {
      const arrayMatch = jsonStr.match(/\{[\s\S]*\}/)
      if (arrayMatch) {
        parsed = JSON.parse(arrayMatch[0])
      } else {
        throw new Error('Could not parse AI response as JSON')
      }
    }

    // Map note indices back to note IDs
    const nodes = (parsed.nodes || []).map((n: any) => ({
      id: n.id,
      label: n.label,
      noteIds: (n.noteIndices || []).map((idx: number) => notes[idx - 1]?.id).filter(Boolean),
    }))

    const edges = (parsed.edges || []).map((e: any, i: number) => ({
      id: `edge-${i}`,
      source: e.source,
      target: e.target,
      label: e.label || 'related',
    }))

    return NextResponse.json({ nodes, edges, noteCount: notes.length })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Concept map generation failed' },
      { status: 502 }
    )
  }
}
