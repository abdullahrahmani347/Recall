'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Plus, Search, Pin } from 'lucide-react'
import type { ApiNote, ApiTag } from '@/lib/types'
import { formatDistanceToNow } from 'date-fns'

export function NotesView() {
  const { openNote } = useAppStore()
  const [q, setQ] = useState('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)

  const { data: notesData } = useQuery<{ notes: ApiNote[] }>({
    queryKey: ['notes', { q, tagId: tagFilter }],
    queryFn: () => {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (tagFilter) params.set('tagId', tagFilter)
      return api<{ notes: ApiNote[] }>(`/api/notes${params.size ? `?${params.toString()}` : ''}`)
    },
  })

  const { data: tagsData } = useQuery<{ tags: (ApiTag & { noteCount: number })[] }>({
    queryKey: ['tags'],
    queryFn: () => api<{ tags: (ApiTag & { noteCount: number })[] }>('/api/tags'),
  })

  const notes = notesData?.notes ?? []

  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-6 sm:px-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-recall">Library</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Notes</h1>
        </div>
        <Button
          onClick={() => openNote(null)}
          className="bg-accent-brand text-void hover:bg-accent-brand/90"
        >
          <Plus className="mr-1 h-4 w-4" />
          New
        </Button>
      </header>

      {/* Search */}
      <div className="relative mb-4">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-recall"
          aria-hidden="true"
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search notes…"
          className="bg-card-surface pl-9"
          aria-label="Search notes"
        />
      </div>

      {/* Tag chips */}
      {tagsData?.tags?.length ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setTagFilter(null)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              tagFilter === null
                ? 'border-accent-brand bg-accent-brand/10 text-accent-brand'
                : 'border-hairline bg-card-surface text-secondary-recall hover:text-primary-recall'
            }`}
          >
            All
          </button>
          {tagsData.tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => setTagFilter(tagFilter === tag.id ? null : tag.id)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                tagFilter === tag.id
                  ? 'border-accent-brand bg-accent-brand/10 text-accent-brand'
                  : 'border-hairline bg-card-surface text-secondary-recall hover:text-primary-recall'
              }`}
              style={{
                borderColor: tagFilter === tag.id ? tag.color : undefined,
              }}
            >
              <span
                className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                style={{ backgroundColor: tag.color }}
                aria-hidden="true"
              />
              {tag.name}
              <span className="ml-1 text-muted-recall">{tag.noteCount}</span>
            </button>
          ))}
        </div>
      ) : null}

      {/* Notes list */}
      {notes.length === 0 ? (
        <Card className="border border-dashed border-hairline bg-card-surface/50 p-8 text-center">
          <p className="font-medium">No notes here yet</p>
          <p className="mt-1 text-sm text-secondary-recall">
            Tap "New" to capture your first note.
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li key={note.id}>
              <button
                onClick={() => openNote(note.id)}
                className="flex w-full flex-col gap-1 rounded-xl border border-hairline bg-card-surface p-4 text-left transition hover:border-accent-brand/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    {note.isPinned && (
                      <Pin className="h-3 w-3 shrink-0 text-accent-warm" aria-hidden="true" />
                    )}
                    <p className="truncate text-sm font-medium">
                      {note.title || 'Untitled'}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-recall">
                    {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
                  </span>
                </div>
                <p className="line-clamp-2 text-xs text-muted-recall">
                  {note.contentPlainText.slice(0, 200) || 'Empty note'}
                </p>
                {note.tags?.length ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {note.tags.map(({ tag }) => (
                      <span
                        key={tag.id}
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: `${tag.color}20`,
                          color: tag.color,
                        }}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </div>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
