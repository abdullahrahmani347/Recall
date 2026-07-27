'use client'

import { useEffect, useState, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import {
  X,
  RotateCw,
  Check,
  Trophy,
} from 'lucide-react'
import type { ApiFlashcard, Grade } from '@/lib/types'
import { toast } from 'sonner'
import { formatInterval } from '@/lib/fsrs'

interface QueueResponse {
  cards: (ApiFlashcard & { deck?: { id: string; name: string; color: string } })[]
  total: number
}

const GRADE_BUTTONS: {
  grade: Grade
  label: string
  hint: string
  key: string
  className: string
}[] = [
  { grade: 'again', label: 'Again', hint: 'Forgot', key: '1', className: 'bg-grade-again' },
  { grade: 'hard', label: 'Hard', hint: 'Barely', key: '2', className: 'bg-grade-hard' },
  { grade: 'good', label: 'Good', hint: 'Got it', key: '3', className: 'bg-grade-good' },
  { grade: 'easy', label: 'Easy', hint: 'Instant', key: '4', className: 'bg-grade-easy' },
]

export function ReviewSession() {
  const qc = useQueryClient()
  const { reviewDeckId, setView } = useAppStore()
  const [revealed, setRevealed] = useState(false)
  const [index, setIndex] = useState(0)
  const [completed, setCompleted] = useState(0)
  const [startedAt] = useState(() => Date.now())
  const [sessionGrades, setSessionGrades] = useState<Grade[]>([])
  const [cardStartTime, setCardStartTime] = useState(() => Date.now())

  const { data, isLoading } = useQuery<QueueResponse>({
    queryKey: ['review-queue', reviewDeckId],
    queryFn: () => {
      const params = new URLSearchParams()
      if (reviewDeckId) params.set('deckId', reviewDeckId)
      return api<QueueResponse>(`/api/review/queue${params.size ? `?${params.toString()}` : ''}`)
    },
  })

  const cards = data?.cards ?? []
  const total = cards.length
  const card = cards[index]
  const isDone = index >= total

  const reviewMutation = useMutation({
    mutationFn: ({
      cardId,
      grade,
      responseTimeMs,
    }: {
      cardId: string
      grade: Grade
      responseTimeMs: number
    }) =>
      api(`/api/cards/${cardId}/review`, {
        method: 'POST',
        body: JSON.stringify({ grade, responseTimeMs }),
      }),
  })

  const onGrade = useCallback(
    async (grade: Grade) => {
      if (!card || !revealed) return
      try {
        await reviewMutation.mutateAsync({
          cardId: card.id,
          grade,
          responseTimeMs: Date.now() - cardStartTime,
        })
        setSessionGrades((prev) => [...prev, grade])
        setCompleted((c) => c + 1)
        setRevealed(false)
        setCardStartTime(Date.now())
        setIndex((i) => i + 1)
        qc.invalidateQueries({ queryKey: ['decks'] })
        qc.invalidateQueries({ queryKey: ['stats'] })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save review')
      }
    },
    [card, revealed, reviewMutation, cardStartTime, qc]
  )

  // Keyboard shortcuts: 1-4 grade, Space to reveal
  useEffect(() => {
    if (isDone) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (!revealed) setRevealed(true)
        return
      }
      if (!revealed) return
      const match = GRADE_BUTTONS.find((b) => b.key === e.key)
      if (match) {
        e.preventDefault()
        onGrade(match.grade)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [revealed, isDone, onGrade])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <p className="text-sm text-muted-recall">Loading review queue…</p>
      </div>
    )
  }

  if (total === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-brand/10 text-accent-brand">
          <Check className="h-8 w-8" aria-hidden="true" />
        </div>
        <h2 className="font-display text-2xl font-semibold">Nothing due</h2>
        <p className="mt-2 text-sm text-secondary-recall">
          You're all caught up. Come back later or add more cards.
        </p>
        <Button
          onClick={() => setView('decks')}
          className="mt-6 bg-accent-brand text-void hover:bg-accent-brand/90"
        >
          Back to decks
        </Button>
      </div>
    )
  }

  if (isDone) {
    const againCount = sessionGrades.filter((g) => g === 'again').length
    const goodCount = sessionGrades.filter((g) => g === 'good' || g === 'easy').length
    const minutes = Math.round((Date.now() - startedAt) / 60_000)

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 py-12 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-warm/15 text-accent-warm">
          <Trophy className="h-8 w-8" aria-hidden="true" />
        </div>
        <h2 className="font-display text-3xl font-semibold tracking-tight">
          Session complete
        </h2>
        <p className="mt-2 text-secondary-recall">
          You reviewed {completed} card{completed === 1 ? '' : 's'} in {minutes || '< 1'} min.
        </p>

        <div className="mt-8 grid w-full max-w-md grid-cols-3 gap-3">
          <div className="rounded-xl border border-hairline bg-card-surface p-4">
            <p className="font-display text-2xl font-semibold text-grade-again">{againCount}</p>
            <p className="text-xs text-muted-recall">Again</p>
          </div>
          <div className="rounded-xl border border-hairline bg-card-surface p-4">
            <p className="font-display text-2xl font-semibold text-grade-hard">
              {sessionGrades.filter((g) => g === 'hard').length}
            </p>
            <p className="text-xs text-muted-recall">Hard</p>
          </div>
          <div className="rounded-xl border border-hairline bg-card-surface p-4">
            <p className="font-display text-2xl font-semibold text-grade-good">{goodCount}</p>
            <p className="text-xs text-muted-recall">Good + Easy</p>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <Button variant="ghost" onClick={() => setView('home')} className="border border-hairline">
            Back to home
          </Button>
          <Button
            onClick={() => setView('decks')}
            className="bg-accent-brand text-void hover:bg-accent-brand/90"
          >
            Done
          </Button>
        </div>
      </div>
    )
  }

  const progress = ((index) / total) * 100

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      {/* TOP BAR */}
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm('End this review session?')) setView('home')
            }}
            className="h-8 w-8 p-0"
            aria-label="Exit review"
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-card-surface">
              <div
                className="h-full rounded-full bg-accent-brand transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <p className="text-xs tabular-nums text-muted-recall">
            {index + 1} / {total}
          </p>
        </div>
      </header>

      {/* CARD */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        {card?.deck && (
          <div className="mb-4 flex items-center gap-2 text-xs text-muted-recall">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: card.deck.color }}
              aria-hidden="true"
            />
            {card.deck.name}
          </div>
        )}

        <div
          className="w-full rounded-3xl border border-hairline bg-card-surface p-8 shadow-lg sm:p-12"
          role="region"
          aria-label="Flashcard"
        >
          {/* FRONT */}
          <p className="text-xs uppercase tracking-wider text-muted-recall">Question</p>
          <p className="mt-3 whitespace-pre-wrap text-lg leading-relaxed sm:text-2xl">
            {card?.front}
          </p>

          {/* BACK (revealed) */}
          {revealed && (
            <div className="mt-8 border-t border-hairline pt-6">
              <p className="text-xs uppercase tracking-wider text-muted-recall">Answer</p>
              <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed sm:text-lg">
                {card?.back}
              </p>
            </div>
          )}
        </div>

        {/* ACTIONS */}
        <div className="mt-8 w-full">
          {!revealed ? (
            <Button
              onClick={() => setRevealed(true)}
              size="lg"
              className="w-full bg-accent-brand text-void hover:bg-accent-brand/90"
            >
              Reveal answer
              <span className="ml-2 hidden text-xs opacity-60 sm:inline">Space</span>
            </Button>
          ) : (
            <>
              <p className="mb-3 text-center text-xs text-muted-recall">
                How did you do?
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {GRADE_BUTTONS.map((b) => (
                  <button
                    key={b.grade}
                    onClick={() => onGrade(b.grade)}
                    className={`flex flex-col items-center gap-1 rounded-xl ${b.className} px-3 py-4 text-void transition active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}
                    aria-label={`${b.label} — ${b.hint} (key ${b.key})`}
                  >
                    <span className="text-sm font-semibold">{b.label}</span>
                    <span className="text-[10px] opacity-90">{b.hint}</span>
                    <span className="text-[10px] opacity-60">{b.key}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      {/* FOOTER HINT */}
      <footer className="border-t border-hairline px-4 py-2 sm:px-6">
        <p className="mx-auto max-w-3xl text-center text-[10px] text-muted-recall">
          Keyboard: <kbd className="rounded bg-card-surface px-1 py-0.5">Space</kbd> reveal ·{' '}
          <kbd className="rounded bg-card-surface px-1 py-0.5">1</kbd> Again ·{' '}
          <kbd className="rounded bg-card-surface px-1 py-0.5">2</kbd> Hard ·{' '}
          <kbd className="rounded bg-card-surface px-1 py-0.5">3</kbd> Good ·{' '}
          <kbd className="rounded bg-card-surface px-1 py-0.5">4</kbd> Easy
        </p>
      </footer>
    </div>
  )
}
