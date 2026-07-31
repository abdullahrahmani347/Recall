'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/stores/app-store'
import { ArrowLeft } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

/**
 * Backlinks — shows all notes that link TO the current note.
 * Appears below the related notes widget in the editor.
 */
export function Backlinks({ noteId }: { noteId: string }) {
  const openNote = useAppStore((s) => s.openNote)

  const { data, isLoading } = useQuery<{ backlinks: { id: string; title: string; contentPlainText: string; updatedAt: string }[] }>({
    queryKey: ['backlinks', noteId],
    queryFn: () => api(`/api/notes/${noteId}/backlinks`),
    enabled: !!noteId,
  })

  if (isLoading) return null
  const backlinks = data?.backlinks ?? []
  if (backlinks.length === 0) return null

  return (
    <div
      className="rounded-2xl border border-hairline bg-card-surface p-4"
      role="region"
      aria-label="Backlinks"
    >
      <div className="mb-3 flex items-center gap-2">
        <ArrowLeft className="h-4 w-4 text-accent-warm" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Backlinks</h3>
        <span className="text-xs text-muted-recall">{backlinks.length}</span>
      </div>
      <ul className="space-y-1">
        {backlinks.map((note) => (
          <li key={note.id}>
            <button
              onClick={() => openNote(note.id)}
              className="flex w-full items-center justify-between gap-2 rounded-lg p-2 text-left transition hover:bg-void"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{note.title || 'Untitled'}</p>
                <p className="truncate text-xs text-muted-recall">
                  {note.contentPlainText.slice(0, 80)}
                </p>
              </div>
              <span className="shrink-0 text-[10px] text-muted-recall">
                {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
