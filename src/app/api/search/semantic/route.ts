import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/api-helpers'
import { tokenize, computeIdf, tfidfVector, cosineSimilarity } from '@/lib/tfidf'

/**
 * GET /api/search/semantic?q=...
 * Semantic search using TF-IDF cosine similarity across all of the user's
 * non-archived notes. Returns the top 20 results ranked by relevance,
 * each with a similarity score (0–1).
 *
 * This is a drop-in for pgvector-backed semantic search — when a real
 * embeddings API becomes available, swap the vectorizer in lib/tfidf.ts
 * without changing this endpoint's contract.
 */
export async function GET(req: NextRequest) {
  const { user, response } = await requireUser()
  if (response) return response

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  if (!q) return NextResponse.json({ results: [] })

  const notes = await db.note.findMany({
    where: { userId: user!.id, isArchived: false },
    select: {
      id: true,
      title: true,
      contentPlainText: true,
      updatedAt: true,
      tags: { include: { tag: true } },
    },
    take: 5000, // cap for perf — a personal library rarely exceeds this
  })

  if (notes.length === 0) return NextResponse.json({ results: [] })

  // Tokenize all notes + the query
  const noteTokens = notes.map((n) =>
    tokenize(`${n.title} ${n.contentPlainText}`)
  )
  const queryTokens = tokenize(q)
  if (queryTokens.length === 0) return NextResponse.json({ results: [] })

  // Compute IDF across the corpus
  const idf = computeIdf(noteTokens)
  const queryVec = tfidfVector(queryTokens, idf)
  if (Object.keys(queryVec).length === 0) return NextResponse.json({ results: [] })

  // Score every note
  const scored = notes.map((note, i) => {
    const noteVec = tfidfVector(noteTokens[i], idf)
    const score = cosineSimilarity(queryVec, noteVec)
    return { note, score }
  })

  const results = scored
    .filter((s) => s.score > 0.01)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map((s) => ({
      ...s.note,
      score: Number(s.score.toFixed(4)),
      tags: s.note.tags.map((t) => t.tag),
    }))

  return NextResponse.json({ results })
}
