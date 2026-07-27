'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/stores/app-store'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Search as SearchIcon, Notebook, Layers } from 'lucide-react'
import type { ApiNote, ApiFlashcard, ApiTag } from '@/lib/types'
import { formatDistanceToNow } from 'date-fns'

export function SearchView() {
  const { openNote, openDeck } = useAppStore()
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [type, setType] = useState<'all' | 'notes' | 'cards'>('all')
  const [tagId, setTagId] = useState<string | null>(null)

  // Debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250)
    return () => clearTimeout(t)
  }, [q])

  const { data, isFetching } = useQuery<{ notes: ApiNote[]; cards: ApiFlashcard[] }>({
    queryKey: ['search', debouncedQ, type, tagId],
    queryFn: () => {
      const params = new URLSearchParams()
      params.set('q', debouncedQ)
      params.set('type', type)
      if (tagId) params.set('tagId', tagId)
      return api(`/api/search?${params.toString()}`)
    },
    enabled: debouncedQ.length > 0,
  })

  const { data: tagsData } = useQuery<{ tags: (ApiTag & { noteCount: number })[] }>({
    queryKey: ['tags'],
    queryFn: () => api('/api/tags'),
  })

  const notes = data?.notes ?? []
  const cards = data?.cards ?? []

  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-6 sm:px-6">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wider text-muted-recall">Find</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Search</h1>
      </header>

      <div className="relative mb-4">
        <SearchIcon
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-recall"
          aria-hidden="true"
        />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search notes and flashcards…"
          className="bg-card-surface pl-9"
          aria-label="Search query"
        />
      </div>

      {/* Type filter */}
      <div className="mb-3 flex gap-2">
        {(['all', 'notes', 'cards'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              type === t
                ? 'border-accent-brand bg-accent-brand/10 text-accent-brand'
                : 'border-hairline bg-card-surface text-secondary-recall hover:text-primary-recall'
            }`}
          >
            {t === 'all' ? 'All' : t === 'notes' ? 'Notes' : 'Cards'}
          </button>
        ))}
      </div>

      {/* Tag filter */}
      {tagsData?.tags?.length ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setTagId(null)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              tagId === null
                ? 'border-accent-brand bg-accent-brand/10 text-accent-brand'
                : 'border-hairline bg-card-surface text-secondary-recall hover:text-primary-recall'
            }`}
          >
            Any tag
          </button>
          {tagsData.tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => setTagId(tagId === tag.id ? null : tag.id)}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                tagId === tag.id
                  ? 'border-accent-brand bg-accent-brand/10 text-accent-brand'
                  : 'border-hairline bg-card-surface text-secondary-recall hover:text-primary-recall'
              }`}
            >
              {tag.name}
            </button>
          ))}
        </div>
      ) : null}

      {/* Results */}
      {!debouncedQ ? (
        <Card className="border border-dashed border-hairline bg-card-surface/50 p-8 text-center text-sm text-muted-recall">
          Start typing to search your notes and flashcards.
        </Card>
      ) : isFetching ? (
        <p className="text-sm text-muted-recall">Searching…</p>
      ) : notes.length === 0 && cards.length === 0 ? (
        <Card className="border border-dashed border-hairline bg-card-surface/50 p-8 text-center">
          <p className="font-medium">No matches</p>
          <p className="mt-1 text-sm text-secondary-recall">
            Try a different query or remove the tag filter.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {notes.length > 0 && (type === 'all' || type === 'notes') && (
            <section aria-labelledby="notes-results">
              <h2 id="notes-results" className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-recall">
                <Notebook className="h-3.5 w-3.5" aria-hidden="true" />
                Notes ({notes.length})
              </h2>
              <ul className="space-y-2">
                {notes.map((note) => (
                  <li key={note.id}>
                    <button
                      onClick={() => openNote(note.id)}
                      className="w-full rounded-xl border border-hairline bg-card-surface p-4 text-left transition hover:border-accent-brand/40"
                    >
                      <p className="truncate text-sm font-medium">{note.title || 'Untitled'}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-recall">
                        {note.contentPlainText.slice(0, 160)}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-recall">
                        {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {cards.length > 0 && (type === 'all' || type === 'cards') && (
            <section aria-labelledby="cards-results">
              <h2 id="cards-results" className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-recall">
                <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                Flashcards ({cards.length})
              </h2>
              <ul className="space-y-2">
                {cards.map((card) => (
                  <li key={card.id}>
                    <button
                      onClick={() => card.deck && openDeck(card.deck.id)}
                      className="w-full rounded-xl border border-hairline bg-card-surface p-4 text-left transition hover:border-accent-brand/40"
                    >
                      <p className="text-sm font-medium">{card.front}</p>
                      <p className="mt-1 text-xs text-muted-recall line-clamp-2">{card.back}</p>
                      {card.deck && (
                        <p className="mt-1 text-[10px] text-muted-recall">
                          {card.deck.name}
                        </p>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
