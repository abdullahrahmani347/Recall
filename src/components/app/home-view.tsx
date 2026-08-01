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
import { ReviewHeatmap } from '@/components/app/review-heatmap'
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
  const openNote = useAppStore((s) => s.openNote)
  const startReview = useAppStore((s) => s.startReview)
  const setView = useAppStore((s) => s.setView)

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: () => api<Stats>('/api/stats'),
    refetchInterval: 30_000,
  })

  const { data: notesData, isLoading: notesLoading } = useQuery<{ notes: ApiNote[] }>({
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
  const todayReviews = stats?.todayReviews ?? 0

  const onCreateNote = () => openNote(null)
  const onCreateDeck = () => setView('decks')

  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-6 sm:px-6 sm:pt-8">
      {/* HEADER */}
      <header className="mb-8 flex items-center justify-between animate-fade-in-up">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-recall">
            {greeting()}
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            {todayReviews > 0 ? 'Keep it going.' : 'Ready to study?'}
          </h1>
        </div>
        <Button
          onClick={onCreateNote}
          className="bg-accent-brand text-void hover:bg-accent-brand/90 press shadow-glow-brand sm:hidden"
          size="icon"
          aria-label="Create note"
        >
          <Plus className="h-5 w-5" />
        </Button>
        <Button
          onClick={onCreateNote}
          className="hidden bg-accent-brand text-void hover:bg-accent-brand/90 press shadow-glow-brand sm:inline-flex"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          New note
        </Button>
      </header>

      {/* DUE CARDS HERO */}
      <Card
        className="mb-5 overflow-hidden border-hairline bg-card-surface p-5 animate-fade-in-up stagger-1 card-lift sm:p-6"
        role="region"
        aria-label="Due cards"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-recall">
              Due for review
            </p>
            {statsLoading ? (
              <div className="mt-2 h-9 w-20 shimmer rounded-lg" />
            ) : (
              <div className="mt-1 flex items-baseline gap-2">
                <p className="font-display text-4xl font-semibold tabular-nums sm:text-5xl">
                  {dueCount}
                </p>
                <p className="text-sm text-secondary-recall">
                  {dueCount === 1 ? 'card' : 'cards'}
                </p>
              </div>
            )}
            <p className="mt-1.5 text-sm text-secondary-recall">
              {dueCount === 0
                ? 'All caught up. Nice work.'
                : todayReviews > 0
                  ? `${todayReviews} reviewed today · ${dueCount} to go`
                  : `${dueCount} card${dueCount === 1 ? '' : 's'} waiting`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div
              className="flex items-center gap-1.5 rounded-full border border-accent-warm/20 bg-accent-warm/10 px-3 py-1.5 text-sm text-accent-warm"
              title="Current review streak"
            >
              <FlameIcon size={16} aria-hidden="true" />
              <span className="font-semibold tabular-nums">{streak}</span>
              <span className="text-muted-recall">day{streak === 1 ? '' : 's'}</span>
            </div>
            <Button
              disabled={dueCount === 0}
              onClick={() => startReview(null)}
              size="sm"
              className="bg-accent-brand text-void hover:bg-accent-brand/90 press"
            >
              Start review
            </Button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('recall-custom-study'))}
              className="text-[11px] text-muted-recall hover:text-accent-brand"
            >
              Custom study
            </button>
          </div>
        </div>
      </Card>

      {/* QUICK ACTIONS */}
      <div className="mb-8 grid grid-cols-2 gap-3 animate-fade-in-up stagger-2">
        <button
          onClick={onCreateNote}
          className="group flex items-center gap-3 rounded-2xl border border-hairline bg-card-surface p-4 text-left card-lift press"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-brand-dim text-accent-brand transition-smooth group-hover:scale-110">
            <NotebookIcon size={20} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">New note</p>
            <p className="truncate text-xs text-muted-recall">Capture + summarize</p>
          </div>
        </button>
        <button
          onClick={onCreateDeck}
          className="group flex items-center gap-3 rounded-2xl border border-hairline bg-card-surface p-4 text-left card-lift press"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-brand-dim text-accent-brand transition-smooth group-hover:scale-110">
            <LayersIcon size={20} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">Flashcards</p>
            <p className="truncate text-xs text-muted-recall">
              {stats?.cardCount ?? 0} cards · {stats?.deckCount ?? 0} decks
            </p>
          </div>
        </button>
      </div>

      {/* 30-DAY REVIEW HEATMAP STRIP */}
      <div className="mb-8 animate-fade-in-up stagger-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-recall">
            Last 30 days
          </p>
        </div>
        <ReviewHeatmap days={30} compact />
      </div>

      {/* RECENT NOTES */}
      <section aria-labelledby="recent-notes-heading" className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2
            id="recent-notes-heading"
            className="font-display text-lg font-semibold"
          >
            Recent notes
          </h2>
          <button
            onClick={() => setView('notes')}
            className="inline-flex items-center gap-0.5 text-sm text-accent-brand hover:underline press"
          >
            All notes
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        {notesLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-hairline bg-card-surface p-4">
                <div className="h-10 w-10 shrink-0 shimmer rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 shimmer rounded" />
                  <div className="h-2.5 w-2/3 shimmer rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : recentNotes.length === 0 ? (
          <Card className="border border-dashed border-hairline bg-card-surface/50 p-10 text-center animate-fade-in">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-brand-dim text-accent-brand">
              <NotebookIcon size={28} aria-hidden="true" />
            </div>
            <p className="font-medium">Your first note is one tap away</p>
            <p className="mt-1.5 text-sm text-secondary-recall">
              Capture a lecture, a meeting, a chapter — then summarize it and turn it into cards.
            </p>
            <Button
              onClick={onCreateNote}
              className="mt-5 bg-accent-brand text-void hover:bg-accent-brand/90 press shadow-glow-brand"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Create your first note
            </Button>
          </Card>
        ) : (
          <ul className="space-y-2">
            {recentNotes.map((note, i) => (
              <li
                key={note.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <button
                  onClick={() => openNote(note.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-hairline bg-card-surface p-4 text-left card-lift press"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {note.title || 'Untitled'}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-recall">
                      {note.contentPlainText.slice(0, 120) || 'Empty note'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-recall">
                    <ClockIcon size={13} aria-hidden="true" />
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
        <section aria-labelledby="decks-heading" className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="decks-heading" className="font-display text-lg font-semibold">
              Decks
            </h2>
            <button
              onClick={() => setView('decks')}
              className="inline-flex items-center gap-0.5 text-sm text-accent-brand hover:underline press"
            >
              All decks
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <ul className="space-y-2">
            {decks.slice(0, 4).map((deck, i) => (
              <li
                key={deck.id}
                className="animate-fade-in-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <button
                  onClick={() => startReview(deck.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-hairline bg-card-surface p-4 text-left card-lift press"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-9 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: deck.color }}
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-sm font-medium">{deck.name}</p>
                      <p className="text-xs text-muted-recall">
                        {deck.cardCount} card{deck.cardCount === 1 ? '' : 's'}
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

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}
