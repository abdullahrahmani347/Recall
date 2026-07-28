import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser, notFound } from '@/lib/api-helpers'
import { tokenize, computeIdf, tfidfVector, cosineSimilarity } from '@/lib/tfidf'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/notes/[id]/related?limit=5
 * Returns the most semantically similar notes to the given note,
 * ranked by TF-IDF cosine similarity. Excludes the source note and
 * archived notes.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const { user, response } = await requireUser()
  if (response) return response

  const { id } = await params
  const sourceNote = await db.note.findFirst({
    where: { id, userId: user!.id },
    select: { id: true, title: true, contentPlainText: true },
  })
  if (!sourceNote) return notFound('Note not found')

  const url = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '5', 10), 20)

  // Pull candidate notes (exclude source + archived)
  const candidates = await db.note.findMany({
    where: {
      userId: user!.id,
      isArchived: false,
      NOT: { id },
    },
    select: {
      id: true,
      title: true,
      contentPlainText: true,
      updatedAt: true,
      tags: { include: { tag: true } },
    },
    take: 5000,
  })

  if (candidates.length === 0) return NextResponse.json({ related: [] })

  // Build a mini-corpus: source note + candidates
  const sourceTokens = tokenize(`${sourceNote.title} ${sourceNote.contentPlainText}`)
  const candidateTokens = candidates.map((c) =>
    tokenize(`${c.title} ${c.contentPlainText}`)
  )
  const idf = computeIdf([sourceTokens, ...candidateTokens])
  const sourceVec = tfidfVector(sourceTokens, idf)

  const scored = candidates.map((note, i) => {
    const vec = tfidfVector(candidateTokens[i], idf)
    return { note, score: cosineSimilarity(sourceVec, vec) }
  })

  const related = scored
    .filter((s) => s.score > 0.03)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => ({
      ...s.note,
      score: Number(s.score.toFixed(4)),
      tags: s.note.tags.map((t) => t.tag),
    }))

  return NextResponse.json({ related })
}
