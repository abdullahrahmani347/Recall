'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Plus, Search, Pin, Check, Trash2, Archive, X } from 'lucide-react'
import { NotebookIcon } from '@/components/icons/recall-icons'
import type { ApiNote, ApiTag } from '@/lib/types'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

export function NotesView() {
  const qc = useQueryClient()
  const openNote = useAppStore((s) => s.openNote)
  const [q, setQ] = useState('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode] = useState(false)

  const { data: notesData, isLoading } = useQuery<{ notes: ApiNote[] }>({
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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selectedIds.size === notes.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(notes.map((n) => n.id)))
    }
  }

  const bulkArchive = async () => {
    const ids = Array.from(selectedIds)
    for (const id of ids) {
      await api(`/api/notes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isArchived: true }),
      })
    }
    qc.invalidateQueries({ queryKey: ['notes'] })
    toast.success(`Archived ${ids.length} note${ids.length === 1 ? '' : 's'}`)
    setSelectedIds(new Set())
    setSelectMode(false)
  }

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} note${selectedIds.size === 1 ? '' : 's'}? This cannot be undone.`)) return
    const ids = Array.from(selectedIds)
    for (const id of ids) {
      await api(`/api/notes/${id}`, { method: 'DELETE' })
    }
    qc.invalidateQueries({ queryKey: ['notes'] })
    toast.success(`Deleted ${ids.length} note${ids.length === 1 ? '' : 's'}`)
    setSelectedIds(new Set())
    setSelectMode(false)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-6 sm:px-6 sm:pt-8">
      {/* HEADER */}
      <header className="mb-6 flex items-center justify-between animate-fade-in-up">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-recall">
            Library
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Notes
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {notes.length > 0 && !selectMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectMode(true)}
              className="border border-hairline bg-card-surface text-secondary-recall press"
            >
              Select
            </Button>
          )}
          <Button
            onClick={() => openNote(null)}
            className="bg-accent-brand text-void hover:bg-accent-brand/90 press shadow-glow-brand"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New
          </Button>
        </div>
      </header>

      {/* BULK ACTION BAR */}
      {selectMode && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-hairline bg-card-surface p-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <button
              onClick={selectAll}
              className="text-sm text-accent-brand hover:underline"
            >
              {selectedIds.size === notes.length ? 'Deselect all' : 'Select all'}
            </button>
            <span className="text-xs text-muted-recall">
              {selectedIds.size} selected
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={bulkArchive}
              disabled={selectedIds.size === 0}
              className="text-secondary-recall hover:text-accent-warm"
            >
              <Archive className="mr-1 h-3.5 w-3.5" />
              Archive
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={bulkDelete}
              disabled={selectedIds.size === 0}
              className="text-secondary-recall hover:text-grade-again"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSelectMode(false); setSelectedIds(new Set()) }}
              className="ml-1 h-8 w-8 p-0 text-muted-recall"
              aria-label="Cancel selection"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-4 animate-fade-in-up stagger-1">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-recall"
          aria-hidden="true"
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search notes…"
          className="glass border-hairline pl-10"
          aria-label="Search notes"
        />
      </div>

      {/* Tag chips */}
      {tagsData?.tags?.length ? (
        <div className="mb-5 flex flex-wrap gap-2 animate-fade-in-up stagger-2">
          <button
            onClick={() => setTagFilter(null)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-smooth press ${
              tagFilter === null
                ? 'border-accent-brand bg-accent-brand-dim text-accent-brand'
                : 'border-hairline bg-card-surface text-secondary-recall hover:text-primary-recall'
            }`}
          >
            All
          </button>
          {tagsData.tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => setTagFilter(tagFilter === tag.id ? null : tag.id)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-smooth press ${
                tagFilter === tag.id
                  ? 'border-accent-brand bg-accent-brand-dim text-accent-brand'
                  : 'border-hairline bg-card-surface text-secondary-recall hover:text-primary-recall'
              }`}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: tag.color }}
                aria-hidden="true"
              />
              {tag.name}
              <span className="text-muted-recall">{tag.noteCount}</span>
            </button>
          ))}
        </div>
      ) : null}

      {/* Notes list */}
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-hairline bg-card-surface p-4">
              <div className="flex items-center justify-between">
                <div className="h-4 w-1/3 shimmer rounded" />
                <div className="h-3 w-16 shimmer rounded" />
              </div>
              <div className="mt-3 h-2.5 w-2/3 shimmer rounded" />
            </div>
          ))}
        </div>
      ) : notes.length === 0 ? (
        <Card className="border border-dashed border-hairline bg-card-surface/50 p-10 text-center animate-fade-in">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-brand-dim text-accent-brand">
            <NotebookIcon size={28} aria-hidden="true" />
          </div>
          <p className="font-medium">No notes here yet</p>
          <p className="mt-1.5 text-sm text-secondary-recall">
            Tap &ldquo;New&rdquo; to capture your first note.
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {notes.map((note, i) => (
            <li
              key={note.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            >
              <button
                onClick={() => selectMode ? toggleSelect(note.id) : openNote(note.id)}
                className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left card-lift press ${
                  selectedIds.has(note.id)
                    ? 'border-accent-brand bg-accent-brand-dim'
                    : 'border-hairline bg-card-surface'
                }`}
              >
                {/* Selection checkbox */}
                {selectMode && (
                  <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                    selectedIds.has(note.id) ? 'border-accent-brand bg-accent-brand text-void' : 'border-hairline'
                  }`}>
                    {selectedIds.has(note.id) && <Check className="h-3 w-3" />}
                  </div>
                )}
                <div className="min-w-0 flex-1">
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
                  <p className="mt-1 line-clamp-2 text-xs text-muted-recall">
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
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
