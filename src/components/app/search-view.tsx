'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/stores/app-store'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Search as SearchIcon, Notebook, Layers, Sparkles } from 'lucide-react'
import type { ApiNote, ApiFlashcard, ApiTag, SemanticSearchResult } from '@/lib/types'
import { formatDistanceToNow } from 'date-fns'

export function SearchView() {
  const openNote = useAppStore((s) => s.openNote)
  const openDeck = useAppStore((s) => s.openDeck)
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [type, setType] = useState<'all' | 'notes' | 'cards'>('all')
  const [tagId, setTagId] = useState<string | null>(null)
  const [semantic, setSemantic] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), semantic ? 400 : 250)
    return () => clearTimeout(t)
  }, [q, semantic])

  const keywordQuery = useQuery<{ notes: ApiNote[]; cards: ApiFlashcard[] }>({
    queryKey: ['search', debouncedQ, type, tagId],
    queryFn: () => {
      const params = new URLSearchParams()
      params.set('q', debouncedQ)
      params.set('type', type)
      if (tagId) params.set('tagId', tagId)
      return api(`/api/search?${params.toString()}`)
    },
    enabled: debouncedQ.length > 0 && !semantic,
  })

  const semanticQuery = useQuery<{ results: SemanticSearchResult[] }>({
    queryKey: ['semantic-search', debouncedQ],
    queryFn: () =>
      api<{ results: SemanticSearchResult[] }>(
        `/api/search/semantic?q=${encodeURIComponent(debouncedQ)}`
      ),
    enabled: debouncedQ.length > 0 && semantic,
  })

  const isFetching = keywordQuery.isFetching || semanticQuery.isFetching
  const notes = keywordQuery.data?.notes ?? []
  const cards = keywordQuery.data?.cards ?? []
  const semanticResults = semanticQuery.data?.results ?? []

  const { data: tagsData } = useQuery<{ tags: (ApiTag & { noteCount: number })[] }>({
    queryKey: ['tags'],
    queryFn: () => api('/api/tags'),
  })

  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-6 sm:px-6 sm:pt-8">
      <header className="mb-6 animate-fade-in-up">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-recall">Find</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Search
        </h1>
      </header>

      <div className="relative mb-4 animate-fade-in-up stagger-1">
        <SearchIcon
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-recall"
          aria-hidden="true"
        />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search notes and flashcards…"
          className="glass border-hairline pl-10"
          aria-label="Search query"
        />
      </div>

      {/* Type filter + Semantic toggle */}
      <div className="mb-4 flex flex-wrap items-center gap-2 animate-fade-in-up stagger-2">
        {!semantic && (
          <div className="flex gap-2">
            {(['all', 'notes', 'cards'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-smooth press ${
                  type === t
                    ? 'border-accent-brand bg-accent-brand-dim text-accent-brand'
                    : 'border-hairline bg-card-surface text-secondary-recall hover:text-primary-recall'
                }`}
              >
                {t === 'all' ? 'All' : t === 'notes' ? 'Notes' : 'Cards'}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setSemantic((v) => !v)}
          className={`ml-auto flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-smooth press ${
            semantic
              ? 'border-accent-warm bg-accent-warm/10 text-accent-warm'
              : 'border-hairline bg-card-surface text-secondary-recall hover:text-primary-recall'
          }`}
          title="Use TF-IDF semantic search instead of keyword matching"
        >
          <Sparkles className="h-3 w-3" />
          {semantic ? 'Semantic on' : 'Semantic'}
        </button>
      </div>

      {/* Tag filter */}
      {tagsData?.tags?.length ? (
        <div className="mb-5 flex flex-wrap gap-2 animate-fade-in-up stagger-3">
          <button
            onClick={() => setTagId(null)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-smooth press ${
              tagId === null
                ? 'border-accent-brand bg-accent-brand-dim text-accent-brand'
                : 'border-hairline bg-card-surface text-secondary-recall hover:text-primary-recall'
            }`}
          >
            Any tag
          </button>
          {tagsData.tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => setTagId(tagId === tag.id ? null : tag.id)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-smooth press ${
                tagId === tag.id
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
            </button>
          ))}
        </div>
      ) : null}

      {/* Results */}
      {!debouncedQ ? (
        <Card className="border border-dashed border-hairline bg-card-surface/50 p-10 text-center text-sm text-muted-recall animate-fade-in">
          <SearchIcon className="mx-auto mb-3 h-8 w-8 text-muted-recall" aria-hidden="true" />
          {semantic
            ? 'Type to search by meaning — we rank notes by semantic similarity to your query.'
            : 'Start typing to search your notes and flashcards.'}
        </Card>
      ) : isFetching ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-hairline bg-card-surface p-4">
              <div className="h-4 w-1/3 shimmer rounded" />
              <div className="mt-3 h-2.5 w-2/3 shimmer rounded" />
            </div>
          ))}
        </div>
      ) : semantic ? (
        semanticResults.length === 0 ? (
          <Card className="border border-dashed border-hairline bg-card-surface/50 p-8 text-center animate-fade-in">
            <p className="font-medium">No semantically similar notes</p>
            <p className="mt-1.5 text-sm text-secondary-recall">
              Try a more descriptive query, or add more notes to your library.
            </p>
          </Card>
        ) : (
          <section aria-labelledby="semantic-results" className="animate-fade-in">
            <h2 id="semantic-results" className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-recall">
              <Sparkles className="h-3.5 w-3.5 text-accent-warm" aria-hidden="true" />
              Semantic matches ({semanticResults.length})
            </h2>
            <ul className="space-y-2">
              {semanticResults.map((note, i) => (
                <li
                  key={note.id}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <button
                    onClick={() => openNote(note.id)}
                    className="w-full rounded-xl border border-hairline bg-card-surface p-4 text-left card-lift press"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-medium">{note.title || 'Untitled'}</p>
                      <span
                        className="shrink-0 rounded-full bg-accent-warm/10 px-2 py-0.5 text-[10px] font-medium text-accent-warm"
                        title="Similarity score (0–1)"
                      >
                        {note.score.toFixed(2)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-recall">
                      {note.contentPlainText.slice(0, 160)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      ) : notes.length === 0 && cards.length === 0 ? (
        <Card className="border border-dashed border-hairline bg-card-surface/50 p-8 text-center animate-fade-in">
          <p className="font-medium">No matches</p>
          <p className="mt-1.5 text-sm text-secondary-recall">
            Try a different query, remove the tag filter, or enable semantic search.
          </p>
        </Card>
      ) : (
        <div className="space-y-6 animate-fade-in">
          {notes.length > 0 && (type === 'all' || type === 'notes') && (
            <section aria-labelledby="notes-results">
              <h2 id="notes-results" className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-recall">
                <Notebook className="h-3.5 w-3.5" aria-hidden="true" />
                Notes ({notes.length})
              </h2>
              <ul className="space-y-2">
                {notes.map((note, i) => (
                  <li
                    key={note.id}
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <button
                      onClick={() => openNote(note.id)}
                      className="w-full rounded-xl border border-hairline bg-card-surface p-4 text-left card-lift press"
                    >
                      <p className="truncate text-sm font-medium">{note.title || 'Untitled'}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-recall">
                        {note.contentPlainText.slice(0, 160)}
                      </p>
                      <p className="mt-1.5 text-[10px] text-muted-recall">
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
              <h2 id="cards-results" className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-recall">
                <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                Flashcards ({cards.length})
              </h2>
              <ul className="space-y-2">
                {cards.map((card, i) => (
                  <li
                    key={card.id}
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    <button
                      onClick={() => card.deck && openDeck(card.deck.id)}
                      className="w-full rounded-xl border border-hairline bg-card-surface p-4 text-left card-lift press"
                    >
                      <p className="text-sm font-medium">{card.front}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-recall">{card.back}</p>
                      {card.deck && (
                        <p className="mt-1.5 text-[10px] text-muted-recall">{card.deck.name}</p>
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
