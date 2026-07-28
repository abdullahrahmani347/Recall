'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/stores/app-store'
import { Link2, ChevronRight } from 'lucide-react'
import type { RelatedNote } from '@/lib/types'
import { formatDistanceToNow } from 'date-fns'

interface RelatedNotesProps {
  noteId: string
}

/**
 * RelatedNotes — shows the top 5 most semantically similar notes to the
 * current one, using TF-IDF cosine similarity (see lib/tfidf.ts).
 * Appears below the summary card in the note editor.
 */
export function RelatedNotes({ noteId }: RelatedNotesProps) {
  const { openNote } = useAppStore()

  const { data, isLoading } = useQuery<{ related: RelatedNote[] }>({
    queryKey: ['related-notes', noteId],
    queryFn: () => api<{ related: RelatedNote[] }>(`/api/notes/${noteId}/related?limit=5`),
    enabled: !!noteId,
  })

  if (isLoading) return null
  const related = data?.related ?? []
  if (related.length === 0) return null

  return (
    <div
      className="rounded-2xl border border-hairline bg-card-surface p-4"
      role="region"
      aria-label="Related notes"
    >
      <div className="mb-3 flex items-center gap-2">
        <Link2 className="h-4 w-4 text-accent-brand" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Related notes</h3>
        <span className="text-xs text-muted-recall">by semantic similarity</span>
      </div>
      <ul className="space-y-1">
        {related.map((note) => (
          <li key={note.id}>
            <button
              onClick={() => openNote(note.id)}
              className="flex w-full items-center justify-between gap-2 rounded-lg p-2 text-left transition hover:bg-void"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{note.title || 'Untitled'}</p>
                <p className="truncate text-xs text-muted-recall">
                  {note.contentPlainText.slice(0, 100)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className="rounded-full bg-accent-brand/10 px-2 py-0.5 text-[10px] font-medium text-accent-brand"
                  title="Similarity score (0–1)"
                >
                  {note.score.toFixed(2)}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-recall" aria-hidden="true" />
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
