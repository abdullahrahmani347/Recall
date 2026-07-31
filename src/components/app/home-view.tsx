'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Plus, ChevronRight } from 'lucide-react'
import {
  FlameIcon,
  NotebookIcon,
  LayersIcon,
  ClockIcon,
} from '@/components/icons/recall-icons'
import type { ApiNote, ApiDeck } from '@/lib/types'
import { formatDistanceToNow } from 'date-fns'

interface Stats {
  noteCount: number
  deckCount: number
  cardCount: number
  dueCount: number
  todayReviews: number
  streak: number
}

export function HomeView() {
  const { openNote, startReview, setView } = useAppStore()

  const { data: stats } = useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: () => api<Stats>('/api/stats'),
    refetchInterval: 30_000,
  })

  const { data: notesData } = useQuery<{ notes: ApiNote[] }>({
    queryKey: ['notes', 'recent'],
    queryFn: () => api<{ notes: ApiNote[] }>('/api/notes?archived=false'),
  })
  const recentNotes = (notesData?.notes ?? []).slice(0, 5)

  const { data: decksData } = useQuery<{ decks: (ApiDeck & { cardCount: number; dueCount: number })[] }>({
    queryKey: ['decks'],
    queryFn: () => api<{ decks: (ApiDeck & { cardCount: number; dueCount: number })[] }>('/api/decks'),
  })
  const decks = decksData?.decks ?? []

  const dueCount = stats?.dueCount ?? 0
  const streak = stats?.streak ?? 0

  const onCreateNote = () => openNote(null)
  const onCreateDeck = () => setView('decks')

  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-6 sm:px-6">
      {/* HEADER */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-recall">Today</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Home</h1>
        </div>
        <Button
          onClick={onCreateNote}
          className="bg-accent-brand text-void hover:bg-accent-brand/90 sm:hidden"
          size="icon"
          aria-label="Create note"
        >
          <Plus className="h-5 w-5" />
        </Button>
        <Button
          onClick={onCreateNote}
          className="hidden bg-accent-brand text-void hover:bg-accent-brand/90 sm:inline-flex"
        >
          <Plus className="mr-1 h-4 w-4" />
          New note
        </Button>
      </header>

      {/* DUE CARDS HERO */}
      <Card
        className="mb-6 overflow-hidden border-hairline bg-card-surface p-5"
        role="region"
        aria-label="Due cards"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-recall">
              Due for review
            </p>
            <p className="mt-1 font-display text-3xl font-semibold tabular-nums">
              {dueCount}
            </p>
            <p className="mt-1 text-sm text-secondary-recall">
              {dueCount === 0
                ? 'All caught up. Nice work.'
                : `${stats?.todayReviews ?? 0} reviewed today.`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div
              className="flex items-center gap-1.5 rounded-full border border-hairline bg-void px-3 py-1 text-sm text-accent-warm"
              title="Current review streak"
            >
              <FlameIcon size={18} aria-hidden="true" />
              <span className="tabular-nums">{streak}</span>
              <span className="text-muted-recall">day{streak === 1 ? '' : 's'}</span>
            </div>
            <Button
              disabled={dueCount === 0}
              onClick={() => startReview(null)}
              size="sm"
              className="bg-accent-brand text-void hover:bg-accent-brand/90"
            >
              Start review
            </Button>
          </div>
        </div>
      </Card>

      {/* QUICK ACTIONS */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <button
          onClick={onCreateNote}
          className="flex items-center gap-3 rounded-xl border border-hairline bg-card-surface p-4 text-left transition hover:border-accent-brand/50"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-brand/10 text-accent-brand">
            <NotebookIcon size={18} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium">New note</p>
            <p className="text-xs text-muted-recall">Capture + summarize</p>
          </div>
        </button>
        <button
          onClick={onCreateDeck}
          className="flex items-center gap-3 rounded-xl border border-hairline bg-card-surface p-4 text-left transition hover:border-accent-brand/50"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-brand/10 text-accent-brand">
            <LayersIcon size={18} aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-medium">Flashcards</p>
            <p className="text-xs text-muted-recall">
              {stats?.cardCount ?? 0} cards · {stats?.deckCount ?? 0} decks
            </p>
          </div>
        </button>
      </div>

      {/* RECENT NOTES */}
      <section aria-labelledby="recent-notes-heading" className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2
            id="recent-notes-heading"
            className="font-display text-lg font-semibold"
          >
            Recent notes
          </h2>
          <button
            onClick={() => setView('notes')}
            className="inline-flex items-center text-sm text-accent-brand hover:underline"
          >
            All notes
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        {recentNotes.length === 0 ? (
          <Card className="border border-dashed border-hairline bg-card-surface/50 p-8 text-center">
            <NotebookIcon size={28} className="mx-auto mb-3 text-muted-recall" aria-hidden="true" />
            <p className="font-medium">Your first note is one tap away</p>
            <p className="mt-1 text-sm text-secondary-recall">
              Capture a lecture, a meeting, a chapter — then summarize it and turn it into cards.
            </p>
            <Button
              onClick={onCreateNote}
              className="mt-4 bg-accent-brand text-void hover:bg-accent-brand/90"
            >
              <Plus className="mr-1 h-4 w-4" />
              Create your first note
            </Button>
          </Card>
        ) : (
          <ul className="space-y-2">
            {recentNotes.map((note) => (
              <li key={note.id}>
                <button
                  onClick={() => openNote(note.id)}
                  className="flex w-full items-center justify-between rounded-xl border border-hairline bg-card-surface p-4 text-left transition hover:border-accent-brand/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {note.title || 'Untitled'}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-recall">
                      {note.contentPlainText.slice(0, 120) || 'Empty note'}
                    </p>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-2 text-xs text-muted-recall">
                    <ClockIcon size={14} aria-hidden="true" />
                    {formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true })}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* DECKS */}
      {decks.length > 0 && (
        <section aria-labelledby="decks-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="decks-heading" className="font-display text-lg font-semibold">
              Decks
            </h2>
            <button
              onClick={() => setView('decks')}
              className="inline-flex items-center text-sm text-accent-brand hover:underline"
            >
              All decks
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <ul className="space-y-2">
            {decks.slice(0, 4).map((deck) => (
              <li key={deck.id}>
                <button
                  onClick={() => startReview(deck.id)}
                  className="flex w-full items-center justify-between rounded-xl border border-hairline bg-card-surface p-4 text-left transition hover:border-accent-brand/40"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-8 w-1.5 rounded-full"
                      style={{ backgroundColor: deck.color }}
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-sm font-medium">{deck.name}</p>
                      <p className="text-xs text-muted-recall">
                        {deck.cardCount} cards
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-semibold tabular-nums ${
                        deck.dueCount > 0 ? 'text-accent-warm' : 'text-muted-recall'
                      }`}
                    >
                      {deck.dueCount} due
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
