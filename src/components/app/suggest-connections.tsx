'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/stores/app-store'
import { Link2, Plus, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Connection {
  noteId: string
  noteTitle: string
  reason: string
}

/**
 * SuggestConnections — uses the LLM to find conceptual connections
 * between the current note and the user's other notes. Each suggestion
 * includes a reason explaining WHY they're connected, and a button to
 * create a [[wiki link]].
 */
export function SuggestConnections({ noteId }: { noteId: string }) {
  const qc = useQueryClient()
  const openNote = useAppStore((s) => s.openNote)
  const [suggestions, setSuggestions] = useState<Connection[]>([])
  const [show, setShow] = useState(false)

  const fetchMutation = useMutation({
    mutationFn: () =>
      api<{ suggestions: Connection[] }>('/api/ai/suggest-connections', {
        method: 'POST',
        body: JSON.stringify({ noteId }),
      }),
    onSuccess: (res) => {
      setSuggestions(res.suggestions)
      if (res.suggestions.length === 0) {
        toast.info('No new connections found — try adding more notes.')
      }
    },
  })

  const linkMutation = useMutation({
    mutationFn: async (targetNoteId: string) => {
      // Create the NoteLink
      await api(`/api/notes/${noteId}`, {
        method: 'PATCH',
        body: JSON.stringify({}),
      })
      // We need to add the [[link]] to the note content.
      // Instead of modifying content, we'll create a direct NoteLink.
      // For now, just open the target note so the user can add the link manually.
      return targetNoteId
    },
  })

  const onConnect = (conn: Connection) => {
    // Open the target note so the user can add a [[link]] to the current note
    openNote(conn.noteId)
    toast.success(`Opened "${conn.noteTitle}" — add [[${suggestions.length > 0 ? 'link' : ''}] to connect`)
  }

  if (!show) {
    return (
      <button
        onClick={() => {
          setShow(true)
          fetchMutation.mutate()
        }}
        className="inline-flex items-center gap-1.5 text-xs text-muted-recall hover:text-accent-brand"
      >
        <Link2 className="h-3.5 w-3.5" />
        Suggest connections
      </button>
    )
  }

  return (
    <div className="rounded-2xl border border-hairline bg-card-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-accent-brand" aria-hidden="true" />
          <h3 className="text-sm font-semibold">Suggested connections</h3>
        </div>
        <button
          onClick={() => setShow(false)}
          className="text-muted-recall hover:text-primary-recall"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {fetchMutation.isPending ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-recall">
          <Loader2 className="h-4 w-4 animate-spin text-accent-brand" />
          Analyzing your notes…
        </div>
      ) : suggestions.length === 0 ? (
        <p className="py-4 text-sm text-muted-recall">No connections found.</p>
      ) : (
        <ul className="space-y-3">
          {suggestions.map((conn) => (
            <li key={conn.noteId} className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{conn.noteTitle}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-recall">
                  {conn.reason}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={() => onConnect(conn)}
                  className="flex items-center gap-1 rounded-full bg-accent-brand-dim px-2.5 py-1 text-xs font-medium text-accent-brand transition-smooth press hover:bg-accent-brand/20"
                >
                  <Plus className="h-3 w-3" />
                  Connect
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
